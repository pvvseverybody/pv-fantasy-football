import 'server-only';
import {appendSheetRow,readSheetRange,writeSheetRange} from './google-sheets';
import {createParticipantAuthService,requiredAuthConfig} from './participant-auth.mjs';

const SHEET="'ParticipantSession'";
const parse=rows=>{if(!rows.length)return[];const [headers,...data]=rows;return data.map((row,index)=>({row:index+4,...Object.fromEntries(headers.map((header,i)=>[header,row[i]??'']))})).filter(row=>row['Session ID']);};
const notes=row=>{try{return JSON.parse(row.Notes||'{}')}catch{return{}}};
async function sessions(){return parse(await readSheetRange(`${SHEET}!A3:K2000`));}
async function participants(){const rows=await readSheetRange("'Participants'!A3:K1000");return parse(rows);}
function participant(row){if(!row||String(row.Active).toUpperCase()!=='YES'||String(row['Identity Status']).toUpperCase()!=='VERIFIED'||String(row['Duplicate Flag']).toUpperCase()!=='CLEAR')return null;return{id:row['Participant ID'],displayName:row['Display Name'],email:String(row['Normalized Email']||row.Email).trim().toLowerCase()};}
const repository={
  async findParticipantByEmail(email){return participant((await participants()).find(row=>[row['Normalized Email'],row.Email].some(value=>String(value||'').trim().toLowerCase()===email)));},
  async findParticipantById(id){return participant((await participants()).find(row=>row['Participant ID']===id));},
  async latestChallenge(id){return(await sessions()).filter(row=>row['Participant ID']===id&&row.Status==='PENDING').map(row=>({id:row['Session ID'],createdAt:row['Created At']})).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]||null;},
  async createChallenge(value){await appendSheetRow(`${SHEET}!A:K`,[value.id,value.participant.id,value.participant.displayName,value.participant.email,value.createdAt,value.createdAt,value.hash,'PENDING','','',JSON.stringify({expiresAt:value.expiresAt,attempts:value.attempts})]);},
  async findChallenge(id){const row=(await sessions()).find(item=>item['Session ID']===id);if(!row)return null;const meta=notes(row);return{id,hash:row['Device Token Hash'],status:row.Status,expiresAt:meta.expiresAt,attempts:meta.attempts,participant:{id:row['Participant ID'],displayName:row['Display Name'],email:row['Normalized Email']}};},
  async updateChallenge(id,value){const row=(await sessions()).find(item=>item['Session ID']===id);if(!row)return;const meta={...notes(row),attempts:value.attempts};await writeSheetRange(`${SHEET}!F${row.row}:K${row.row}`,[[new Date().toISOString(),row['Device Token Hash'],value.status,row['Current Game'],row['Lineup State'],JSON.stringify(meta)]]);},
  async createSession(value){await appendSheetRow(`${SHEET}!A:K`,[value.id,value.participant.id,value.participant.displayName,value.participant.email,value.createdAt,value.createdAt,value.hash,'ACTIVE','','',JSON.stringify({expiresAt:value.expiresAt})]);},
  async findSessionByHash(hash){const row=(await sessions()).find(item=>item['Device Token Hash']===hash&&['ACTIVE','REVOKED'].includes(item.Status));if(!row)return null;return{id:row['Session ID'],participantId:row['Participant ID'],status:row.Status,expiresAt:notes(row).expiresAt};},
  async revokeSession(id){const row=(await sessions()).find(item=>item['Session ID']===id);if(row)await writeSheetRange(`${SHEET}!H${row.row}:H${row.row}`,[['REVOKED']]);},
};
async function sendCode({to,displayName,code,expiresMinutes}){const config=requiredAuthConfig();const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:config.from,to:[to],subject:'Your PV Fantasy Football verification code',text:`Hi ${displayName},\n\nYour PV Fantasy Football verification code is ${code}. It expires in ${expiresMinutes} minutes.\n\nIf you did not request this code, you can ignore this email.`})});if(!response.ok)throw new Error(`Participant verification email failed (${response.status}).`);}
export function participantAuthService(){const config=requiredAuthConfig();return createParticipantAuthService({repository,sendCode,secret:config.secret});}
