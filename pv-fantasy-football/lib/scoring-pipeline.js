import {calculatePlayerScore, SCORING_RULES} from './scoring-engine.mjs';
import {
  batchUpdateSpreadsheet,
  getSpreadsheetMetadata,
  readSheetRange,
} from './google-sheets';
import {withGameWriterGate} from './workbook-writer-gate.mjs';

const GAME_STATS_HEADERS = [
  'Game ID', 'Week', 'Player ID', 'Player Name', 'Rush Yds', 'Rush TD',
  'Receptions', 'Rec Yds', 'Rec TD', 'Pass INT', 'Fumbles Lost', 'Tackles',
  'TFL', 'TFL Yds', 'Sacks', 'Sack Yds', 'QBH', 'PBU', 'Def INT',
  'INT Return Yds', 'Forced Fumble', 'Fumble Recovery', 'Def Return TD',
  'Source URL', 'Imported At', 'Final?',
];

const PLAYER_SCORE_HEADERS = [
  'Game ID', 'Week', 'Player ID', 'Player Name', 'Rush Pts', 'Rush TD Pts',
  'Rec Pts', 'Rec Yd Pts', 'Rec TD Pts', 'Pass INT Pts', 'Fum Lost Pts',
  'Tackle Pts', 'TFL Pts', 'Sack Pts', 'QBH Pts', 'PBU Pts', 'Def INT Pts',
  'FF Pts', 'FR Pts', 'Def Return TD Pts', 'Neg/Return Yd Pts', 'TOTAL',
];

const EXPECTED_SETTING_VALUES = [
  SCORING_RULES.rushingTouchdown, SCORING_RULES.rushingYard,
  SCORING_RULES.receivingTouchdown, SCORING_RULES.reception,
  SCORING_RULES.receivingYard, SCORING_RULES.interceptionThrown,
  SCORING_RULES.fumbleLost, SCORING_RULES.tackle, SCORING_RULES.tackleForLoss,
  SCORING_RULES.sack, SCORING_RULES.quarterbackHurry, SCORING_RULES.passBreakup,
  SCORING_RULES.defensiveInterception, SCORING_RULES.forcedFumble,
  SCORING_RULES.fumbleRecovery, SCORING_RULES.defensiveReturnTouchdown,
  SCORING_RULES.negativeOrReturnYard,
];

function scoringError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function assertHeaders(actual, expected, sheet) {
  const mismatch = expected.findIndex((header, index) => actual[index] !== header);
  if (mismatch !== -1) {
    throw scoringError('SCORING_SCHEMA_MISMATCH', `${sheet} column ${mismatch + 1} must be "${expected[mismatch]}".`);
  }
}

function valueData(value) {
  if (typeof value === 'number') return {userEnteredValue:{numberValue:value}};
  return {userEnteredValue:{stringValue:String(value ?? '')}};
}

function updateRow(sheetId, rowNumber, values) {
  return {
    updateCells: {
      range: {
        sheetId, startRowIndex:rowNumber - 1, endRowIndex:rowNumber,
        startColumnIndex:0, endColumnIndex:values.length,
      },
      rows:[{values:values.map(valueData)}],
      fields:'userEnteredValue',
    },
  };
}

function statsFromRow(row) {
  return {
    rushYards:row[4], rushTouchdowns:row[5], receptions:row[6],
    receivingYards:row[7], receivingTouchdowns:row[8], passingInterceptions:row[9],
    fumblesLost:row[10], tackles:row[11], tacklesForLoss:row[12],
    tackleForLossYards:row[13], sacks:row[14], sackYards:row[15],
    quarterbackHurries:row[16], passBreakups:row[17], defensiveInterceptions:row[18],
    interceptionReturnYards:row[19], forcedFumbles:row[20], fumbleRecoveries:row[21],
    defensiveReturnTouchdowns:row[22],
  };
}

function playerScoreRow(row, score) {
  const component = score.components;
  return [
    row[0], row[1], row[2], row[3], component.rushPoints,
    component.rushTouchdownPoints, component.receptionPoints,
    component.receivingYardPoints, component.receivingTouchdownPoints,
    component.passingInterceptionPoints, component.fumbleLostPoints,
    component.tacklePoints, component.tackleForLossPoints, component.sackPoints,
    component.quarterbackHurryPoints, component.passBreakupPoints,
    component.defensiveInterceptionPoints, component.forcedFumblePoints,
    component.fumbleRecoveryPoints, component.defensiveReturnTouchdownPoints,
    component.negativeOrReturnYardPoints, score.total,
  ];
}


