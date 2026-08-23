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
    /demo participant/i.test(String(row['Display Name'] || ''));
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

export function buildPublicationSnapshots({
  games = [],
  weekly = [],
  publicationGameIds = [],
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

  const validWeekly = weekly.filter(row =>
    row &&
    upper(row.Validation) === 'VALID' &&
    row['Participant ID'] &&
    !isDemoRecord(row)
  );

  const weeklyKey = new Set();
  for (const row of validWeekly) {
    const key = `${row['Game ID']}\n${row['Participant ID']}`;
    if (weeklyKey.has(key)) {
      throw publicationError(
        'DUPLICATE_WEEKLY_SCORE',
        'WeeklyScores contains more than one valid row for the same game and participant.',
        {gameId: row['Game ID'], participantId: row['Participant ID']}
      );
    }
    weeklyKey.add(key);
  }

  const output = [];

  for (let snapshotIndex = 0; snapshotIndex < publicationGames.length; snapshotIndex += 1) {
    const snapshotGame = publicationGames[snapshotIndex];
    const snapshotGameId = String(snapshotGame['Game ID']);
    const snapshotWeek = String(snapshotGame.Week || '');
    const includedGames = publicationGames.slice(0, snapshotIndex + 1);
    const includedIds = new Set(includedGames.map(game => String(game['Game ID'])));
    const publishedGameCount = includedGames.length;

    const cumulativeRows = validWeekly.filter(row => includedIds.has(String(row['Game ID'])));
    const participantIds = [...new Set(cumulativeRows.map(row => String(row['Participant ID'])))];

    let snapshotRows = participantIds.map(participantId => {
      const participantRows = cumulativeRows.filter(row => String(row['Participant ID']) === participantId);
      const current = participantRows.find(row => String(row['Game ID']) === snapshotGameId) || null;
      const latest = [...participantRows].sort((a, b) =>
        weekIndex(b.Week) - weekIndex(a.Week)
      )[0];

      const seasonPoints = round(participantRows.reduce((sum, row) => sum + number(row['Fantasy Score']), 0));
      const average = publishedGameCount ? round(seasonPoints / publishedGameCount) : 0;

      const best = [...participantRows].sort((a, b) =>
        number(b['Fantasy Score']) - number(a['Fantasy Score']) ||
        weekIndex(a.Week) - weekIndex(b.Week)
      )[0];

      return {
        'Game ID': snapshotGameId,
        Week: snapshotWeek,
        'Weekly Rank': current ? number(current['Weekly Rank']) : '',
        'Season Rank': '',
        Participant: latest?.['Display Name'] || '',
        'Week Points': current ? round(number(current['Fantasy Score'])) : 0,
        'Season Points': seasonPoints,
        Average: average,
        'Best Week': best?.Week || '',
        Status: 'FINAL • OFFICIAL',
        'Published At': String(publishedAtByGame[snapshotGameId] || ''),
      };
    });

    snapshotRows = rankByPoints(snapshotRows, 'Season Points');
    output.push(...snapshotRows);
  }

  return output;
}