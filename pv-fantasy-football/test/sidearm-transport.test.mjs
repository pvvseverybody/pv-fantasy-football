import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson, compareSnapshots, fetchSidearmSnapshot, snapshotHash,
  validateSidearmEndpoint,
} from '../lib/sidearm-transport.mjs';
import {runL2TransportCertification} from '../certification/run-l2-transport-certification.mjs';

function payload(overrides = {}) {
  const groups = Object.fromEntries([
    'Rushing','Receiving','Passing','Fumbles','Tackling','Sacks','PassDefense',
    'Interceptions','KickReturns','PuntReturns',
  ].map(name => [name,{Values:[]}]))
  return {
    Game:{Type:'FootballGame',Source:'statcrew',ClientId:'1692',NcaaGameId:'40550',HasStarted:false,IsComplete:false,Period:1,ClockSeconds:0,HomeTeam:{Name:'Delaware State'},VisitingTeam:{Name:'Stony Brook'},...overrides.Game},
    Stats:{HomeTeam:{Players:[],PlayerGroups:groups},VisitingTeam:{Players:[],PlayerGroups:groups}},
    Plays:overrides.Plays || [],
  };
}

function mockFetch(body, headers = {}) {
  return async () => new Response(JSON.stringify(body), {status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*',etag:'fixture-etag',...headers}});
}

test('canonical hashing is stable across object key order', () => {
  assert.equal(canonicalJson({b:2,a:1}), canonicalJson({a:1,b:2}));
  assert.equal(snapshotHash({b:2,a:1}), snapshotHash({a:1,b:2}));
});

test('endpoint allowlist rejects non-SIDEARM transport', () => {
  assert.throws(() => validateSidearmEndpoint('https://example.com/game.json'));
  assert.doesNotThrow(() => validateSidearmEndpoint('https://sidearmstats.com/delawarestate/football/game.json?detail=full'));
});

test('detects changing, starting, correction-like, and final snapshots', () => {
  const first = payload();
  const live = payload({Game:{HasStarted:true,IsComplete:false},Plays:[{id:1},{id:2}]});
  const correctedFinal = payload({Game:{HasStarted:true,IsComplete:true},Plays:[{id:1}]});
  assert.deepEqual(compareSnapshots(first, live), {changed:true,finalTransition:false,startedTransition:true,playerCountDecreased:false,playCountDecreased:false});
  assert.deepEqual(compareSnapshots(live, correctedFinal), {changed:true,finalTransition:true,startedTransition:false,playerCountDecreased:false,playCountDecreased:true});
});

test('preflight verifies transport without treating it as full L2', async () => {
  const result = await runL2TransportCertification({fetchImpl:mockFetch(payload())});
  assert.equal(result.preflightPass, true);
  assert.equal(result.fullL2Pass, false);
  assert.equal(result.status, 'READY FOR LIVE WINDOW');
});

test('transport rejects non-JSON responses', async () => {
  await assert.rejects(() => fetchSidearmSnapshot('https://sidearmstats.com/delawarestate/football/game.json', {fetchImpl:mockFetch(payload(), {'content-type':'text/html'})}), /content type/);
});
