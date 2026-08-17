import 'server-only';
import {readSheetRange} from './google-sheets';
import {evaluateGameDayReadiness} from './game-day-readiness.mjs';

const RANGES = {
  Games: "'Games'!A3:M100",
  FeedControl: "'FeedControl'!A3:N200",
  RunnerState: "'RunnerState'!A3:N200",
  FeedSnapshots: "'FeedSnapshots'!A3:L2000",
  IngestionLog: "'IngestionLog'!A3:L2000",
  IngestionQA: "'IngestionQA'!A3:N2000",
  SubmissionHistory: "'SubmissionHistory'!A3:P2000",
  Picks: "'Picks'!A3:O3000",
  Lineups: "'Lineups'!A3:U1000",
  ActiveLineups: "'ActiveLineups'!A3:N1000",
  WeeklyScores: "'WeeklyScores'!A3:H1000",
  GameStats: "'GameStats'!A3:Z2000",
  PlayerScores: "'PlayerScores'!A3:V2000",
  Reconciliation: "'Reconciliation'!A3:N1000",
  InvariantMonitor: "'InvariantMonitor'!A3:L1000",
  WriterGate: "'WriterGate'!A3:P1000",
  ScoringGate: "'ScoringGate'!A3:N1000",
  ScoringE2E: "'ScoringE2E'!A3:R1000",
  PublishControl: "'PublishControl'!A3:N200",
};

function records(rows) {
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter(row => row.some(value => value !== '')).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
  );
}

export async function readGameDayTables() {
  const entries = await Promise.all(Object.entries(RANGES).map(async ([name, range]) => {
    const rows = await readSheetRange(range);
    return [name, records(rows)];
  }));
  return Object.fromEntries(entries);
}

export async function getGameDayStatus(gameId) {
  const tables = await readGameDayTables();
  return evaluateGameDayReadiness(tables, gameId);
}

export function availableGames(tables) {
  return (tables.Games || []).map(game => ({
    game_id: String(game['Game ID'] || ''),
    opponent: game.Opponent || '',
    kickoff_ct: game['Kickoff (CT)'] || '',
  })).filter(game => game.game_id);
}
