import {createPublicKey,verify} from 'node:crypto';

const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='pv-fantasy-week-1';
const REPOSITORY='pvvseverybody/pv-fantasy-football';
const WORKFLOW_REF='pvvseverybody/pv-fantasy-football/.github/workflows/week-1-automation.yml@refs/heads/main';
let cachedKeys=null,cachedAt=0;

const decode=value=>JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
async function keys(fetchImpl){
  if(cachedKeys&&Date.now()-cachedAt<60*60*1000)return cachedKeys;
  const response=await fetchImpl(`${ISSUER}/.well-known/jwks`,{headers:{accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('Unable to load GitHub Actions signing keys.');
  cachedKeys=(await response.json()).keys||[];cachedAt=Date.now();return cachedKeys;
}

export async function verifyWeek1GithubToken(token,{fetchImpl=fetch,now=Math.floor(Date.now()/1000)}={}){
  const parts=String(token||'').split('.');if(parts.length!==3)return false;
  let header,claims;try{header=decode(parts[0]);claims=decode(parts[1]);}catch{return false;}
  if(header.alg!=='RS256'||!header.kid)return false;
  if(claims.iss!==ISSUER||claims.aud!==AUDIENCE||claims.repository!==REPOSITORY||claims.workflow_ref!==WORKFLOW_REF)return false;
  if(claims.ref!=='refs/heads/main'||!['schedule','workflow_dispatch'].includes(claims.event_name))return false;
  if(!Number.isFinite(Number(claims.exp))||Number(claims.exp)<now||Number(claims.iat)>now+60)return false;
  const jwk=(await keys(fetchImpl)).find(item=>item.kid===header.kid);if(!jwk)return false;
  try{return verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url'));}catch{return false;}
}

export {AUDIENCE,ISSUER};
