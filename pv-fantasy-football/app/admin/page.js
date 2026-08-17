import {availableGames, readGameDayTables} from '../../lib/game-day-status';
import {evaluateGameDayReadiness} from '../../lib/game-day-readiness.mjs';

export const dynamic = 'force-dynamic';

const display = value => value === null || value === undefined || value === '' ? 'Not recorded' : String(value);

export default async function AdminPage({searchParams}) {
  let tables;
  try {
    tables = await readGameDayTables();
  } catch {
    return <main className="adminPage"><section className="adminHero"><p className="eyebrow">INTERNAL • READ ONLY</p><h1>Game-day operations</h1><div className="adminAlert blocked"><strong>BLOCKED</strong><p>Authoritative workbook state is unavailable. Verify server credentials and Sheets access.</p></div></section></main>;
  }
  const games = availableGames(tables);
  const requested = (await searchParams)?.game_id;
  const gameId = games.some(game => game.game_id === requested) ? requested : games[0]?.game_id || '';
  const status = evaluateGameDayReadiness(tables, gameId);
  const cards = [
    ['Game / opponent', `${display(status.game?.game_id)} / ${display(status.game?.opponent)}`],
    ['Scheduled kickoff', display(status.game?.kickoff_ct)],
    ['Current game state', display(status.game?.state)],
    ['Lineup submission status', display(status.lineups?.submission_status)],
    ['Accepted lineups', display(status.lineups?.accepted_count)],
    ['Rejected / late submissions', display(status.lineups?.rejected_or_late_count)],
    ['Latest feed snapshot', display(status.feed?.latest_snapshot_time)],
    ['Feed health', display(status.feed?.health)],
    ['Latest ingestion', display(status.feed?.latest_ingestion_time)],
    ['Normalized players', display(status.stats?.normalized_player_count)],
    ['Unmatched / ambiguous identities', display(status.stats?.identity_issue_count)],
    ['Scoring status', display(status.scoring?.status)],
    ['Reconciliation status', display(status.reconciliation?.status)],
    ['Official final', status.reconciliation?.official_final ? 'VERIFIED' : 'NOT VERIFIED'],
    ['Publication status', display(status.publication?.status)],
    ['Last successful pipeline action', status.last_successful_pipeline_action ? `${status.last_successful_pipeline_action.action} • ${status.last_successful_pipeline_action.at}` : 'Not recorded'],
  ];

  return <main className="adminPage">
    <section className="adminHero">
      <p className="eyebrow">INTERNAL • READ ONLY</p><h1>Game-day operations</h1>
      <p>Authoritative status assembled from the existing workbook gates and pipeline tables.</p>
      <form className="adminSelector" method="get"><label><span>Selected game</span><select name="game_id" defaultValue={gameId}>{games.map(game=><option key={game.game_id} value={game.game_id}>{game.game_id} — {game.opponent}</option>)}</select></label><button type="submit">View status</button></form>
      <div className={`adminReadiness ${status.readiness.toLowerCase()}`}><span>READINESS</span><strong>{status.readiness}</strong></div>
    </section>
    <section><h2>Status</h2><div className="adminGrid">{cards.map(([label,value])=><article className="adminCard" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div></section>
    <section><h2>Active blockers and diagnostics</h2>{status.diagnostics.length ? <div className="diagnosticList">{status.diagnostics.map((item,index)=><article className={`diagnostic ${item.severity.toLowerCase()}`} key={`${item.code}-${index}`}><div><strong>{item.code}</strong><span>{item.severity}</span></div><p>{item.message}</p><small>Recommended action: {item.recommended_action}</small></article>)}</div> : <div className="adminAlert ready"><strong>No active diagnostics</strong><p>All required signals are presently satisfied.</p></div>}</section>
  </main>;
}
