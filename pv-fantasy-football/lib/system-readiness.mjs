const upper=value=>String(value??'').trim().toUpperCase();

export function evaluateSystemReadiness({configuration,connectivity,preflight,gameReadiness,releaseMode={mode:'DEVELOPMENT'},betaAcceptance={status:'PENDING'},deploymentSafety={status:'SAFE'}}={}){
  const reasons=[];
  if(configuration?.status!=='CONFIGURED')reasons.push('PRODUCTION_CONFIGURATION_REQUIRED');
  if(connectivity?.status==='UNAVAILABLE')reasons.push('WORKBOOK_UNAVAILABLE');
  if(connectivity?.schema?.status==='INCOMPATIBLE')reasons.push('WORKBOOK_SCHEMA_INCOMPATIBLE');
  if(preflight?.status==='BLOCKED')reasons.push('SEASON_PREFLIGHT_BLOCKED');
  if(preflight?.status==='HOLD')reasons.push('SEASON_PREFLIGHT_HOLD');
  if(!gameReadiness)reasons.push('GAME_READINESS_UNAVAILABLE');
  if(deploymentSafety.status!=='SAFE')reasons.push('DEPLOYMENT_CONFIGURATION_BLOCKED');
  const publication=upper(gameReadiness?.publication?.status)||'UNKNOWN';
  const hardBlocked=reasons.some(reason=>['WORKBOOK_UNAVAILABLE','WORKBOOK_SCHEMA_INCOMPATIBLE','SEASON_PREFLIGHT_BLOCKED','DEPLOYMENT_CONFIGURATION_BLOCKED'].includes(reason));
  let status;
  if(configuration?.status!=='CONFIGURED')status='CONFIGURATION REQUIRED';
  else if(hardBlocked)status='BLOCKED';
  else if(preflight?.status!=='READY')status='PRESEASON HOLD';
  else if(releaseMode.mode==='DEVELOPMENT')status='PRESEASON HOLD';
  else if(releaseMode.mode==='BETA'||betaAcceptance.status!=='PASS')status='READY FOR BETA';
  else if(releaseMode.mode==='PUBLIC'&&betaAcceptance.status==='PASS')status='READY FOR PUBLIC ENTRY';
  else status='READY FOR BETA';
  return{
    status,
    safe_to_open_to_participants:status==='READY FOR PUBLIC ENTRY',
    reasons,
    configuration:configuration||{status:'CONFIGURATION_REQUIRED'},
    sheets:{status:connectivity?.status||'UNAVAILABLE',schema_status:connectivity?.schema?.status||'UNKNOWN'},
    participant_auth:configuration?.groups?.participant_auth||'CONFIGURATION_REQUIRED',
    scoring:configuration?.groups?.scoring||'CONFIGURATION_REQUIRED',
    season_preflight:preflight?.status||'BLOCKED',
    game_readiness:gameReadiness?.readiness||'BLOCKED',
    publication,
    release_mode:releaseMode.mode,
    beta_acceptance:betaAcceptance.status,
    deployment_safety:deploymentSafety.status,
    note:status==='READY FOR BETA'?'Code-verifiable prerequisites pass. Human beta acceptance is still required before public entry.':undefined,
  };
}
