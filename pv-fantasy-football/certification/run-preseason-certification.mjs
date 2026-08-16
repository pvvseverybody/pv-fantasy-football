import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
  certifyReconciliation, createCertificationStore, ingestNormalizedStats,
  scoreCertificationGame, snapshotCertificationState, submitCertificationLineup,
} from '../lib/preseason-certification.mjs';
import {
  expectedLeaderboard, expectedPlayerScores, expectedWeeklyScores, games,
  normalizedStats, participants, submissions,
} from '../test/fixtures/preseason-certification.mjs';

function sameNumber(actual, expected) {
  return Math.abs(Number(actual) - Number(expected)) < 0.0001;
}

function runMainScenario() {
  const store = createCertificationStore({participants,games});
  ingestNormalizedStats(store, normalizedStats);
  submissions.forEach(submission => submitCertificationLineup(store, submission));
  games.forEach(game => scoreCertificationGame(store, game.id));
  const firstSnapshot = snapshotCertificationState(store);

  ingestNormalizedStats(store, normalizedStats);
  submissions.forEach(submission => submitCertificationLineup(store, submission));
  games.forEach(game => scoreCertificationGame(store, game.id));
  const secondSnapshot = snapshotCertificationState(store);
  return {store, firstSnapshot, secondSnapshot};
}

function missingStatsProbe() {
  const store = createCertificationStore({participants,games});
  const withoutSharedPlayer = normalizedStats.filter(row => !(row.gameId === 'CERT-W1' && row.playerId === 'P1'));
  ingestNormalizedStats(store, withoutSharedPlayer);
  submissions.filter(item => item.gameId === 'CERT-W1').forEach(item => submitCertificationLineup(store,item));
  let error;
  try {
    scoreCertificationGame(store,'CERT-W1');
  } catch (caught) {
    error = caught;
  }
  return {
    blocked:error?.code === 'MISSING_PLAYER_STAT_LINE',
    code:error?.code || null,
    publication:store.publishControl.get('CERT-W1') || 'HOLD',
    playerScoreRows:store.playerScores.size,
    weeklyRows:store.weeklyScores.size,
    leaderboardRows:store.leaderboard.length,
  };
}

export function runPreseasonCertification() {
  const {store,firstSnapshot,secondSnapshot} = runMainScenario();
  const reconciliation = certifyReconciliation(store);
  const playerResults = [];
  for (const [gameId,expectedPlayers] of Object.entries(expectedPlayerScores)) {
    for (const [playerId,expected] of Object.entries(expectedPlayers)) {
      const actual = store.playerScores.get(`${gameId}|${playerId}`)?.total;
      playerResults.push({gameId,playerId,expected,actual,pass:sameNumber(actual,expected)});
    }
  }
  const weeklyResults = [];
  for (const [gameId,expectedParticipants] of Object.entries(expectedWeeklyScores)) {
    for (const [participantId,expected] of Object.entries(expectedParticipants)) {
      const actual = store.weeklyScores.get(`${gameId}|${participantId}`)?.fantasyScore;
      weeklyResults.push({gameId,participantId,expected,actual,pass:sameNumber(actual,expected)});
    }
  }
  const leaderboardResults = expectedLeaderboard.map((expected,index) => {
    const actual = store.leaderboard[index];
    return {
      rank:index + 1, expectedParticipant:expected.participantId,
      actualParticipant:actual?.participantId, expectedTotal:expected.total,
      actualTotal:actual?.total,
      pass:actual?.participantId === expected.participantId && sameNumber(actual?.total,expected.total),
    };
  });
  const alphaHistory = store.submissionHistory.get('SUB-A-W1-V1');
  const alphaActive = store.activeLineups.get('CERT-W1|CERT-A');
  const late = store.submissionHistory.get('SUB-B-W1-LATE');
  const latePicks = [...store.picks.values()].filter(item => item.submissionId === 'SUB-B-W1-LATE');
  const sharedPicks = [...store.picks.values()].filter(item => item.gameId === 'CERT-W1' && item.playerId === 'P1' && item.scoringVersion);
  const missingProbe = missingStatsProbe();
  const invariantChecks = [
    {name:'Shared player score reused by both participants',pass:sharedPicks.length === 2 && sharedPicks.every(item => sameNumber(item.fantasyScore,22)),detail:`${sharedPicks.length} active P1 picks at 22 points`},
    {name:'Newest accepted Alpha lineup is active',pass:alphaHistory.state === 'SUPERSEDED' && !alphaHistory.scoringVersion && alphaActive.submissionId === 'SUB-A-W1-V2',detail:`active=${alphaActive.submissionId}; prior=${alphaHistory.state}`},
    {name:'Late submission never scores',pass:late.state === 'REJECTED_LATE' && !late.scoringVersion && latePicks.length === 0,detail:`state=${late.state}; picks=${latePicks.length}`},
    {name:'Kick/punt return TD excluded end-to-end',pass:sameNumber(store.playerScores.get('CERT-W1|P7').total,0),detail:`P7 total=${store.playerScores.get('CERT-W1|P7').total}`},
    {name:'Reconciliation matches eight picks to lineup and weekly totals',pass:reconciliation.length === 4 && reconciliation.every(item => item.pass),detail:`${reconciliation.filter(item => item.pass).length}/${reconciliation.length} participant-games reconciled`},
    {name:'Rerun is idempotent',pass:JSON.stringify(firstSnapshot) === JSON.stringify(secondSnapshot),detail:`records unchanged after second ingestion/submission/scoring run`},
    {name:'Missing normalized player row blocks scoring and publication',pass:missingProbe.blocked && missingProbe.publication === 'HOLD' && missingProbe.playerScoreRows === 0 && missingProbe.weeklyRows === 0 && missingProbe.leaderboardRows === 0,detail:`${missingProbe.code}; scores=${missingProbe.playerScoreRows}; publish=${missingProbe.publication}`},
    {name:'Raw fixture provenance and excluded return stats preserved',pass:store.rawSourceStats.get('CERT-W1|P7').kickReturnTouchdowns === 1 && store.rawSourceStats.get('CERT-W1|P7').puntReturnTouchdowns === 1,detail:'raw kick/punt return TD values retained for audit'},
    {name:'All fixture games reconciled before publication',pass:games.every(game => store.reconciliation.get(game.id)?.status === 'PASS' && store.publishControl.get(game.id) === 'PUBLISH'),detail:'isolated fixture reconciliation PASS; isolated publish gates PUBLISH'},
  ];
  const pass = playerResults.every(item => item.pass) && weeklyResults.every(item => item.pass) &&
    leaderboardResults.every(item => item.pass) && invariantChecks.every(item => item.pass);
  return {pass,playerResults,weeklyResults,leaderboardResults,reconciliation,invariantChecks,missingProbe,firstSnapshot,secondSnapshot};
}

