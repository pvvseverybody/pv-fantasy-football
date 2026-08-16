import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateAcceptedLineupTotal, calculatePlayerScore} from '../lib/scoring-engine.mjs';

function stats(overrides = {}) {
  return {
    rushYards: 0, rushTouchdowns: 0, receptions: 0, receivingYards: 0,
    receivingTouchdowns: 0, passingInterceptions: 0, fumblesLost: 0,
    tackles: 0, tacklesForLoss: 0, tackleForLossYards: 0, sacks: 0,
    sackYards: 0, quarterbackHurries: 0, passBreakups: 0,
    defensiveInterceptions: 0, interceptionReturnYards: 0, forcedFumbles: 0,
    fumbleRecoveries: 0, defensiveReturnTouchdowns: 0,
    ...overrides,
  };
}

test('scores combined rushing and receiving production', () => {
  const result = calculatePlayerScore(stats({
    rushYards: 50, rushTouchdowns: 1, receptions: 4,
    receivingYards: 30, receivingTouchdowns: 1,
  }));
  assert.equal(result.total, 22);
});

test('penalizes a quarterback interception', () => {
  assert.equal(calculatePlayerScore(stats({passingInterceptions: 2})).total, -4);
});

test('uses fumbles lost rather than total fumbles', () => {
  const result = calculatePlayerScore({...stats({fumblesLost: 1}), totalFumbles: 4});
  assert.equal(result.total, -2);
});

test('scores tackles, TFL, sacks, QBH and PBU separately without adding sack yards twice', () => {
  const result = calculatePlayerScore(stats({
    tackles: 8, tacklesForLoss: 2, tackleForLossYards: 12,
    sacks: 1, sackYards: 7, quarterbackHurries: 2, passBreakups: 1,
  }));
  assert.deepEqual(result.components, {
    rushPoints: 0, rushTouchdownPoints: 0, receptionPoints: 0,
    receivingYardPoints: 0, receivingTouchdownPoints: 0,
    passingInterceptionPoints: 0, fumbleLostPoints: 0, tacklePoints: 4,
    tackleForLossPoints: 2, sackPoints: 2, quarterbackHurryPoints: 2,
    passBreakupPoints: 1, defensiveInterceptionPoints: 0,
    forcedFumblePoints: 0, fumbleRecoveryPoints: 0,
    defensiveReturnTouchdownPoints: 0, negativeOrReturnYardPoints: 1.2,
  });
  assert.equal(result.total, 12.2);
});

test('scores an interception, its return yards, and a defensive return TD', () => {
  const result = calculatePlayerScore(stats({
    defensiveInterceptions: 1, interceptionReturnYards: 35,
    defensiveReturnTouchdowns: 1,
  }));
  assert.equal(result.total, 11.5);
});

test('scores forced fumbles and recoveries as separate official events', () => {
  const result = calculatePlayerScore(stats({forcedFumbles: 1, fumbleRecoveries: 1}));
  assert.equal(result.total, 2);
});

test('does not award kick-return or punt-return touchdown points', () => {
  const result = calculatePlayerScore({...stats(), kickReturnTouchdowns: 1, puntReturnTouchdowns: 1});
  assert.equal(result.components.defensiveReturnTouchdownPoints, 0);
  assert.equal(result.total, 0);
});

test('sums exactly eight players in an accepted scoring-version lineup', () => {
  const picks = Array.from({length: 8}, (_, index) => ({
    submissionId: 'SUB-1', slotId: `S${index}`, playerId: `P${index}`,
    valid: true, scoringVersion: true, state: 'ACCEPTED',
  }));
  const playerScores = new Map(picks.map((pick, index) => [pick.playerId, index + 1]));
  const total = calculateAcceptedLineupTotal({
    lineup: {submissionId:'SUB-1', accepted:true, complete:true, onTime:true, scoringVersion:true, state:'ACCEPTED'},
    picks,
    playerScores,
  });
  assert.equal(total, 36);
});

test('does not score a superseded lineup', () => {
  const total = calculateAcceptedLineupTotal({
    lineup: {submissionId:'SUB-OLD', accepted:true, complete:true, onTime:true, scoringVersion:false, state:'SUPERSEDED'},
    picks: [], playerScores: new Map(),
  });
  assert.equal(total, 0);
});

test('blocks duplicate players or slots instead of double-counting them', () => {
  const picks = Array.from({length: 8}, (_, index) => ({
    submissionId:'SUB-1', slotId:index === 7 ? 'S0' : `S${index}`,
    playerId:index === 7 ? 'P0' : `P${index}`,
    valid:true, scoringVersion:true, state:'ACCEPTED',
  }));
  assert.equal(calculateAcceptedLineupTotal({
    lineup:{submissionId:'SUB-1', accepted:true, complete:true, onTime:true, scoringVersion:true, state:'ACCEPTED'},
    picks, playerScores:new Map(picks.map(pick => [pick.playerId, 10])),
  }), 0);
});

test('flags missing normalized source fields rather than treating them as zero', () => {
  const incomplete = stats();
  delete incomplete.fumblesLost;
  assert.throws(() => calculatePlayerScore(incomplete), error =>
    error.code === 'UNSUPPORTED_OR_MISSING_STATS' && error.missingFields.includes('fumblesLost')
  );
});
