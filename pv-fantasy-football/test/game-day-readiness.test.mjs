import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGameDayReadiness} from '../lib/game-day-readiness.mjs';

const GAME_ID = 'PV-2026-01';

function readyTables() {
  const players = Array.from({length: 8}, (_, index) => `PV-${index + 1}`);
  const submission = 'SUB-READY';
  return {
    Games: [{'Game ID': GAME_ID, Opponent: 'Opponent', 'Kickoff (CT)': '2026-08-27 18:00', 'Pick Status': 'LOCKED', 'Stats Final?': 'YES'}],
    FeedControl: [{'Game ID': GAME_ID, 'Feed Status': 'FINAL', 'Final?': 'YES', 'Poll Sec': 15}],
    RunnerState: [{'Game ID': GAME_ID, 'Last Game State': 'FINAL', 'Poll Sec': 15, 'Consecutive Errors': 0}],
    FeedSnapshots: [{'Game ID': GAME_ID, 'Captured At CT': '2026-08-27T22:00:00Z'}],
    IngestionLog: [{'Game ID': GAME_ID, 'Started At': '2026-08-27T22:00:05Z', Status: 'PASS'}],
    IngestionQA: [],
    SubmissionHistory: [{'Game ID': GAME_ID, 'Submission ID': submission, Status: 'ACCEPTED', 'On Time?': 'YES', 'Submitted CT': '2026-08-27T17:00:00Z'}],
    Picks: players.map((player, index) => ({'Game ID': GAME_ID, 'Submission ID': submission, 'Player ID': player, 'Slot ID': `S${index + 1}`, 'Valid?': 'YES', 'Scoring Version?': 'YES', 'Submission State': 'ACTIVE', 'Fantasy Points': index + 1})),
    Lineups: [{'Game ID': GAME_ID, 'Participant ID': 'PART-1', 'Submission ID': submission, 'Accepted?': 'YES', 'Scoring Version?': 'YES', 'Fantasy Score': 36}],
    ActiveLineups: [{'Game ID': GAME_ID, 'Participant ID': 'PART-1', 'Active Submission ID': submission, 'Accepted?': 'YES', 'Scoring Version?': 'YES', 'Fantasy Score': 36}],
    WeeklyScores: [{'Game ID': GAME_ID, 'Participant ID': 'PART-1', 'Fantasy Score': 36}],
    GameStats: players.map(player => ({'Game ID': GAME_ID, 'Player ID': player, 'Forced Fumble': 0, 'Fumble Recovery': 0, 'Def Return TD': 0})),
    PlayerScores: players.map((player, index) => ({'Game ID': GAME_ID, 'Player ID': player, TOTAL: index + 1})),
    Reconciliation: [{'Game ID': GAME_ID, 'Feed Final?': 'YES', 'Official Final?': 'YES', 'Stat Differences': 0, 'Unmatched Names': 0, 'QA Open Critical': 0, 'Reconciliation Status': 'PASS', 'Lock Status': 'READY_TO_LOCK'}],
    InvariantMonitor: [{Result: 'PASS', 'Blocks Scoring?': 'YES'}],
    WriterGate: [{'Test Result': 'PASS'}],
    ScoringGate: [{Result: 'PASS'}],
    ScoringE2E: [{Result: 'PASS'}],
    PublishControl: [{Control: 'OFFICIAL RELEASE', Status: 'PUBLISH'}],
  };
}

const evaluate = tables => evaluateGameDayReadiness(tables, GAME_ID, {now: new Date('2026-08-27T22:01:00Z')});

test('fully reconciled authoritative state is READY', () => {
  const status = evaluate(readyTables());
  assert.equal(status.readiness, 'READY');
  assert.deepEqual(status.reasons, []);
});

test('final state alone never makes publication ready', () => {
  const tables = readyTables();
  tables.Reconciliation[0]['Reconciliation Status'] = 'PENDING';
  tables.PublishControl[0].Status = 'HOLD';
  const status = evaluate(tables);
  assert.equal(status.readiness, 'HOLD');
  assert.ok(status.reasons.includes('PUBLICATION_HOLD'));
});

test('official final must be independently verified', () => {
  const tables = readyTables();
  tables.Reconciliation[0]['Official Final?'] = 'NO';
  const status = evaluate(tables);
  assert.equal(status.readiness, 'HOLD');
  assert.ok(status.reasons.includes('OFFICIAL_FINAL_NOT_VERIFIED'));
});

test('critical ingestion and identity failures block readiness', () => {
  const tables = readyTables();
  tables.IngestionQA.push({'Game ID': GAME_ID, 'Exception Type': 'AMBIGUOUS_PLAYER', Status: 'OPEN'});
  const status = evaluate(tables);
  assert.equal(status.readiness, 'BLOCKED');
  assert.ok(status.reasons.includes('ROSTER_IDENTITY_AMBIGUITY'));
});

test('missing or duplicate normalized stats block readiness', () => {
  const missing = readyTables();
  missing.GameStats.pop();
  assert.ok(evaluate(missing).reasons.includes('MISSING_NORMALIZED_STATS'));
  const duplicate = readyTables();
  duplicate.GameStats.push({...duplicate.GameStats[0]});
  assert.ok(evaluate(duplicate).reasons.includes('DUPLICATE_GAME_STATS'));
});

test('accepted scoring lineup must have exactly eight unique picks', () => {
  const tables = readyTables();
  tables.Picks.pop();
  const status = evaluate(tables);
  assert.equal(status.readiness, 'BLOCKED');
  assert.ok(status.reasons.includes('SCORING_PICK_COUNT'));
});

test('pick, player, and lineup score mismatches block readiness', () => {
  const tables = readyTables();
  tables.Picks[0]['Fantasy Points'] = 99;
  const status = evaluate(tables);
  assert.equal(status.readiness, 'BLOCKED');
  assert.ok(status.reasons.includes('SCORING_MISMATCH'));
  assert.ok(status.reasons.includes('LINEUP_TOTAL_MISMATCH'));
});

test('blocking invariant and scoring gates fail closed', () => {
  const invariant = readyTables();
  invariant.InvariantMonitor[0].Result = 'FAIL';
  assert.ok(evaluate(invariant).reasons.includes('WRITER_INVARIANT_FAILED'));
  const scoring = readyTables();
  scoring.ScoringGate[0].Result = 'FAIL';
  assert.ok(evaluate(scoring).reasons.includes('SCORING_GATE_FAILED'));
});

test('incomplete defensive fallback fields block official-final publication', () => {
  const tables = readyTables();
  tables.GameStats[0]['Fumble Recovery'] = '';
  const status = evaluate(tables);
  assert.equal(status.readiness, 'BLOCKED');
  assert.ok(status.reasons.includes('DEFENSIVE_FALLBACK_PENDING'));
});

test('missing game and backend control state fail closed', () => {
  assert.equal(evaluateGameDayReadiness({}, GAME_ID).readiness, 'BLOCKED');
  const tables = readyTables();
  tables.PublishControl = [];
  assert.equal(evaluate(tables).readiness, 'HOLD');
});
