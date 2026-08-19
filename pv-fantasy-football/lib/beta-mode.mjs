export const RELEASE_MODES=Object.freeze(['DEVELOPMENT','BETA','PUBLIC']);

export function evaluateReleaseMode(environment={}){
  const requested=String(environment.PV_FANTASY_RELEASE_MODE||'').trim().toUpperCase();
  const mode=RELEASE_MODES.includes(requested)?requested:'DEVELOPMENT';
  return{mode,configured:RELEASE_MODES.includes(requested),public_authorized:mode==='PUBLIC'};
}
