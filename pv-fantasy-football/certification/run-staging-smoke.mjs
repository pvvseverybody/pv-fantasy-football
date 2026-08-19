import {evaluateDeploymentSafety} from '../lib/deployment-safety.mjs';

const environment=process.env;
const safety=evaluateDeploymentSafety(environment);
const baseUrl=String(environment.PV_FANTASY_STAGING_URL||'').trim().replace(/\/$/,'');
const username=String(environment.PV_ADMIN_USERNAME||'');
const password=String(environment.PV_ADMIN_PASSWORD||'');

function stop(message){throw new Error(message)}
if(safety.environment!=='staging'||safety.status!=='SAFE'||safety.release_mode!=='BETA')stop('Refusing smoke test: an explicitly safe STAGING/BETA environment with a pinned isolated workbook is required.');
if(!baseUrl)stop('PV_FANTASY_STAGING_URL is required.');
const parsed=new URL(baseUrl);
if(parsed.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(parsed.hostname))stop('Staging URL must use HTTPS (localhost is allowed for local verification).');
if(!username||!password)stop('PV_ADMIN_USERNAME and PV_ADMIN_PASSWORD are required for protected staging checks.');

const authorization=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
async function request(path,{admin=false,expectedStatus=200}={}){
  const response=await fetch(`${baseUrl}${path}`,{headers:admin?{Authorization:authorization}:{}});
  let body;try{body=await response.json()}catch{body=null}
  if(response.status!==expectedStatus)stop(`${path} returned ${response.status}; expected ${expectedStatus}.`);
  return body;
}

const health=await request('/api/health');
if(health?.status!=='ok'||health?.environment!=='staging'||health?.release_mode!=='BETA'||health?.deployment_safety!=='SAFE')stop('Health response does not identify a safe STAGING/BETA deployment.');
for(const forbidden of ['workbook','spreadsheet','service_account','email','secret','private_key'])if(JSON.stringify(health).toLowerCase().includes(forbidden))stop(`Health response contains forbidden detail: ${forbidden}.`);

await request('/api/admin/preflight',{expectedStatus:401});
const [preflight,system,opening,game]=await Promise.all([
  request('/api/admin/preflight',{admin:true}),
  request('/api/admin/system-readiness',{admin:true}),
  request('/api/admin/public-opening',{admin:true}),
  request('/api/admin/readiness?game_id=2026-W0',{admin:true}),
]);
if(!['READY','HOLD'].includes(preflight?.status))stop(`Season preflight is not usable: ${preflight?.status||'UNKNOWN'}.`);
if(system?.configuration?.status!=='CONFIGURED'||system?.deployment_safety!=='SAFE'||system?.sheets?.status==='UNAVAILABLE'||system?.sheets?.schema_status!=='COMPATIBLE')stop('System readiness reports missing configuration, workbook/schema failure, or unsafe deployment isolation.');
if(!['BLOCKED','READY_FOR_STAGING','READY_FOR_PUBLIC_AUTHORIZATION'].includes(opening?.status))stop('Public-opening gate returned an unknown status.');
if(opening?.public_authorized===true||opening?.status==='PUBLIC')stop('Staging must never claim public authorization.');
if(game?.game_id!=='2026-W0')stop('Game-day readiness did not resolve 2026-W0.');

const session=await request('/api/auth/session',{expectedStatus:401});
if(session?.authenticated!==false)stop('Unauthenticated staging session check did not fail closed.');

console.log(JSON.stringify({status:'PASS',environment:'staging',release_mode:'BETA',version:health.version,checks:{health:'PASS',admin_auth:'PASS',workbook_preflight:preflight.status,system_readiness:system.readiness||system.status||'AVAILABLE',public_opening:opening.status,w0_game:game.game_id,participant_auth:'AVAILABLE'}},null,2));