function mark(pass) {
  return pass ? 'PASS' : 'FAIL';
}

export function renderCertificationReport(result) {
  const lines = [
    '# PV Fantasy Football 1.0 — Preseason Certification',
    '',
    `Overall result: **${mark(result.pass)}**`,
    '',
    'Scope: isolated fixtures only. No production workbook tables or live scoring endpoints were used.',
    '',
    'Certified path: normalized source stats → GameStats → PlayerScores → accepted scoring-version Picks → Lineups → ActiveLineups → WeeklyScores → Leaderboard.',
    '',
    '## Player score reconciliation',
    '',
    '| Game | Player | Expected | Actual | Result |',
    '|---|---:|---:|---:|---|',
    ...result.playerResults.map(item => `| ${item.gameId} | ${item.playerId} | ${item.expected.toFixed(1)} | ${Number(item.actual).toFixed(1)} | ${mark(item.pass)} |`),
    '',
    '## Participant weekly scores',
    '',
    '| Game | Participant | Expected | Actual | Result |',
    '|---|---|---:|---:|---|',
    ...result.weeklyResults.map(item => `| ${item.gameId} | ${item.participantId} | ${item.expected.toFixed(1)} | ${Number(item.actual).toFixed(1)} | ${mark(item.pass)} |`),
    '',
    '## Cumulative leaderboard',
    '',
    '| Rank | Expected participant | Actual participant | Expected total | Actual total | Result |',
    '|---:|---|---|---:|---:|---|',
    ...result.leaderboardResults.map(item => `| ${item.rank} | ${item.expectedParticipant} | ${item.actualParticipant} | ${item.expectedTotal.toFixed(1)} | ${Number(item.actualTotal).toFixed(1)} | ${mark(item.pass)} |`),
    '',
    '## Eight-pick reconciliation',
    '',
    '| Game | Participant | Accepted submission | Picks | Pick sum | Lineup | Weekly | Result |',
    '|---|---|---|---:|---:|---:|---:|---|',
    ...result.reconciliation.map(item => `| ${item.gameId} | ${item.participantId} | ${item.acceptedSubmissionId} | ${item.pickCount} | ${item.pickSum.toFixed(1)} | ${item.lineupScore.toFixed(1)} | ${item.weeklyScore.toFixed(1)} | ${mark(item.pass)} |`),
    '',
    '## Invariant and gate checks',
    '',
    '| Check | Detail | Result |',
    '|---|---|---|',
    ...result.invariantChecks.map(item => `| ${item.name} | ${item.detail} | ${mark(item.pass)} |`),
    '',
    '## Remaining live-certification boundary',
    '',
    '- This report satisfies an isolated preseason logic certification comparable to the workbook’s ScoringE2E and invariant checks.',
    '- It does not replace PVFeedCertification L2/L3, a live provider transport test, final-book reconciliation, or commissioner-controlled PublishControl.',
    '- A real PV game still requires provider discovery, changing snapshot polling, correction handling, final detection, official reconciliation, and polling shutdown proof.',
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const result = runPreseasonCertification();
  const reportPath = resolve(dirname(fileURLToPath(import.meta.url)),'..','reports','preseason-certification.md');
  await mkdir(dirname(reportPath),{recursive:true});
  await writeFile(reportPath,renderCertificationReport(result),'utf8');
  process.stdout.write(`Preseason certification: ${result.pass ? 'PASS' : 'FAIL'}\nReport: ${reportPath}\n`);
  if (!result.pass) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
