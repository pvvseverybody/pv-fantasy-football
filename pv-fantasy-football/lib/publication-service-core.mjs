import {buildPublicationSnapshots} from './publication-snapshot.mjs';
import {
  buildPublicationWritePlan,
  PUBLIC_LEADERBOARD_HEADERS,
} from './publication-write-plan.mjs';

const upper = value => String(value || '').trim().toUpperCase();

function publicationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function records(matrix = []) {
  if (!matrix.length) return [];
  const headers = matrix[0];

  return matrix
    .slice(1)
    .filter(row => row.some(value => value !== '' && value !== null && value !== undefined))
    .map(row =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? ''])
      )
    );
}

function assertPublicHeaders(matrix) {
  const actual = matrix[0] || [];
  const mismatch = PUBLIC_LEADERBOARD_HEADERS.findIndex(
    (header, index) => actual[index] !== header
  );

  if (mismatch !== -1 || actual.length < PUBLIC_LEADERBOARD_HEADERS.length) {
    throw publicationError(
      'PUBLICATION_SCHEMA_MISMATCH',
      `PublicLeaderboard column ${mismatch + 1} must be "${PUBLIC_LEADERBOARD_HEADERS[mismatch]}".`
    );
  }
}

function findRawGame(matrix, gameId) {
  const headers = matrix[0] || [];

  if (headers[0] !== 'Game ID' || headers[11] !== 'Published At') {
    throw publicationError(
      'PUBLICATION_SCHEMA_MISMATCH',
      'Games must have Game ID in column A and Published At in column L.'
    );
  }

  const matches = [];

  matrix.slice(1).forEach((row, index) => {
    if (String(row[0] || '') === gameId) {
      matches.push({
        row,
        rowNumber:index + 4,
      });
    }
  });

  if (matches.length !== 1) {
    throw publicationError(
      'PUBLICATION_GAME_ROW_INVALID',
      `Games must contain exactly one row for ${gameId}.`,
      {gameId, matches:matches.length}
    );
  }

  return matches[0];
}

function findSheet(metadata, title) {
  const sheet = (metadata?.sheets || []).find(
    item => item?.properties?.title === title
  );

  if (!sheet) {
    throw publicationError(
      'PUBLICATION_SHEET_NOT_FOUND',
      `Missing sheet: ${title}.`,
      {sheet:title}
    );
  }

  return sheet.properties;
}

function assertDependencies(deps) {
  const required = [
    'readGameDayTables',
    'evaluateReadiness',
    'readSheetRange',
    'getSpreadsheetMetadata',
    'batchUpdateSpreadsheet',
    'withGameWriterGate',
  ];

  for (const name of required) {
    if (typeof deps?.[name] !== 'function') {
      throw publicationError(
        'PUBLICATION_DEPENDENCY_MISSING',
        `Publication dependency ${name} is unavailable.`
      );
    }
  }
}

function sameNumber(actual, expected) {
  return Number.isFinite(Number(actual)) &&
    Math.abs(Number(actual) - Number(expected)) < 0.000001;
}

function assertVerifiedSnapshot(actualRows, expectedRows) {
  if (actualRows.length !== expectedRows.length) {
    throw publicationError(
      'PUBLICATION_VERIFICATION_FAILED',
      `PublicLeaderboard verification expected ${expectedRows.length} row(s) but found ${actualRows.length}.`
    );
  }

  const numericFields = new Set([
    'Season Rank',
    'Week Points',
    'Season Points',
    'Average',
  ]);

  for (let index = 0; index < expectedRows.length; index += 1) {
    const actual = actualRows[index];
    const expected = expectedRows[index];

    for (const header of PUBLIC_LEADERBOARD_HEADERS) {
      if (header === 'Weekly Rank') {
        const expectedBlank =
          expected[header] === '' ||
          expected[header] === null ||
          expected[header] === undefined;

        if (expectedBlank) {
          if (String(actual[header] ?? '') !== '') {
            throw publicationError(
              'PUBLICATION_VERIFICATION_FAILED',
              `PublicLeaderboard row ${index + 4} field ${header} did not verify.`
            );
          }
        } else if (!sameNumber(actual[header], expected[header])) {
          throw publicationError(
            'PUBLICATION_VERIFICATION_FAILED',
            `PublicLeaderboard row ${index + 4} field ${header} did not verify.`
          );
        }

        continue;
      }

      if (numericFields.has(header)) {
        if (!sameNumber(actual[header], expected[header])) {
          throw publicationError(
            'PUBLICATION_VERIFICATION_FAILED',
            `PublicLeaderboard row ${index + 4} field ${header} did not verify.`
          );
        }

        continue;
      }

      if (String(actual[header] ?? '') !== String(expected[header] ?? '')) {
        throw publicationError(
          'PUBLICATION_VERIFICATION_FAILED',
          `PublicLeaderboard row ${index + 4} field ${header} did not verify.`
        );
      }
    }
  }
}

