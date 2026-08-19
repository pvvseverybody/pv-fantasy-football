const upper=value=>String(value??'').trim().toUpperCase();
const placeholder=value=>/^(CHANGEME|PLACEHOLDER|EXAMPLE|TODO|TEST|SECRET|PASSWORD)$/i.test(String(value??'').trim())||/your[-_ ]?(key|secret|password|project)/i.test(String(value??''));
export const DEPLOYMENT_ENVIRONMENTS=Object.freeze(['development','staging','production']);

export function evaluateDeploymentSafety(environment={}){
  const requested=String(environment.PV_FANTASY_ENV||'').trim().toLowerCase();const classification=DEPLOYMENT_ENVIRONMENTS.includes(requested)?requested:'development';const releaseMode=upper(environment.PV_FANTASY_RELEASE_MODE)||'DEVELOPMENT';const blockers=[];
  if(releaseMode==='PUBLIC'&&classification!=='production')blockers.push('PUBLIC_MODE_REQUIRES_PRODUCTION_ENVIRONMENT');
  if(classification==='production'&&requested!=='production')blockers.push('PRODUCTION_ENVIRONMENT_MUST_BE_EXPLICIT');
  if(classification==='production'&&environment.NODE_ENV!=='production')blockers.push('PRODUCTION_REQUIRES_NODE_PRODUCTION');
  if(classification==='production'&&environment.VERCEL_ENV&&environment.VERCEL_ENV!=='production')blockers.push('PRODUCTION_VERCEL_SCOPE_MISMATCH');
  const sensitive=['GOOGLE_PRIVATE_KEY','SCORING_PIPELINE_SECRET','PV_ADMIN_PASSWORD','PARTICIPANT_AUTH_SECRET','RESEND_API_KEY'];if(classification==='production'&&sensitive.some(name=>placeholder(environment[name])))blockers.push('PRODUCTION_PLACEHOLDER_CONFIGURATION');
  const backend=String(environment.BACKEND_SPREADSHEET_ID||'').trim(),staging=String(environment.PV_FANTASY_STAGING_SPREADSHEET_ID||'').trim(),production=String(environment.PV_FANTASY_PRODUCTION_SPREADSHEET_ID||'').trim();
  if(classification==='staging'&&(!staging||backend!==staging))blockers.push('STAGING_WORKBOOK_NOT_EXPLICITLY_PINNED');
  if(classification==='staging'&&production&&backend===production)blockers.push('STAGING_POINTS_TO_PRODUCTION_WORKBOOK');
  if(classification==='production'&&production&&backend!==production)blockers.push('PRODUCTION_WORKBOOK_MARKER_MISMATCH');
  return{status:blockers.length?'BLOCKED':'SAFE',environment:classification,release_mode:releaseMode,blockers};
}
