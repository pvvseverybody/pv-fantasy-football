import {calculatePlayerScore} from './scoring-engine.mjs';

const SLOT_IDS = ['RB','WR','TE','OFF_FLEX','DL','LB','DB','DEF_FLEX'];

function round(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function key(...parts) {
  return parts.join('|');
}

function clone(value) {
  return structuredClone(value);
}

function scoringStats(row) {
  return {
    rushYards:row.rushYards, rushTouchdowns:row.rushTouchdowns,
    receptions:row.receptions, receivingYards:row.receivingYards,
    receivingTouchdowns:row.receivingTouchdowns,
    passingInterceptions:row.passingInterceptions, fumblesLost:row.fumblesLost,
    tackles:row.tackles, tacklesForLoss:row.tacklesForLoss,
    tackleForLossYards:row.tackleForLossYards, sacks:row.sacks,
    sackYards:row.sackYards, quarterbackHurries:row.quarterbackHurries,
    passBreakups:row.passBreakups, defensiveInterceptions:row.defensiveInterceptions,
    interceptionReturnYards:row.interceptionReturnYards,
    forcedFumbles:row.forcedFumbles, fumbleRecoveries:row.fumbleRecoveries,
    defensiveReturnTouchdowns:row.defensiveReturnTouchdowns,
  };
}

export function createCertificationStore({participants, games}) {
  return {
    participants:new Map(participants.map(item => [item.id, clone(item)])),
    games:new Map(games.map(item => [item.id, clone(item)])),
    rawSourceStats:new Map(),
    gameStats:new Map(),
    playerScores:new Map(),
    submissionHistory:new Map(),
    picks:new Map(),
    lineups:new Map(),
    activeLineups:new Map(),
    weeklyScores:new Map(),
    leaderboard:[],
    reconciliation:new Map(),
    publishControl:new Map(),
  };
}

export function ingestNormalizedStats(store, rows) {
  const payloadKeys = new Set();
  for (const row of rows) {
    const rowKey = key(row.gameId, row.playerId);
    if (payloadKeys.has(rowKey)) {
      const error = new Error(`Duplicate normalized row ${rowKey}.`);
      error.code = 'DUPLICATE_PLAYER_ROW';
      throw error;
    }
    payloadKeys.add(rowKey);
    if (!row.sourceUrl || !row.importedAt) {
      const error = new Error(`Missing source provenance for ${rowKey}.`);
      error.code = 'MISSING_SOURCE_PROVENANCE';
      throw error;
    }
  }
  for (const row of rows) {
    const rowKey = key(row.gameId, row.playerId);
    store.rawSourceStats.set(rowKey, clone(row));
    store.gameStats.set(rowKey, clone(row));
  }
  return {rows:rows.length, uniqueRows:store.gameStats.size};
}

export function submitCertificationLineup(store, submission) {
  if (store.submissionHistory.has(submission.id)) {
    return {duplicate:true, record:store.submissionHistory.get(submission.id)};
  }
  const game = store.games.get(submission.gameId);
  const participant = store.participants.get(submission.participantId);
  if (!game || !participant) throw new Error('Unknown certification game or participant.');
  if (submission.playerIds.length !== 8 || new Set(submission.playerIds).size !== 8) {
    const record = {...clone(submission), state:'REJECTED_INCOMPLETE', scoringVersion:false};
    store.submissionHistory.set(submission.id, record);
    return {duplicate:false, record};
  }
  if (new Date(submission.submittedAt) >= new Date(game.kickoff)) {
    const record = {...clone(submission), state:'REJECTED_LATE', scoringVersion:false};
    store.submissionHistory.set(submission.id, record);
    return {duplicate:false, record};
  }

  const activeKey = key(submission.gameId, submission.participantId);
  const prior = store.activeLineups.get(activeKey);
  if (prior) {
    const history = store.submissionHistory.get(prior.submissionId);
    history.state = 'SUPERSEDED';
    history.scoringVersion = false;
    for (const pick of store.picks.values()) {
      if (pick.submissionId === prior.submissionId) {
        pick.state = 'SUPERSEDED';
        pick.scoringVersion = false;
        pick.fantasyScore = 0;
      }
    }
  }

  const record = {...clone(submission), state:'ACCEPTED', scoringVersion:true};
  store.submissionHistory.set(submission.id, record);
  submission.playerIds.forEach((playerId, index) => {
    const pickId = `${submission.id}-${SLOT_IDS[index]}`;
    store.picks.set(pickId, {
      pickId, gameId:submission.gameId, participantId:submission.participantId,
      submissionId:submission.id, version:submission.version,
      slotId:SLOT_IDS[index], playerId, valid:true, scoringVersion:true,
      state:'ACCEPTED', fantasyScore:0,
    });
  });
  const projection = {
    gameId:submission.gameId, participantId:submission.participantId,
    submissionId:submission.id, version:submission.version, accepted:true,
    complete:true, onTime:true, scoringVersion:true, state:'ACCEPTED',
    pickCount:8, fantasyScore:0,
  };
  store.lineups.set(activeKey, projection);
  store.activeLineups.set(activeKey, clone(projection));
  return {duplicate:false, record};
}

function verifyWriterInvariants(store, gameId) {
  for (const participant of store.participants.values()) {
    const activeKey = key(gameId, participant.id);
    const activeHistory = [...store.submissionHistory.values()].filter(item =>
      item.gameId === gameId && item.participantId === participant.id && item.scoringVersion
    );
    if (activeHistory.length !== 1) throw new Error(`Expected one scoring version for ${activeKey}.`);
    const active = store.activeLineups.get(activeKey);
    if (!active || active.submissionId !== activeHistory[0].id) throw new Error(`ActiveLineups mismatch for ${activeKey}.`);
    const picks = [...store.picks.values()].filter(item => item.submissionId === active.submissionId && item.scoringVersion);
    if (picks.length !== 8 || new Set(picks.map(item => item.slotId)).size !== 8 || new Set(picks.map(item => item.playerId)).size !== 8) {
      throw new Error(`Active submission does not have eight unique picks for ${activeKey}.`);
    }
  }
}

function rebuildLeaderboard(store) {
  const totals = new Map();
  for (const weekly of store.weeklyScores.values()) {
    totals.set(weekly.participantId, round((totals.get(weekly.participantId) || 0) + weekly.fantasyScore));
  }
  store.leaderboard = [...totals].map(([participantId, total]) => ({participantId,total}))
    .sort((a,b) => b.total - a.total || a.participantId.localeCompare(b.participantId))
    .map((item,index) => ({rank:index + 1,...item}));
}

export function scoreCertificationGame(store, gameId) {
  verifyWriterInvariants(store, gameId);
  const sourceRows = [...store.gameStats.values()].filter(row => row.gameId === gameId);
  const stagedScores = new Map();
  for (const row of sourceRows) {
    const scoreKey = key(gameId, row.playerId);
    if (stagedScores.has(scoreKey)) {
      const error = new Error(`Duplicate normalized row ${scoreKey}.`);
      error.code = 'DUPLICATE_PLAYER_ROW';
      throw error;
    }
    stagedScores.set(scoreKey, {
      gameId, week:row.week, playerId:row.playerId, playerName:row.playerName,
      sourceUrl:row.sourceUrl, importedAt:row.importedAt,
      ...calculatePlayerScore(scoringStats(row)),
    });
  }

  const scoringPicks = [...store.picks.values()].filter(pick =>
    pick.gameId === gameId && pick.valid && pick.scoringVersion && pick.state === 'ACCEPTED'
  );
  const missing = [...new Set(scoringPicks.map(pick => pick.playerId).filter(playerId => !stagedScores.has(key(gameId,playerId))))];
  if (missing.length) {
    const error = new Error(`Missing normalized stat lines: ${missing.join(', ')}.`);
    error.code = 'MISSING_PLAYER_STAT_LINE';
    error.playerIds = missing;
    store.reconciliation.set(gameId,{status:'FAIL',differences:missing.length,unmatched:missing.length});
    store.publishControl.set(gameId,'HOLD');
    throw error;
  }

  for (const [scoreKey, score] of stagedScores) store.playerScores.set(scoreKey, score);
  for (const pick of store.picks.values()) {
    if (pick.gameId !== gameId) continue;
    pick.fantasyScore = pick.valid && pick.scoringVersion && pick.state === 'ACCEPTED'
      ? stagedScores.get(key(gameId,pick.playerId)).total : 0;
  }

  for (const participant of store.participants.values()) {
    const activeKey = key(gameId,participant.id);
    const lineup = store.lineups.get(activeKey);
    const active = store.activeLineups.get(activeKey);
    const acceptedPicks = [...store.picks.values()].filter(pick =>
      pick.submissionId === lineup.submissionId && pick.valid && pick.scoringVersion && pick.state === 'ACCEPTED'
    );
    const total = round(acceptedPicks.reduce((sum,pick) => sum + pick.fantasyScore,0));
    lineup.fantasyScore = total;
    active.fantasyScore = total;
    store.weeklyScores.set(activeKey,{
      gameId, week:store.games.get(gameId).week, participantId:participant.id,
      displayName:participant.displayName, fantasyScore:total, pickCount:8,
      validation:'VALID',
    });
  }
  rebuildLeaderboard(store);
  store.reconciliation.set(gameId,{status:'PASS',differences:0,unmatched:0,criticalQa:0});
  store.publishControl.set(gameId,'PUBLISH');
  return {playersScored:stagedScores.size, publication:'PUBLISH'};
}

export function snapshotCertificationState(store) {
  return {
    rawSourceStats:store.rawSourceStats.size,
    gameStats:store.gameStats.size,
    playerScores:store.playerScores.size,
    submissionHistory:store.submissionHistory.size,
    picks:store.picks.size,
    lineups:store.lineups.size,
    activeLineups:store.activeLineups.size,
    weeklyScores:store.weeklyScores.size,
    leaderboard:clone(store.leaderboard),
    playerScoreTotals:[...store.playerScores].map(([scoreKey,value]) => [scoreKey,value.total]).sort(),
    weeklyScoreTotals:[...store.weeklyScores].map(([scoreKey,value]) => [scoreKey,value.fantasyScore]).sort(),
  };
}

export function certifyReconciliation(store) {
  const checks = [];
  for (const weekly of store.weeklyScores.values()) {
    const active = store.activeLineups.get(key(weekly.gameId,weekly.participantId));
    const picks = [...store.picks.values()].filter(pick => pick.submissionId === active.submissionId && pick.scoringVersion && pick.state === 'ACCEPTED');
    const pickSum = round(picks.reduce((sum,pick) => sum + pick.fantasyScore,0));
    checks.push({
      gameId:weekly.gameId, participantId:weekly.participantId,
      acceptedSubmissionId:active.submissionId, pickCount:picks.length,
      pickSum, lineupScore:active.fantasyScore, weeklyScore:weekly.fantasyScore,
      pass:picks.length === 8 && pickSum === active.fantasyScore && pickSum === weekly.fantasyScore,
    });
  }
  return checks;
}
