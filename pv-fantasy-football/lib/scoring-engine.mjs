export const SCORING_RULES = Object.freeze({
  rushingTouchdown: 6,
  rushingYard: 0.1,
  receivingTouchdown: 6,
  reception: 0.5,
  receivingYard: 0.1,
  interceptionThrown: -2,
  fumbleLost: -2,
  tackle: 0.5,
  tackleForLoss: 1,
  sack: 2,
  quarterbackHurry: 1,
  passBreakup: 1,
  defensiveInterception: 2,
  forcedFumble: 1,
  fumbleRecovery: 1,
  defensiveReturnTouchdown: 6,
  negativeOrReturnYard: 0.1,
});

export const STAT_FIELDS = Object.freeze([
  'rushYards', 'rushTouchdowns', 'receptions', 'receivingYards',
  'receivingTouchdowns', 'passingInterceptions', 'fumblesLost', 'tackles',
  'tacklesForLoss', 'tackleForLossYards', 'sacks', 'sackYards',
  'quarterbackHurries', 'passBreakups', 'defensiveInterceptions',
  'interceptionReturnYards', 'forcedFumbles', 'fumbleRecoveries',
  'defensiveReturnTouchdowns',
]);

function round(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function numericStats(stats) {
  const missingFields = [];
  const invalidFields = [];
  const values = {};

  for (const field of STAT_FIELDS) {
    const raw = stats[field];
    if (raw === '' || raw === null || raw === undefined) {
      missingFields.push(field);
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      invalidFields.push(field);
      continue;
    }
    values[field] = value;
  }

  if (missingFields.length || invalidFields.length) {
    const error = new Error('The normalized stat line is incomplete or malformed.');
    error.code = 'UNSUPPORTED_OR_MISSING_STATS';
    error.missingFields = missingFields;
    error.invalidFields = invalidFields;
    throw error;
  }
  return values;
}

export function calculatePlayerScore(stats) {
  const value = numericStats(stats);
  const components = {
    rushPoints: value.rushYards * SCORING_RULES.rushingYard,
    rushTouchdownPoints: value.rushTouchdowns * SCORING_RULES.rushingTouchdown,
    receptionPoints: value.receptions * SCORING_RULES.reception,
    receivingYardPoints: value.receivingYards * SCORING_RULES.receivingYard,
    receivingTouchdownPoints: value.receivingTouchdowns * SCORING_RULES.receivingTouchdown,
    passingInterceptionPoints: value.passingInterceptions * SCORING_RULES.interceptionThrown,
    fumbleLostPoints: value.fumblesLost * SCORING_RULES.fumbleLost,
    tacklePoints: value.tackles * SCORING_RULES.tackle,
    tackleForLossPoints: value.tacklesForLoss * SCORING_RULES.tackleForLoss,
    sackPoints: value.sacks * SCORING_RULES.sack,
    quarterbackHurryPoints: value.quarterbackHurries * SCORING_RULES.quarterbackHurry,
    passBreakupPoints: value.passBreakups * SCORING_RULES.passBreakup,
    defensiveInterceptionPoints: value.defensiveInterceptions * SCORING_RULES.defensiveInterception,
    forcedFumblePoints: value.forcedFumbles * SCORING_RULES.forcedFumble,
    fumbleRecoveryPoints: value.fumbleRecoveries * SCORING_RULES.fumbleRecovery,
    defensiveReturnTouchdownPoints: value.defensiveReturnTouchdowns * SCORING_RULES.defensiveReturnTouchdown,
    // The workbook adapter defines official TFL yards as already including sack yards.
    // Adding sackYards here would double-count the same negative yardage.
    negativeOrReturnYardPoints:
      (value.tackleForLossYards + value.interceptionReturnYards) *
      SCORING_RULES.negativeOrReturnYard,
  };

  const rounded = Object.fromEntries(
    Object.entries(components).map(([key, component]) => [key, round(component)])
  );
  return {
    components: rounded,
    total: round(Object.values(rounded).reduce((sum, component) => sum + component, 0)),
  };
}

export function calculateAcceptedLineupTotal({lineup, picks, playerScores}) {
  const accepted = lineup?.accepted === true && lineup?.complete === true &&
    lineup?.onTime === true && lineup?.scoringVersion === true &&
    lineup?.state === 'ACCEPTED';
  if (!accepted) return 0;

  const activePicks = picks.filter(pick =>
    pick.submissionId === lineup.submissionId && pick.valid === true &&
    pick.scoringVersion === true && pick.state === 'ACCEPTED'
  );
  if (activePicks.length !== 8 || new Set(activePicks.map(pick => pick.slotId)).size !== 8 ||
      new Set(activePicks.map(pick => pick.playerId)).size !== 8) {
    return 0;
  }

  return round(activePicks.reduce((sum, pick) => {
    if (!playerScores.has(pick.playerId)) {
      const error = new Error(`Missing fantasy score for player ${pick.playerId}.`);
      error.code = 'MISSING_PLAYER_SCORE';
      throw error;
    }
    return sum + playerScores.get(pick.playerId);
  }, 0));
}
