import {createHash,createHmac,randomBytes,randomInt,randomUUID,timingSafeEqual} from 'node:crypto';

export const AUTH_COOKIE='pv_participant_session';
export const CHALLENGE_COOKIE='pv_auth_challenge';
export const GENERIC_LOGIN_MESSAGE='If that email is registered, a verification code has been sent.';

export function requiredAuthConfig(environment=process.env){
  const names=['PARTICIPANT_AUTH_SECRET','RESEND_API_KEY','PARTICIPANT_AUTH_FROM'];
  const missing=names.filter(name=>!environment[name]);
  if(missing.length||String(environment.PARTICIPANT_AUTH_SECRET||'').length<32){const error=new Error('Participant authentication is not configured.');error.code='AUTH_NOT_CONFIGURED';error.missing=missing;throw error;}
  return{secret:environment.PARTICIPANT_AUTH_SECRET,resendKey:environment.RESEND_API_KEY,from:environment.PARTICIPANT_AUTH_FROM};
}
export const opaqueToken=()=>randomBytes(32).toString('base64url');
export const verificationCode=()=>String(randomInt(0,1000000)).padStart(6,'0');
export const permanentParticipantId=()=>`PART-${randomUUID().replaceAll('-','').toUpperCase()}`;
export const tokenHash=token=>createHash('sha256').update(String(token)).digest('hex');
export const codeHash=(secret,challengeId,code)=>createHmac('sha256',secret).update(`${challengeId}:${code}`).digest('hex');
export function safeEqual(a,b){const left=Buffer.from(String(a));const right=Buffer.from(String(b));return left.length===right.length&&timingSafeEqual(left,right);}
export function cookieValue(request,name){const header=request.headers.get('cookie')||'';for(const part of header.split(';')){const [key,...value]=part.trim().split('=');if(key===name)return decodeURIComponent(value.join('='));}return'';}
export function secureRequest(request,environment=process.env){if(environment.NODE_ENV!=='production')return true;const forwarded=request.headers.get('x-forwarded-proto');return forwarded==='https'||new URL(request.url).protocol==='https:';}
export const cookieOptions=(maxAge)=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge});
export function bindAuthenticatedLineup(body,participant){if(!participant){const error=new Error('Authentication required.');error.code='UNAUTHENTICATED';throw error;}return{email:participant.email,gameId:String(body?.game_id||'').trim(),picks:body?.picks||{}};}
export function authenticatedParticipantEmail(participant){if(!participant){const error=new Error('Authentication required.');error.code='UNAUTHENTICATED';throw error;}return participant.email;}

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERSON_NAME=/^[\p{L}\p{M}][\p{L}\p{M}'’ .-]{0,38}[\p{L}\p{M}.]$/u;
const TEAM_NAME=/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’ .&-]{1,30}[\p{L}\p{M}\p{N}.]$/u;
export function normalizeEmail(value){return String(value||'').trim().toLowerCase();}
export function normalizeTeamName(value){return String(value||'').trim().replace(/\s+/g,' ');}
export function validateRegistration(input={}){
  const firstName=String(input.first_name||'').trim().replace(/\s+/g,' '),lastName=String(input.last_name||'').trim().replace(/\s+/g,' '),email=normalizeEmail(input.email),displayName=normalizeTeamName(input.display_name);
  if(!EMAIL.test(email)||email.length>254)return{valid:false,code:'INVALID_EMAIL',message:'Enter a valid email address.'};
  if(firstName.length<2||!PERSON_NAME.test(firstName)||lastName.length<2||!PERSON_NAME.test(lastName))return{valid:false,code:'INVALID_NAME',message:'Enter your first and last name using letters, spaces, apostrophes, periods, or hyphens.'};
  if(displayName.length<3||displayName.length>32||!TEAM_NAME.test(displayName))return{valid:false,code:'INVALID_TEAM_NAME',message:'Fantasy Team Name must be 3–32 characters using letters, numbers, spaces, apostrophes, periods, ampersands, or hyphens.'};
  if(input.accepted_terms!==true)return{valid:false,code:'TERMS_REQUIRED',message:'Accept the game rules and terms to create an account.'};
  return{valid:true,value:{firstName,lastName,email,displayName,acceptedTerms:true}};
}

