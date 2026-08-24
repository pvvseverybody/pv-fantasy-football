import test from 'node:test';
import assert from 'node:assert/strict';
import {publishGameWithDeps} from '../lib/publication-service-core.mjs';
import {PUBLIC_LEADERBOARD_HEADERS} from '../lib/publication-write-plan.mjs';

const NOW = '2026-08-30T05:00:00.000Z';

const gamesHeaders = [
  'Week',
  'Game ID',
  'Kickoff (CT)',
  'Opponent',
  'Home/Away',
  'Location',
  'Broadcast',
  'Unused H',
  'Unused I',
  'Pick Status',
  'Stats Final?',
  'Published At',
  'Schedule Source',
];

function gameRow({
  id='2026-W0',
  week='W0',
  pickStatus='LOCKED',
  publishedAt='',
} = {}) {
  return [
    week,
    id,
    '8/29/2026 8:00 PM',
    'Tarleton State',
    'AWAY',
    'Stephenville TX',
    'TBD',
    '',
    '',
    pickStatus,
    'YES',
    publishedAt,
    '',
  ];
}

function tables({
  pickStatus='LOCKED',
  publishedAt='',
  validation='VALID',
} = {}) {
  return {
    Games:[{
      'Game ID':'2026-W0',
      Week:'W0',
      'Pick Status':pickStatus,
      'Stats Final?':'YES',
      'Published At':publishedAt,
    }],
    WeeklyScores:[{
      'Game ID':'2026-W0',
      Week:'W0',
      'Participant ID':'PART-1',
      'Display Name':'Panther One',
      'Fantasy Score':78.1,
      'Weekly Rank':1,
      Validation:validation,
    }],
  };
}

function expectedPublicRow(points=78.1) {
  return [
    '2026-W0',
    'W0',
    1,
    1,
    'Panther One',
    points,
    points,
    points,
    'W0',
    'FINAL \u2022 OFFICIAL',
    NOW,
  ];
}

function buildDeps({
  readiness='READY',
  pickStatus='LOCKED',
  validation='VALID',
  verificationPoints=78.1,
} = {}) {
  let batchCalled = false;
  let batchRequests = null;
  let gateGameId = null;

  const preGames = [
    gamesHeaders,
    gameRow({pickStatus}),
  ];

  const postGames = [
    gamesHeaders,
    gameRow({pickStatus,publishedAt:NOW}),
  ];

  const prePublic = [
    [...PUBLIC_LEADERBOARD_HEADERS],
  ];

  const postPublic = [
    [...PUBLIC_LEADERBOARD_HEADERS],
    expectedPublicRow(verificationPoints),
  ];

  const deps = {
    async readGameDayTables() {
      return tables({pickStatus,validation});
    },

    evaluateReadiness() {
      return {
        readiness,
        reasons:readiness === 'READY' ? [] : ['PUBLICATION_HOLD'],
        diagnostics:[],
        lineups:{
          accepted_count:1,
          submission_status:pickStatus,
        },
      };
    },

    async readSheetRange(range) {
      if (range.includes('PublicLeaderboard')) {
        return batchCalled ? postPublic : prePublic;
      }

      if (range.includes("'Games'")) {
        return batchCalled ? postGames : preGames;
      }

      throw new Error(`Unexpected range: ${range}`);
    },

    async getSpreadsheetMetadata() {
      return {
        sheets:[
          {
            properties:{
              title:'PublicLeaderboard',
              sheetId:1225755667,
              gridProperties:{
                rowCount:1000,
                columnCount:11,
              },
            },
          },
          {
            properties:{
              title:'Games',
              sheetId:1846137327,
              gridProperties:{
                rowCount:100,
                columnCount:13,
              },
            },
          },
        ],
      };
    },

    async batchUpdateSpreadsheet(requests) {
      batchRequests = requests;
      batchCalled = true;
      return {replies:[]};
    },

    async withGameWriterGate(gameId, work) {
      gateGameId = gameId;
      return work();
    },
  };

  return {
    deps,
    get batchCalled() {
      return batchCalled;
    },
    get batchRequests() {
      return batchRequests;
    },
    get gateGameId() {
      return gateGameId;
    },
  };
}

test('publisher writes and verifies a READY and LOCKED game', async () => {
  const harness = buildDeps();

  const result = await publishGameWithDeps('2026-W0',{
    now:new Date(NOW),
    deps:harness.deps,
  });

  assert.equal(result.published,true);
  assert.equal(result.code,'PUBLICATION_PUBLISHED');
  assert.equal(result.game_id,'2026-W0');
  assert.equal(result.published_at,NOW);
  assert.equal(result.public_rows,1);
  assert.equal(result.publication_games,1);
  assert.equal(result.correction,false);

  assert.equal(harness.batchCalled,true);
  assert.equal(harness.gateGameId,'2026-W0');
  assert.equal(harness.batchRequests.length,2);

  assert.ok(harness.batchRequests[0].updateCells);
  assert.ok(harness.batchRequests[1].updateCells);
});

test('publisher fails closed when readiness is HOLD', async () => {
  const harness = buildDeps({readiness:'HOLD'});

  await assert.rejects(
    publishGameWithDeps('2026-W0',{
      now:new Date(NOW),
      deps:harness.deps,
    }),
    error => error.code === 'PUBLICATION_NOT_READY'
  );

  assert.equal(harness.batchCalled,false);
});

test('publisher independently requires Pick Status LOCKED', async () => {
  const harness = buildDeps({pickStatus:'OPEN'});

  await assert.rejects(
    publishGameWithDeps('2026-W0',{
      now:new Date(NOW),
      deps:harness.deps,
    }),
    error => error.code === 'PUBLICATION_LINEUPS_NOT_LOCKED'
  );

  assert.equal(harness.batchCalled,false);
});

test('publisher requires one valid WeeklyScores row for each accepted lineup', async () => {
  const harness = buildDeps({validation:'INVALID'});

  await assert.rejects(
    publishGameWithDeps('2026-W0',{
      now:new Date(NOW),
      deps:harness.deps,
    }),
    error => error.code === 'PUBLICATION_WEEKLY_SCORE_INCOMPLETE'
  );

  assert.equal(harness.batchCalled,false);
});

test('publisher does not report success when post-write PublicLeaderboard verification fails', async () => {
  const harness = buildDeps({verificationPoints:77});

  await assert.rejects(
    publishGameWithDeps('2026-W0',{
      now:new Date(NOW),
      deps:harness.deps,
    }),
    error => error.code === 'PUBLICATION_VERIFICATION_FAILED'
  );

  assert.equal(harness.batchCalled,true);
});

test('publisher rejects a blank game id before touching dependencies', async () => {
  const harness = buildDeps();

  await assert.rejects(
    publishGameWithDeps('   ',{
      now:new Date(NOW),
      deps:harness.deps,
    }),
    error => error.code === 'INVALID_PUBLICATION_GAME'
  );

  assert.equal(harness.batchCalled,false);
});
