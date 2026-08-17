import 'server-only';
import {appendSheetRow,readSheetRange,writeSheetRange} from './google-sheets';
import {createParticipantAuthService,requiredAuthConfig} from './participant-auth.mjs';

const SHEET="'ParticipantSession'";
const participantWriters=new Map();
const parse=rows=>{if(!rows.length)return[];const [headers,...data]=rows;return data.map((row,index)=>({row:index+4,...Object.fromEntries(headers.map((header,i)=>[header,row[i]??'']))})).filter(row=>row['Session ID']);};
const notes=row=>{try{return JSON.parse(row.Notes||'{}')}catch{return{}}};
async function sessions(){return parse(await readSheetRange(`${SHEET}!A3:K2000`));}
async function participants(){const rows=await readSheetRange("'Participants'!A3:K1000");if(!rows.length)return[];const [headers,...data]=rows;return data.map((row,index)=>({row:index+4,...Object.fromEntries(headers.map((header,i)=>[header,row[i]??'']))})).filter(row=>row['Participant ID']);}
function participant(row){if(!row||String(row.Active).toUpperCase()!=='YES'||String(row['Identity Status']).toUpperCase()!=='VERIFIED'||String(row['Duplicate Flag']).toUpperCase()!=='CLEAR')return null;return{id:row['Participant ID'],displayName:row['Display Name'],email:String(row['Normalized Email']||row.Email).trim().toLowerCase()};}
const normalized=value=>String(value||'').trim().toLowerCase();
async function withParticipantWriter(key,work){const previous=participantWriters.get(key)||Promise.resolve();let release;const current=new Promise(resolve=>{release=resolve});participantWriters.set(key,current);await previous;try{return await work()}finally{release();if(participantWriters.get(key)===current)participantWriters.delete(key)}}
const repository={
  async runRegistrationExclusive(email,work){return withParticipantWriter(`registration:${email}`,work);},
  async findParticipantByEmail(email){return participant((await participants()).find(row=>[row['Normalized Email'],row.Email].some(value=>String(value||'').trim().toLowerCase()===email)));},
  async findParticipantRecordByEmail(email){return(await participants()).find(row=>[row['Normalized Email'],row.Email].some(value=>normalized(value)===email))||null;},
  async findParticipantById(id){return participant((await participants()).find(row=>row['Participant ID']===id));},
  async latestChallenge(id){return(await sessions()).filter(row=>row['Participant ID']===id&&row.Status==='PENDING').map(row=>({id:row['Session ID'],createdAt:row['Created At']})).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]||null;},
  async latestChallengeByEmail(email){return(await sessions()).filter(row=>normalized(row['Normalized Email'])===email&&row.Status==='PENDING').map(row=>({id:row['Session ID'],createdAt:row['Created At']})).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]||null;},
  async createChallenge(value){await appendSheetRow(`${SHEET}!A:K`,[value.id,value.participant.id,value.participant.displayName,value.participant.email,value.createdAt,value.createdAt,value.hash,'PENDING','','',JSON.stringify({expiresAt:value.expiresAt,attempts:value.attempts,kind:value.kind||'LOGIN',registration:value.registration||null})]);},
  async findChallenge(id){const row=(await sessions()).find(item=>item['Session ID']===id);if(!row)return null;const meta=notes(row);return{id,hash:row['Device Token Hash'],status:row.Status,expiresAt:meta.expiresAt,attempts:meta.attempts,kind:meta.kind||'LOGIN',registration:meta.registration||null,participant:{id:row['Participant ID'],displayName:row['Display Name'],email:row['Normalized Email']}};},
  async updateChallenge(id,value){const row=(await sessions()).find(item=>item['Session ID']===id);if(!row)return;const meta={...notes(row),attempts:value.attempts};await writeSheetRange(`${SHEET}!F${row.row}:K${row.row}`,[[new Date().toISOString(),row['Device Token Hash'],value.status,row['Current Game'],row['Lineup State'],JSON.stringify(meta)]]);},
  async finalizeRegistration(registration,{makeParticipantId,verifiedAt}){return withParticipantWriter(registration.email,async()=>{
    const current=await participants();const returning=current.find(row=>normalized(row['Normalized Email']||row.Email)===registration.email&&participant(row));if(returning)return participant(returning);
    let id='';for(let attempt=0;attempt<8;attempt+=1){const proposed=makeParticipantId();if(!current.some(row=>row['Participant ID']===proposed)){id=proposed;break}}if(!id){const error=new Error('Unable to allocate a participant identity.');error.code='PARTICIPANT_ID_CONFLICT';throw error;}
    const note=JSON.stringify({formalName:{first:registration.firstName,last:registration.lastName},terms:{accepted:true,acceptedAt:verifiedAt,version:'PVFF-1.0'},registrationSource:'PUBLIC_SELF_REGISTRATION'});
    await appendSheetRow("'Participants'!A:K",[id,registration.displayName,registration.email,'NO',verifiedAt,note,registration.email,'','PENDING_FINALIZATION','REVIEW',id]);
    const after=await participants();const candidate=after.find(row=>row['Participant ID']===id);const emailMatches=after.filter(row=>normalized(row['Normalized Email']||row.Email)===registration.email);const teamMatches=after.filter(row=>normalized(row['Display Name'])===normalized(registration.displayName));
    if(!candidate||emailMatches.length!==1){const error=new Error('This email requires participant identity review.');error.code='DUPLICATE_EMAIL';throw error;}
    if(teamMatches.length!==1){const error=new Error('That Fantasy Team Name is unavailable. Choose another name and register again.');error.code='DUPLICATE_TEAM_NAME';throw error;}
    await writeSheetRange(`'Participants'!D${candidate.row}:K${candidate.row}`,[['YES',verifiedAt,note,registration.email,'','VERIFIED','CLEAR',id]]);
    return{id,displayName:registration.displayName,email:registration.email};
  })},
  async createSession(value){await appendSheetRow(`${SHEET}!A:K`,[value.id,value.participant.id,value.participant.displayName,value.participant.email,value.createdAt,value.createdAt,value.hash,'ACTIVE','','',JSON.stringify({expiresAt:value.expiresAt})]);},
  async findSessionByHash(hash){const row=(await sessions()).find(item=>item['Device Token Hash']===hash&&['ACTIVE','REVOKED'].includes(item.Status));if(!row)return null;return{id:row['Session ID'],participantId:row['Participant ID'],status:row.Status,expiresAt:notes(row).expiresAt};},
  async revokeSession(id){const row=(await sessions()).find(item=>item['Session ID']===id);if(row)await writeSheetRange(`${SHEET}!H${row.row}:H${row.row}`,[['REVOKED']]);},
};
async function sendCode({to,displayName,code,expiresMinutes}){const config=requiredAuthConfig();const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:config.from,to:[to],subject:'Your PV Fantasy Football verification code',text:`Hi ${displayName},\n\nYour PV Fantasy Football verification code is ${code}. It expires in ${expiresMinutes} minutes.\n\nIf you did not request this code, you can ignore this email.`})});if(!response.ok)throw new Error(`Participant verification email failed (${response.status}).`);}
export function participantAuthService(){const config=requiredAuthConfig();return createParticipantAuthService({repository,sendCode,secret:config.secret});}
