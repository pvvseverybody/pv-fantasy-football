import {createHash,createHmac,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';

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
export const tokenHash=token=>createHash('sha256').update(String(token)).digest('hex');
export const codeHash=(secret,challengeId,code)=>createHmac('sha256',secret).update(`${challengeId}:${code}`).digest('hex');
export function safeEqual(a,b){const left=Buffer.from(String(a));const right=Buffer.from(String(b));return left.length===right.length&&timingSafeEqual(left,right);}
export function cookieValue(request,name){const header=request.headers.get('cookie')||'';for(const part of header.split(';')){const [key,...value]=part.trim().split('=');if(key===name)return decodeURIComponent(value.join('='));}return'';}
export function secureRequest(request,environment=process.env){if(environment.NODE_ENV!=='production')return true;const forwarded=request.headers.get('x-forwarded-proto');return forwarded==='https'||new URL(request.url).protocol==='https:';}
export const cookieOptions=(maxAge)=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge});
export function bindAuthenticatedLineup(body,participant){if(!participant){const error=new Error('Authentication required.');error.code='UNAUTHENTICATED';throw error;}return{email:participant.email,gameId:String(body?.game_id||'').trim(),picks:body?.picks||{}};}
export function authenticatedParticipantEmail(participant){if(!participant){const error=new Error('Authentication required.');error.code='UNAUTHENTICATED';throw error;}return participant.email;}

export function createParticipantAuthService({repository,sendCode,secret,now=()=>Date.now(),makeToken=opaqueToken,makeCode=verificationCode}){
  const challengeTtl=10*60*1000,sessionTtl=7*24*60*60*1000,maxAttempts=5,requestCooldown=60*1000;
  return{
    async request(email){
      const normalized=String(email||'').trim().toLowerCase();const participant=await repository.findParticipantByEmail(normalized);
      if(!participant)return{message:GENERIC_LOGIN_MESSAGE};
      const recent=await repository.latestChallenge(participant.id);if(recent&&now()-Date.parse(recent.createdAt)<requestCooldown)return{message:GENERIC_LOGIN_MESSAGE,challengeId:recent.id};
      const challengeId=`AUTH-${makeToken()}`;const code=makeCode();const expiresAt=new Date(now()+challengeTtl).toISOString();
      await repository.createChallenge({id:challengeId,participant,hash:codeHash(secret,challengeId,code),createdAt:new Date(now()).toISOString(),expiresAt,attempts:0});
      await sendCode({to:participant.email,displayName:participant.displayName,code,expiresMinutes:10});
      return{message:GENERIC_LOGIN_MESSAGE,challengeId};
    },
    async verify(challengeId,code){
      const challenge=challengeId&&await repository.findChallenge(challengeId);if(!challenge||challenge.status!=='PENDING'||Date.parse(challenge.expiresAt)<=now())return null;
      const attempts=Number(challenge.attempts||0)+1;if(attempts>maxAttempts){await repository.updateChallenge(challenge.id,{status:'LOCKED',attempts});return null;}
      if(!safeEqual(codeHash(secret,challenge.id,String(code||'')),challenge.hash)){await repository.updateChallenge(challenge.id,{status:attempts>=maxAttempts?'LOCKED':'PENDING',attempts});return null;}
      await repository.updateChallenge(challenge.id,{status:'USED',attempts});const token=makeToken();const expiresAt=new Date(now()+sessionTtl).toISOString();
      await repository.createSession({id:`SESSION-${makeToken()}`,participant:challenge.participant,hash:tokenHash(token),createdAt:new Date(now()).toISOString(),expiresAt});
      return{token,expiresAt,displayName:challenge.participant.displayName};
    },
    async authenticate(token){
      if(!token)return null;const session=await repository.findSessionByHash(tokenHash(token));if(!session||session.status!=='ACTIVE'||Date.parse(session.expiresAt)<=now())return null;
      const participant=await repository.findParticipantById(session.participantId);if(!participant)return null;return participant;
    },
    async logout(token){if(token){const session=await repository.findSessionByHash(tokenHash(token));if(session)await repository.revokeSession(session.id);}return true;}
  };
}
