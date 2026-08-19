import OfficialLogo from './OfficialLogo';

export default function MatchupBranding({game,compact=false}){
  const opponent=game?.opponent||'Opponent';
  return <div className={`matchupBranding ${compact?'compact':''}`}>
    <div><OfficialLogo kind="pvamu" compact={compact}/><strong>PVAMU</strong></div>
    <b>VS</b>
    <div><OfficialLogo kind="opponent" opponent={opponent} compact={compact}/><strong>{opponent}</strong></div>
  </div>;
}
