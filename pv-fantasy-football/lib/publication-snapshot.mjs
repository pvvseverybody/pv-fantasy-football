export const PUBLICATION_WEEK_ORDER = Object.freeze([
  'W0','W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','P1','P2',
]);

const upper = value => String(value || '').trim().toUpperCase();
const number = value => Number(value || 0);
const round = value => Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;

function publicationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function isDemoRecord(row = {}) {
  return /^DEMO-|^TEST-|^UNIT-/i.test(String(row['Participant ID'] || row['Game ID'] || '')) ||
    /demo participant/i.test(String(row['Display Name'] || row.Participant || ''));
}

function weekIndex(week) {
  const index = PUBLICATION_WEEK_ORDER.indexOf(String(week || '').trim());
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function rankByPoints(rows, field) {
  const sorted = [...rows].sort((a, b) =>
    number(b[field]) - number(a[field]) ||
    String(a.Participant || '').localeCompare(String(b.Participant || ''))
  );

  let previous = null;
  let rank = 0;
  return sorted.map((row, index) => {
    const points = number(row[field]);
    if (previous === null || Math.abs(points - previous) > 0.000001) rank = index + 1;
    previous = points;
    return {...row, 'Season Rank': rank};
  });
}

function authoritativeRows(weekly, targetGameId) {
  const valid = weekly.filter(row =>
    row &&
    String(row['Game ID']) === targetGameId &&
    upper(row.Validation) === 'VALID' &&
    row['Participant ID'] &&
    row['Display Name'] &&
    !isDemoRecord(row)
  );

  const keys = new Set();
  const names = new Set();

  for (const row of valid) {
    const participantId = String(row['Participant ID']);
    const participant = String(row['Display Name']).trim();
    const key = `${targetGameId}\n${participantId}`;
    const normalizedName = participant.toLowerCase();

    if (keys.has(key) || names.has(normalizedName)) {
      throw publicationError(
        'DUPLICATE_WEEKLY_SCORE',
        'WeeklyScores contains more than one valid row for the same published participant.',
        {gameId: targetGameId, participantId}
      );
    }

    keys.add(key);
    names.add(normalizedName);
  }

  return valid.map(row => ({
    gameId: targetGameId,
    week: String(row.Week || ''),
    participant: String(row['Display Name']).trim(),
    score: round(number(row['Fantasy Score'])),
    weeklyRank: row['Weekly Rank'] === '' ? '' : number(row['Weekly Rank']),
  }));
}

function frozenRows(publicRows, gameId) {
  const rows = publicRows.filter(row =>
    row &&
    String(row['Game ID']) === gameId &&
    row.Participant &&
    !isDemoRecord(row)
  );

  const names = new Set();

  for (const row of rows) {
    const participant = String(row.Participant).trim();
    const normalizedName = participant.toLowerCase();

    if (names.has(normalizedName)) {
      throw publicationError(
        'DUPLICATE_PUBLIC_SNAPSHOT',
        'PublicLeaderboard contains more than one frozen row for the same game and participant.',
        {gameId, participant}
      );
    }

    names.add(normalizedName);
  }

  return rows.map(row => ({
    gameId,
    week: String(row.Week || ''),
    participant: String(row.Participant).trim(),
    score: round(number(row['Week Points'])),
    weeklyRank: row['Weekly Rank'] === '' ? '' : number(row['Weekly Rank']),
  }));
}

export function buildPublicationSnapshots({
  games = [],
  weekly = [],
  publicRows = [],
  publicationGameIds = [],
  targetGameId = '',
  publishedAtByGame = {},
} = {}) {
  const gameById = new Map(
    games
      .filter(game => game && game['Game ID'])
      .map(game => [String(game['Game ID']), game])
  );

  const publicationGames = publicationGameIds.map(gameId => {
    const game = gameById.get(String(gameId));
    if (!game) {
      throw publicationError(
        'PUBLICATION_GAME_NOT_FOUND',
        `Publication game ${gameId} is absent from Games.`,
        {gameId}
      );
    }
    return game;
  }).sort((a, b) =>
    weekIndex(a.Week) - weekIndex(b.Week) ||
    String(a['Game ID']).localeCompare(String(b['Game ID']))
  );

  const target = String(
    targetGameId ||
    publicationGames.at(-1)?.['Game ID'] ||
    ''
  );

  if (!target || !publicationGames.some(game => String(game['Game ID']) === target)) {
    throw publicationError(
      'INVALID_PUBLICATION_TARGET',
      'The publication target must be one of the publication games.',
      {gameId: target}
    );
  }

  const sourceByGame = new Map();

  for (const game of publicationGames) {
    const gameId = String(game['Game ID']);
    sourceByGame.set(
      gameId,
      gameId === target
        ? authoritativeRows(weekly, target)
        : frozenRows(publicRows, gameId)
    );
  }

  const publishedAt = gameId => {
    if (publishedAtByGame[gameId]) return String(publishedAtByGame[gameId]);

    const frozen = publicRows.find(row =>
      String(row['Game ID']) === gameId &&
      row['Published At']
    );

    return String(frozen?.['Published At'] || '');
  };

  const output = [];

  for (let snapshotIndex = 0; snapshotIndex < publicationGames.length; snapshotIndex += 1) {
    const snapshotGame = publicationGames[snapshotIndex];
    const snapshotGameId = String(snapshotGame['Game ID']);
    const snapshotWeek = String(snapshotGame.Week || '');
    const includedGames = publicationGames.slice(0, snapshotIndex + 1);

    const participantNames = [...new Set(
      includedGames.flatMap(game =>
        (sourceByGame.get(String(game['Game ID'])) || []).map(row => row.participant)
      )
    )];

    let snapshotRows = participantNames.map(participant => {
      const participantRows = includedGames.map(game => {
        const gameId = String(game['Game ID']);
        const row = (sourceByGame.get(gameId) || []).find(item => item.participant === participant);

        return row || {
          gameId,
          week: String(game.Week || ''),
          participant,
          score: 0,
          weeklyRank: '',
        };
      });

      const current = participantRows.find(row => row.gameId === snapshotGameId);
      const seasonPoints = round(participantRows.reduce((sum, row) => sum + row.score, 0));
      const average = includedGames.length
        ? round(seasonPoints / includedGames.length)
        : 0;

      const best = [...participantRows].sort((a, b) =>
        b.score - a.score ||
        weekIndex(a.week) - weekIndex(b.week)
      )[0];

      return {
        'Game ID': snapshotGameId,
        Week: snapshotWeek,
        'Weekly Rank': current?.weeklyRank ?? '',
        'Season Rank': '',
        Participant: participant,
        'Week Points': current?.score ?? 0,
        'Season Points': seasonPoints,
        Average: average,
        'Best Week': best?.week || '',
        Status: 'FINAL \u2022 OFFICIAL',
        'Published At': publishedAt(snapshotGameId),
      };
    });

    snapshotRows = rankByPoints(snapshotRows, 'Season Points');
    output.push(...snapshotRows);
  }

  return output;
}