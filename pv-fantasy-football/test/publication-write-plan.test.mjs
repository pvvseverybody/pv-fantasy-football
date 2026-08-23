import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicationWritePlan,
  PUBLIC_LEADERBOARD_HEADERS,
} from '../lib/publication-write-plan.mjs';

const snapshot = ({
  gameId='2026-W0',
  week='W0',
  participant='Panther One',
  weeklyRank=1,
  seasonRank=1,
  weekPoints=78.1,
  seasonPoints=78.1,
  average=78.1,
  bestWeek='W0',
  publishedAt='2026-08-30T05:00:00.000Z',
} = {}) => ({
  'Game ID':gameId,
  Week:week,
  'Weekly Rank':weeklyRank,
  'Season Rank':seasonRank,
  Participant:participant,
  'Week Points':weekPoints,
  'Season Points':seasonPoints,
  Average:average,
  'Best Week':bestWeek,
  Status:'FINAL \u2022 OFFICIAL',
  'Published At':publishedAt,
});

test('planner writes the replacement public snapshot and Games Published At atomically', () => {
  const plan = buildPublicationWritePlan({
    publicSheetId:122,
    gamesSheetId:184,
    gamesRowNumber:4,
    currentPublicGridRowCount:1000,
    existingPublicDataRowCount:0,
    snapshotRows:[snapshot()],
    publishedAt:'2026-08-30T05:00:00.000Z',
  });

  assert.equal(plan.requests.length,2);
  assert.equal(plan.expanded_by_rows,0);

  const publicWrite = plan.requests[0].updateCells;
  assert.deepEqual(publicWrite.range,{
    sheetId:122,
    startRowIndex:3,
    endRowIndex:4,
    startColumnIndex:0,
    endColumnIndex:PUBLIC_LEADERBOARD_HEADERS.length,
  });

  assert.equal(
    publicWrite.rows[0].values[0].userEnteredValue.stringValue,
    '2026-W0'
  );
  assert.equal(
    publicWrite.rows[0].values[5].userEnteredValue.numberValue,
    78.1
  );

  const gameWrite = plan.requests[1].updateCells;
  assert.deepEqual(gameWrite.range,{
    sheetId:184,
    startRowIndex:3,
    endRowIndex:4,
    startColumnIndex:11,
    endColumnIndex:12,
  });
  assert.equal(
    gameWrite.rows[0].values[0].userEnteredValue.stringValue,
    '2026-08-30T05:00:00.000Z'
  );
});

test('planner clears stale PublicLeaderboard rows when a replacement shrinks', () => {
  const plan = buildPublicationWritePlan({
    publicSheetId:122,
    gamesSheetId:184,
    gamesRowNumber:4,
    currentPublicGridRowCount:1000,
    existingPublicDataRowCount:3,
    snapshotRows:[snapshot()],
    publishedAt:'2026-08-30T05:00:00.000Z',
  });

  const publicWrite = plan.requests[0].updateCells;

  assert.equal(plan.replacement_row_count,3);
  assert.equal(publicWrite.rows.length,3);
  assert.equal(
    publicWrite.rows[0].values[4].userEnteredValue.stringValue,
    'Panther One'
  );

  for (const staleRow of publicWrite.rows.slice(1)) {
    assert.equal(staleRow.values.length,PUBLIC_LEADERBOARD_HEADERS.length);
    assert.ok(
      staleRow.values.every(
        cell => cell.userEnteredValue.stringValue === ''
      )
    );
  }
});

test('planner expands PublicLeaderboard before writing beyond its current grid', () => {
  const rows = Array.from({length:1001},(_,index) => snapshot({
    participant:`Panther ${index + 1}`,
    seasonRank:index + 1,
  }));

  const plan = buildPublicationWritePlan({
    publicSheetId:122,
    gamesSheetId:184,
    gamesRowNumber:4,
    currentPublicGridRowCount:1000,
    existingPublicDataRowCount:0,
    snapshotRows:rows,
    publishedAt:'2026-08-30T05:00:00.000Z',
  });

  assert.equal(plan.required_public_grid_row_count,1004);
  assert.equal(plan.expanded_by_rows,4);
  assert.equal(plan.requests.length,3);

  assert.deepEqual(plan.requests[0],{
    appendDimension:{
      sheetId:122,
      dimension:'ROWS',
      length:4,
    },
  });

  assert.equal(
    plan.requests[1].updateCells.range.endRowIndex,
    1004
  );
});

test('planner preserves numeric public fields as numeric Sheets values', () => {
  const plan = buildPublicationWritePlan({
    publicSheetId:122,
    gamesSheetId:184,
    gamesRowNumber:4,
    currentPublicGridRowCount:1000,
    existingPublicDataRowCount:0,
    snapshotRows:[snapshot({
      weeklyRank:'',
      weekPoints:0,
      seasonPoints:-2,
      average:-1,
    })],
    publishedAt:'2026-08-30T05:00:00.000Z',
  });

  const values = plan.requests[0].updateCells.rows[0].values;

  assert.equal(values[2].userEnteredValue.stringValue,'');
  assert.equal(values[5].userEnteredValue.numberValue,0);
  assert.equal(values[6].userEnteredValue.numberValue,-2);
  assert.equal(values[7].userEnteredValue.numberValue,-1);
});

test('planner fails closed on an invalid publication timestamp', () => {
  assert.throws(
    () => buildPublicationWritePlan({
      publicSheetId:122,
      gamesSheetId:184,
      gamesRowNumber:4,
      currentPublicGridRowCount:1000,
      existingPublicDataRowCount:0,
      snapshotRows:[snapshot()],
      publishedAt:'not-a-timestamp',
    }),
    error => error.code === 'PUBLICATION_TIMESTAMP_INVALID'
  );
});

test('planner fails closed on an empty public snapshot', () => {
  assert.throws(
    () => buildPublicationWritePlan({
      publicSheetId:122,
      gamesSheetId:184,
      gamesRowNumber:4,
      currentPublicGridRowCount:1000,
      existingPublicDataRowCount:0,
      snapshotRows:[],
      publishedAt:'2026-08-30T05:00:00.000Z',
    }),
    error => error.code === 'EMPTY_PUBLICATION_SNAPSHOT'
  );
});

test('planner fails closed when a snapshot row is missing publication identity', () => {
  const bad = snapshot();
  bad.Participant = '';

  assert.throws(
    () => buildPublicationWritePlan({
      publicSheetId:122,
      gamesSheetId:184,
      gamesRowNumber:4,
      currentPublicGridRowCount:1000,
      existingPublicDataRowCount:0,
      snapshotRows:[bad],
      publishedAt:'2026-08-30T05:00:00.000Z',
    }),
    error => error.code === 'INVALID_PUBLICATION_SNAPSHOT'
  );
});