function scoreRows(gameId, rows) {
  const seen = new Set();
  const issues = [];
  const scored = [];

  rows.slice(1).forEach((row, index) => {
    if (String(row[0] || '') !== gameId) return;
    const rowNumber = index + 4;
    const playerId = String(row[2] || '').trim();
    const playerName = String(row[3] || '').trim();
    if (!playerId || !playerName) {
      issues.push({row:rowNumber, code:'MISSING_PLAYER_IDENTITY', player_id:playerId || null});
      return;
    }
    if (seen.has(playerId)) {
      issues.push({row:rowNumber, code:'DUPLICATE_PLAYER_ROW', player_id:playerId});
      return;
    }
    seen.add(playerId);
    if (!String(row[23] || '').trim() || row[24] === '' || row[24] === undefined) {
      issues.push({row:rowNumber, code:'MISSING_SOURCE_PROVENANCE', player_id:playerId});
      return;
    }
    if (!['YES','NO'].includes(String(row[25] || '').toUpperCase())) {
      issues.push({row:rowNumber, code:'INVALID_FINAL_FLAG', player_id:playerId});
      return;
    }
    try {
      const score = calculatePlayerScore(statsFromRow(row));
      scored.push({rowNumber, playerId, source:row, score, output:playerScoreRow(row, score)});
    } catch (error) {
      issues.push({
        row:rowNumber, code:error.code || 'MALFORMED_STAT', player_id:playerId,
        missing_fields:error.missingFields || [], invalid_fields:error.invalidFields || [],
      });
    }
  });

  if (!scored.length && !issues.length) issues.push({code:'NO_GAME_STATS', game_id:gameId});
  if (issues.length) {
    throw scoringError('SCORING_INPUT_REVIEW_REQUIRED', 'Normalized statistics require review before scoring.', {issues});
  }
  return scored;
}

function assertAcceptedPlayersHaveStats(gameId, picksRows, scoreByPlayer) {
  const missing = new Set();
  picksRows.slice(1).forEach(row => {
    const isScoringPick = row[1] === gameId && row[9] === 'YES' && row[13] === 'YES' && row[14] === 'ACCEPTED';
    if (isScoringPick && !scoreByPlayer.has(String(row[5] || ''))) missing.add(String(row[5] || ''));
  });
  if (missing.size) {
    throw scoringError('MISSING_PLAYER_STAT_LINE', 'An accepted lineup player has no normalized GameStats row.', {
      playerIds:[...missing],
    });
  }
}

function findSheetId(metadata, title) {
  const sheet = (metadata.sheets || []).find(item => item.properties.title === title);
  if (!sheet) throw scoringError('SCORING_SCHEMA_MISMATCH', `Missing sheet: ${title}.`);
  return sheet.properties.sheetId;
}

function closeEnough(actual, expected) {
  return Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expected) < 0.0001;
}

function assertWorkbookRules(rows) {
  const actual = rows.map(row => Number(row[0]));
  if (actual.length < EXPECTED_SETTING_VALUES.length ||
      EXPECTED_SETTING_VALUES.some((expected, index) => !closeEnough(actual[index], expected))) {
    throw scoringError(
      'SCORING_RULE_MISMATCH',
      'Settings!C13:C29 does not match the required PV Fantasy scoring rules.'
    );
  }
}