export async function publishGameWithDeps(
  gameId,
  {
    now = new Date(),
    deps,
  } = {}
) {
  assertDependencies(deps);

  const normalizedGameId = String(gameId || '').trim();

  if (!normalizedGameId) {
    throw publicationError(
      'INVALID_PUBLICATION_GAME',
      'A game_id is required.'
    );
  }

  const publicationTime = now instanceof Date
    ? now
    : new Date(now);

  if (!Number.isFinite(publicationTime.getTime())) {
    throw publicationError(
      'PUBLICATION_TIMESTAMP_INVALID',
      'Publication time is invalid.'
    );
  }

  return deps.withGameWriterGate(normalizedGameId, async () => {
    const [
      tables,
      publicMatrix,
      gamesMatrix,
      metadata,
    ] = await Promise.all([
      deps.readGameDayTables(),
      deps.readSheetRange(
        "'PublicLeaderboard'!A3:K",
        {valueRenderOption:'UNFORMATTED_VALUE'}
      ),
      deps.readSheetRange(
        "'Games'!A3:M",
        {valueRenderOption:'UNFORMATTED_VALUE'}
      ),
      deps.getSpreadsheetMetadata(),
    ]);

    const readiness = deps.evaluateReadiness(
      tables,
      normalizedGameId,
      {now:publicationTime}
    );

    if (readiness?.readiness !== 'READY') {
      throw publicationError(
        'PUBLICATION_NOT_READY',
        `Game ${normalizedGameId} is ${readiness?.readiness || 'UNKNOWN'}, not READY.`,
        {
          gameId:normalizedGameId,
          readiness:readiness?.readiness || 'UNKNOWN',
          reasons:readiness?.reasons || [],
          diagnostics:readiness?.diagnostics || [],
        }
      );
    }

    const matchingGames = (tables.Games || []).filter(
      row => String(row['Game ID'] || '') === normalizedGameId
    );

    if (matchingGames.length !== 1) {
      throw publicationError(
        'PUBLICATION_GAME_ROW_INVALID',
        `Games must contain exactly one authoritative row for ${normalizedGameId}.`,
        {gameId:normalizedGameId, matches:matchingGames.length}
      );
    }

    const targetGame = matchingGames[0];

    if (upper(targetGame['Pick Status']) !== 'LOCKED') {
      throw publicationError(
        'PUBLICATION_LINEUPS_NOT_LOCKED',
        `Game ${normalizedGameId} cannot publish while Pick Status is ${targetGame['Pick Status'] || 'UNKNOWN'}.`,
        {
          gameId:normalizedGameId,
          pickStatus:targetGame['Pick Status'] || 'UNKNOWN',
        }
      );
    }

    assertPublicHeaders(publicMatrix);

    const publicRows = records(publicMatrix);
    const rawTargetGame = findRawGame(gamesMatrix, normalizedGameId);

    const publicSheet = findSheet(metadata, 'PublicLeaderboard');
    const gamesSheet = findSheet(metadata, 'Games');

    const publishedGameIds = (tables.Games || [])
      .filter(row => String(row['Published At'] || '').trim())
      .map(row => String(row['Game ID'] || '').trim())
      .filter(Boolean);

    const publishedSet = new Set(publishedGameIds);
    const targetWasPublished = publishedSet.has(normalizedGameId);

    for (const publishedGameId of publishedGameIds) {
      if (!publicRows.some(row => String(row['Game ID'] || '') === publishedGameId)) {
        throw publicationError(
          'PUBLICATION_SNAPSHOT_MISSING',
          `Published game ${publishedGameId} has no frozen PublicLeaderboard snapshot.`,
          {gameId:publishedGameId}
        );
      }
    }

    if (
      !targetWasPublished &&
      publicRows.some(row => String(row['Game ID'] || '') === normalizedGameId)
    ) {
      throw publicationError(
        'PUBLICATION_SNAPSHOT_ORPHANED',
        `PublicLeaderboard contains ${normalizedGameId}, but Games.Published At is blank.`,
        {gameId:normalizedGameId}
      );
    }

    const orphanedGameIds = [
      ...new Set(
        publicRows
          .map(row => String(row['Game ID'] || '').trim())
          .filter(Boolean)
          .filter(id => !publishedSet.has(id))
      ),
    ];

    if (orphanedGameIds.length) {
      throw publicationError(
        'PUBLICATION_SNAPSHOT_ORPHANED',
        'PublicLeaderboard contains snapshot rows not backed by Games.Published At.',
        {gameIds:orphanedGameIds}
      );
    }

    const acceptedCount = Number(readiness?.lineups?.accepted_count || 0);

    const validTargetWeekly = (tables.WeeklyScores || []).filter(row =>
      String(row['Game ID'] || '') === normalizedGameId &&
      upper(row.Validation) === 'VALID' &&
      row['Participant ID'] &&
      row['Display Name']
    );

    if (
      acceptedCount < 1 ||
      validTargetWeekly.length !== acceptedCount
    ) {
      throw publicationError(
        'PUBLICATION_WEEKLY_SCORE_INCOMPLETE',
        `Game ${normalizedGameId} has ${validTargetWeekly.length} valid WeeklyScores row(s) for ${acceptedCount} accepted lineup(s).`,
        {
          gameId:normalizedGameId,
          validWeeklyScores:validTargetWeekly.length,
          acceptedCount,
        }
      );
    }

    const publicationGameIds = [
      ...new Set([...publishedGameIds, normalizedGameId]),
    ];

    const publishedAt = publicationTime.toISOString();

    const snapshotRows = buildPublicationSnapshots({
      games:tables.Games || [],
      weekly:tables.WeeklyScores || [],
      publicRows,
      publicationGameIds,
      targetGameId:normalizedGameId,
      publishedAtByGame:{
        [normalizedGameId]:publishedAt,
      },
    });

    if (!snapshotRows.some(
      row => String(row['Game ID'] || '') === normalizedGameId
    )) {
      throw publicationError(
        'EMPTY_PUBLICATION_SNAPSHOT',
        `No public snapshot rows were produced for ${normalizedGameId}.`,
        {gameId:normalizedGameId}
      );
    }

    const plan = buildPublicationWritePlan({
      publicSheetId:publicSheet.sheetId,
      gamesSheetId:gamesSheet.sheetId,
      gamesRowNumber:rawTargetGame.rowNumber,
      currentPublicGridRowCount:Number(
        publicSheet.gridProperties?.rowCount || 0
      ),
      existingPublicDataRowCount:publicRows.length,
      snapshotRows,
      publishedAt,
    });

    await deps.batchUpdateSpreadsheet(plan.requests);

    const [
      verifiedPublicMatrix,
      verifiedGamesMatrix,
    ] = await Promise.all([
      deps.readSheetRange(
        "'PublicLeaderboard'!A3:K",
        {valueRenderOption:'UNFORMATTED_VALUE'}
      ),
      deps.readSheetRange(
        "'Games'!A3:M",
        {valueRenderOption:'UNFORMATTED_VALUE'}
      ),
    ]);

    assertPublicHeaders(verifiedPublicMatrix);

    const verifiedPublicRows = records(verifiedPublicMatrix);
    assertVerifiedSnapshot(verifiedPublicRows, snapshotRows);

    const verifiedTarget = findRawGame(
      verifiedGamesMatrix,
      normalizedGameId
    );

    if (String(verifiedTarget.row[11] || '') !== publishedAt) {
      throw publicationError(
        'PUBLICATION_VERIFICATION_FAILED',
        'Games.Published At did not verify after the publication batch.',
        {
          gameId:normalizedGameId,
          expected:publishedAt,
          actual:verifiedTarget.row[11] || '',
        }
      );
    }

    return {
      published:true,
      code:targetWasPublished
        ? 'PUBLICATION_CORRECTED'
        : 'PUBLICATION_PUBLISHED',
      game_id:normalizedGameId,
      published_at:publishedAt,
      correction:targetWasPublished,
      public_rows:snapshotRows.length,
      publication_games:publicationGameIds.length,
      expanded_by_rows:plan.expanded_by_rows,
    };
  });
}