export function createParticipantAuthService({repository,sendCode,secret,now=()=>Date.now(),makeToken=opaqueToken,makeCode=verificationCode,makeParticipantId=permanentParticipantId}){
  const challengeTtl=10*60*1000,sessionTtl=7*24*60*60*1000,maxAttempts=5,requestCooldown=60*1000;
  async function issueChallenge(participant,{kind='LOGIN',registration=null}={}){
    const recent=await repository.latestChallenge(participant.id);if(recent&&now()-Date.parse(recent.createdAt)<requestCooldown)return{message:GENERIC_LOGIN_MESSAGE,challengeId:recent.id};
    const challengeId=`AUTH-${makeToken()}`;const code=makeCode();const expiresAt=new Date(now()+challengeTtl).toISOString();
    await repository.createChallenge({id:challengeId,participant,hash:codeHash(secret,challengeId,code),createdAt:new Date(now()).toISOString(),expiresAt,attempts:0,kind,registration});
    await sendCode({to:participant.email,displayName:participant.displayName,code,expiresMinutes:10});
    return{message:GENERIC_LOGIN_MESSAGE,challengeId};
  }
  return{
    async request(email){
      const normalized=normalizeEmail(email);const participant=await repository.findParticipantByEmail(normalized);
      if(!participant)return{message:GENERIC_LOGIN_MESSAGE};
      return issueChallenge(participant);
    },
    async register(input){
      const checked=validateRegistration(input);if(!checked.valid){const error=new Error(checked.message);error.code=checked.code;throw error;}
      const registration=checked.value;const work=async()=>{const existing=await repository.findParticipantByEmail(registration.email);
        if(existing)return issueChallenge(existing);
        const existingRecord=await repository.findParticipantRecordByEmail?.(registration.email);if(existingRecord)return{message:GENERIC_LOGIN_MESSAGE};
        const pendingId=`PENDING-${tokenHash(registration.email).slice(0,24).toUpperCase()}`;
        const recent=await repository.latestChallengeByEmail?.(registration.email);if(recent&&now()-Date.parse(recent.createdAt)<requestCooldown)return{message:GENERIC_LOGIN_MESSAGE,challengeId:recent.id};
        return issueChallenge({id:pendingId,email:registration.email,displayName:registration.displayName},{kind:'REGISTER',registration});};
      return repository.runRegistrationExclusive?repository.runRegistrationExclusive(registration.email,work):work();
    },
    async verify(challengeId,code){
      const challenge=challengeId&&await repository.findChallenge(challengeId);if(!challenge||challenge.status!=='PENDING'||Date.parse(challenge.expiresAt)<=now())return null;
      const attempts=Number(challenge.attempts||0)+1;if(attempts>maxAttempts){await repository.updateChallenge(challenge.id,{status:'LOCKED',attempts});return null;}
      if(!safeEqual(codeHash(secret,challenge.id,String(code||'')),challenge.hash)){await repository.updateChallenge(challenge.id,{status:attempts>=maxAttempts?'LOCKED':'PENDING',attempts});return null;}
      let participant=challenge.participant;
      if(challenge.kind==='REGISTER')try{participant=await repository.finalizeRegistration(challenge.registration,{makeParticipantId,verifiedAt:new Date(now()).toISOString()})}catch(error){await repository.updateChallenge(challenge.id,{status:'REVIEW_REQUIRED',attempts});throw error}
      await repository.updateChallenge(challenge.id,{status:'USED',attempts});const token=makeToken();const expiresAt=new Date(now()+sessionTtl).toISOString();
      await repository.createSession({id:`SESSION-${makeToken()}`,participant,hash:tokenHash(token),createdAt:new Date(now()).toISOString(),expiresAt});
      return{token,expiresAt,displayName:participant.displayName};
    },
    async authenticate(token){
      if(!token)return null;const session=await repository.findSessionByHash(tokenHash(token));if(!session||session.status!=='ACTIVE'||Date.parse(session.expiresAt)<=now())return null;
      const participant=await repository.findParticipantById(session.participantId);if(!participant)return null;return participant;
    },
    async logout(token){if(token){const session=await repository.findSessionByHash(tokenHash(token));if(session)await repository.revokeSession(session.id);}return true;}
  };
}
