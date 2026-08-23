import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicLeaderboardFromSnapshots} from '../lib/public-leaderboard-snapshot.mjs';

const row = ({
  gameId='2026-W0',
  week='W0',
  weeklyRank=1,
  seasonRank=1,
  participant='Panther One',
  weekPoints=78.1,
  seasonPoints=78.1,
  average=78.1,
  bestWeek='W0',
  status='FINAL \u2022 OFFICIAL',
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
  Status:status,
  'Published At':publishedAt,
});

test('public leaderboard renders weekly and cumulative standings from one frozen snapshot', () => {
  const result = publicLeaderboardFromSnapshots([
    row({
      participant:'Panther Two',
      weeklyRank:1,
      seasonRank:1,
      weekPoints:30,
      seasonPoints:40,
      average:20,
    }),
    row({
      participant:'Panther One',
      weeklyRank:2,
      seasonRank:2,
      weekPoints:5,
      seasonPoints:25,
      average:12.5,
    }),
  ]);

  assert.equal(result.week,'W0');
  assert.equal(result.status_label,'FINAL \u2022 OFFICIAL');

  assert.deepEqual(result.weekly,[
    {rank:1,participant:'Panther Two',points:30},
    {rank:2,participant:'Panther One',points:5},
  ]);

  assert.deepEqual(result.cumulative,[
    {
      rank:1,
      participant:'Panther Two',
      season_points:40,
      average:20,
      best_week:'W0',
    },
    {
      rank:2,
      participant:'Panther One',
      season_points:25,
      average:12.5,
      best_week:'W0',
    },
  ]);
});

test('default view selects the latest published week, not a future unpublished week', () => {
  const result = publicLeaderboardFromSnapshots([
    row({
      gameId:'2026-W0',
      week:'W0',
      participant:'Panther One',
      weekPoints:10,
      seasonPoints:10,
    }),
    row({
      gameId:'2026-W1',
      week:'W1',
      participant:'Panther One',
      weekPoints:20,
      seasonPoints:30,
      average:15,
      bestWeek:'W1',
    }),
  ]);

  assert.equal(result.week,'W1');
  assert.equal(result.weekly[0].points,20);
  assert.equal(result.cumulative[0].season_points,30);
});

test('requesting an unpublished week returns no standings rather than live data', () => {
  const result = publicLeaderboardFromSnapshots([
    row(),
  ],'W1');

  assert.equal(result.week,'W1');
  assert.deepEqual(result.weekly,[]);
  assert.deepEqual(result.cumulative,[]);
  assert.equal(result.status_label,'AWAITING OFFICIAL RESULTS');
});

test('a missed game remains in cumulative standings but is omitted from weekly ranked results', () => {
  const result = publicLeaderboardFromSnapshots([
    row({
      weeklyRank:'',
      weekPoints:0,
      seasonPoints:18,
      average:9,
      bestWeek:'W0',
    }),
  ]);

  assert.deepEqual(result.weekly,[]);
  assert.equal(result.cumulative.length,1);
  assert.equal(result.cumulative[0].season_points,18);
});

test('a legitimate ranked zero-point game remains visible in weekly standings', () => {
  const result = publicLeaderboardFromSnapshots([
    row({
      weeklyRank:1,
      weekPoints:0,
      seasonPoints:0,
      average:0,
    }),
  ]);

  assert.equal(result.weekly.length,1);
  assert.equal(result.weekly[0].points,0);
});

test('public adapter fails closed on a duplicate participant in one frozen snapshot', () => {
  assert.throws(
    () => publicLeaderboardFromSnapshots([
      row({participant:'Panther One'}),
      row({participant:'panther one',seasonRank:2}),
    ]),
    error => error.code === 'PUBLIC_LEADERBOARD_INVALID'
  );
});

test('public adapter fails closed on a non-official snapshot row', () => {
  assert.throws(
    () => publicLeaderboardFromSnapshots([
      row({status:'FINAL \u2022 PUBLICATION HOLD'}),
    ]),
    error => error.code === 'PUBLIC_LEADERBOARD_INVALID'
  );
});

test('public leaderboard API reads only PublicLeaderboard and cannot read internal score tables', async () => {
  const source = await readFile(
    new URL('../app/api/leaderboard/route.js', import.meta.url),
    'utf8'
  );

  assert.match(source,/PublicLeaderboard/);
  assert.doesNotMatch(source,/WeeklyScores/);
  assert.doesNotMatch(source,/"'Leaderboard'!/);
  assert.doesNotMatch(source,/PublishControl/);
});