async function verifyPropagation(gameId, scoreByPlayer) {
  const [playerRows, picks, lineups, active, weekly] = await Promise.all([
    readSheetRange("'PlayerScores'!A3:V1000", {valueRenderOption:'UNFORMATTED_VALUE'}),
    readSheetRange("'Picks'!A3:O1000", {valueRenderOption:'UNFORMATTED_VALUE'}),
    readSheetRange("'Lineups'!A3:U1000", {valueRenderOption:'UNFORMATTED_VALUE'}),
    readSheetRange("'ActiveLineups'!A3:N1000", {valueRenderOption:'UNFORMATTED_VALUE'}),
    readSheetRange("'WeeklyScores'!A3:H1000", {valueRenderOption:'UNFORMATTED_VALUE'}),
  ]);

  const outputRows = playerRows.slice(1).filter(row => row[0] === gameId);
  const scoreValues = score => [
    score.components.rushPoints, score.components.rushTouchdownPoints,
    score.components.receptionPoints, score.components.receivingYardPoints,
    score.components.receivingTouchdownPoints, score.components.passingInterceptionPoints,
    score.components.fumbleLostPoints, score.components.tacklePoints,
    score.components.tackleForLossPoints, score.components.sackPoints,
    score.components.quarterbackHurryPoints, score.components.passBreakupPoints,
    score.components.defensiveInterceptionPoints, score.components.forcedFumblePoints,
    score.components.fumbleRecoveryPoints, score.components.defensiveReturnTouchdownPoints,
    score.components.negativeOrReturnYardPoints, score.total,
  ];
  if (outputRows.length !== scoreByPlayer.size || outputRows.some(row => {
    const expected = scoreByPlayer.get(row[2]);
    return !expected || scoreValues(expected).some((value, index) => !closeEnough(row[index + 4], value));
  })) {
    throw scoringError('PLAYER_SCORE_VERIFY_FAILED', 'PlayerScores did not match calculated component totals.');
  }

  const gamePicks = picks.slice(1).filter(row => row[1] === gameId);
  for (const pick of gamePicks) {
    const shouldScore = pick[9] === 'YES' && pick[13] === 'YES' && pick[14] === 'ACCEPTED';
    const expected = shouldScore ? scoreByPlayer.get(pick[5])?.total : 0;
    if (expected === undefined || !closeEnough(pick[10], expected)) {
      throw scoringError('PICK_SCORE_VERIFY_FAILED', 'A pick did not receive the expected scoring-version player total.', {pickId:pick[0]});
    }
  }

  const scoringBySubmission = new Map();
  for (const pick of gamePicks.filter(row => row[9] === 'YES' && row[13] === 'YES' && row[14] === 'ACCEPTED')) {
    const current = scoringBySubmission.get(pick[11]) || {total:0, slots:new Set(), players:new Set(), count:0};
    current.total += Number(pick[10]); current.slots.add(pick[4]); current.players.add(pick[5]); current.count += 1;
    scoringBySubmission.set(pick[11], current);
  }
  for (const [submissionId, group] of scoringBySubmission) {
    if (group.count !== 8 || group.slots.size !== 8 || group.players.size !== 8) {
      throw scoringError('SCORING_LINEUP_INVARIANT_FAILED', 'A scoring-version lineup does not contain eight unique valid picks.', {submissionId});
    }
  }

  const gameLineups = lineups.slice(1).filter(row => row[1] === gameId);
  for (const lineup of gameLineups) {
    const shouldScore = lineup[13] === 'YES' && lineup[20] === 'YES';
    const expected = shouldScore ? scoringBySubmission.get(lineup[18])?.total : 0;
    if (expected === undefined || !closeEnough(lineup[15], expected)) {
      throw scoringError('LINEUP_SCORE_VERIFY_FAILED', 'Lineups did not contain the accepted eight-player total.', {lineupId:lineup[0]});
    }
  }

  for (const row of active.slice(1).filter(item => item[0] === gameId && item[8] === 'YES' && item[9] === 'YES')) {
    const expected = scoringBySubmission.get(row[4])?.total;
    if (expected === undefined || !closeEnough(row[11], expected)) {
      throw scoringError('ACTIVE_LINEUP_VERIFY_FAILED', 'ActiveLineups did not receive the scoring-version total.');
    }
  }

  for (const row of weekly.slice(1).filter(item => item[0] === gameId && item[2])) {
    const lineup = gameLineups.find(item => item[3] === row[2] && item[13] === 'YES' && item[20] === 'YES');
    const expected = lineup ? Number(lineup[15]) : 0;
    if (!closeEnough(row[4], expected)) {
      throw scoringError('WEEKLY_SCORE_VERIFY_FAILED', 'WeeklyScores did not match the accepted lineup total.', {participantId:row[2]});
    }
  }
}

export async function scoreGame(gameId) {
  const normalizedGameId = String(gameId || '').trim();
  if (!normalizedGameId) throw scoringError('INVALID_GAME', 'game_id is required.');

  return withGameWriterGate(normalizedGameId, async () => {
    const [gameStats, playerScores, picks, settings, metadata] = await Promise.all([
      readSheetRange("'GameStats'!A3:Z1000", {valueRenderOption:'UNFORMATTED_VALUE'}),
      readSheetRange("'PlayerScores'!A3:V1000", {valueRenderOption:'UNFORMATTED_VALUE'}),
      readSheetRange("'Picks'!A3:O1000", {valueRenderOption:'UNFORMATTED_VALUE'}),
      readSheetRange("'Settings'!C13:C29", {valueRenderOption:'UNFORMATTED_VALUE'}),
      getSpreadsheetMetadata(),
    ]);
    assertHeaders(gameStats[0] || [], GAME_STATS_HEADERS, 'GameStats');
    assertHeaders(playerScores[0] || [], PLAYER_SCORE_HEADERS, 'PlayerScores');
    assertWorkbookRules(settings);

    const scored = scoreRows(normalizedGameId, gameStats);
    const scoreByPlayer = new Map(scored.map(item => [item.playerId, item.score]));
    assertAcceptedPlayersHaveStats(normalizedGameId, picks, scoreByPlayer);

    const existingKeys = new Set();
    playerScores.slice(1).forEach((row, index) => {
      if (row[0] !== normalizedGameId) return;
      const key = String(row[2] || '');
      if (existingKeys.has(key)) throw scoringError('DUPLICATE_PLAYER_SCORE_ROW', 'PlayerScores contains a duplicate game/player row.', {playerId:key});
      existingKeys.add(key);
    });

    const sheetId = findSheetId(metadata, 'PlayerScores');
    const requests = scored.map(item => updateRow(sheetId, item.rowNumber, item.output));
    playerScores.slice(1).forEach((row, index) => {
      if (row[0] === normalizedGameId && !scoreByPlayer.has(String(row[2] || ''))) {
        requests.push(updateRow(sheetId, index + 4, Array(PLAYER_SCORE_HEADERS.length).fill('')));
      }
    });

    await batchUpdateSpreadsheet(requests);
    await verifyPropagation(normalizedGameId, scoreByPlayer);
    return {
      game_id:normalizedGameId,
      players_scored:scored.length,
      final:scored.every(item => String(item.source[25]).toUpperCase() === 'YES'),
      scoring_status:scored.every(item => String(item.source[25]).toUpperCase() === 'YES') ? 'FINAL_CALCULATED' : 'PROVISIONAL_CALCULATED',
    };
  });
}
