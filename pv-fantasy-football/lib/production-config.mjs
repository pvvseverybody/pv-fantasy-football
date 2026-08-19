const configured=value=>typeof value==='string'&&value.trim()!=='';
const item=(name,classification)=>({name,classification});

const checks={
  BACKEND_SPREADSHEET_ID:value=>/^[A-Za-z0-9_-]{20,}$/.test(value),
  GOOGLE_SERVICE_ACCOUNT_EMAIL:value=>/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/i.test(value),
  GOOGLE_PRIVATE_KEY:value=>{const normalized=value.replace(/\\n/g,'\n');return normalized.includes('-----BEGIN PRIVATE KEY-----')&&normalized.includes('-----END PRIVATE KEY-----');},
  SCORING_PIPELINE_SECRET:value=>value.length>=32,
  PV_ADMIN_USERNAME:value=>value.length>=3&&!/[\r\n:]/.test(value),
  PV_ADMIN_PASSWORD:value=>value.length>=16,
  PARTICIPANT_AUTH_SECRET:value=>value.length>=32,
  RESEND_API_KEY:value=>/^re_[A-Za-z0-9_-]+$/.test(value),
  PARTICIPANT_AUTH_FROM:value=>/^(?:[^<>\r\n]+\s*)?<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$|^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value),
};

export const REQUIRED_PRODUCTION_CONFIG=Object.freeze([
  item('BACKEND_SPREADSHEET_ID','workbook'),item('GOOGLE_SERVICE_ACCOUNT_EMAIL','workbook'),item('GOOGLE_PRIVATE_KEY','workbook'),
  item('SCORING_PIPELINE_SECRET','scoring'),item('PV_ADMIN_USERNAME','admin'),item('PV_ADMIN_PASSWORD','admin'),
  item('PARTICIPANT_AUTH_SECRET','participant_auth'),item('RESEND_API_KEY','participant_auth'),item('PARTICIPANT_AUTH_FROM','participant_auth'),
]);

export function evaluateProductionConfig(environment={}){
  const items=REQUIRED_PRODUCTION_CONFIG.map(({name,classification})=>{
    const raw=environment[name];
    const status=!configured(raw)?'MISSING':checks[name](String(raw).trim())?'CONFIGURED':'INVALID_CONFIGURATION';
    return{name,classification,status};
  });
  const groups=Object.fromEntries(['workbook','scoring','admin','participant_auth'].map(group=>[group,items.filter(entry=>entry.classification===group).every(entry=>entry.status==='CONFIGURED')?'CONFIGURED':'CONFIGURATION_REQUIRED']));
  return{status:items.every(entry=>entry.status==='CONFIGURED')?'CONFIGURED':'CONFIGURATION_REQUIRED',items,groups};
}
