export const PUBLIC_LEADERBOARD_HEADERS = Object.freeze([
  'Game ID',
  'Week',
  'Weekly Rank',
  'Season Rank',
  'Participant',
  'Week Points',
  'Season Points',
  'Average',
  'Best Week',
  'Status',
  'Published At',
]);

const PUBLIC_DATA_START_ROW_INDEX = 3;

function planError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function valueData(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {userEnteredValue:{numberValue:value}};
  }

  return {userEnteredValue:{stringValue:String(value ?? '')}};
}

function rowData(values) {
  return {values:values.map(valueData)};
}

function blankValues() {
  return Array(PUBLIC_LEADERBOARD_HEADERS.length).fill('');
}

function snapshotValues(row) {
  return PUBLIC_LEADERBOARD_HEADERS.map(header => row?.[header] ?? '');
}

function assertSnapshotRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw planError(
      'EMPTY_PUBLICATION_SNAPSHOT',
      'Publication requires at least one public standings row.'
    );
  }

  for (const row of rows) {
    if (!row?.['Game ID'] || !row?.Week || !row?.Participant || !row?.['Published At']) {
      throw planError(
        'INVALID_PUBLICATION_SNAPSHOT',
        'Every public standings row requires Game ID, Week, Participant, and Published At.'
      );
    }

    for (const field of ['Week Points','Season Points','Average']) {
      if (!Number.isFinite(Number(row[field]))) {
        throw planError(
          'INVALID_PUBLICATION_SNAPSHOT',
          `Public standings field "${field}" must be numeric.`,
          {field, participant:row.Participant}
        );
      }
    }

    if (!Number.isFinite(Number(row['Season Rank'])) || Number(row['Season Rank']) < 1) {
      throw planError(
        'INVALID_PUBLICATION_SNAPSHOT',
        'Every public standings row requires a valid Season Rank.',
        {participant:row.Participant}
      );
    }

    if (row['Weekly Rank'] !== '' &&
        row['Weekly Rank'] !== null &&
        row['Weekly Rank'] !== undefined &&
        !Number.isFinite(Number(row['Weekly Rank']))) {
      throw planError(
        'INVALID_PUBLICATION_SNAPSHOT',
        'Weekly Rank must be numeric or blank.',
        {participant:row.Participant}
      );
    }
  }
}

export function buildPublicationWritePlan({
  publicSheetId,
  gamesSheetId,
  gamesRowNumber,
  gamesPublishedAtColumnIndex,
  currentPublicGridRowCount,
  existingPublicDataRowCount,
  snapshotRows,
  publishedAt,
} = {}) {
  if (!Number.isInteger(publicSheetId) || !Number.isInteger(gamesSheetId)) {
    throw planError(
      'PUBLICATION_SHEET_NOT_FOUND',
      'PublicLeaderboard and Games sheet IDs are required.'
    );
  }

  if (!Number.isInteger(gamesRowNumber) || gamesRowNumber < 4) {
    throw planError(
      'PUBLICATION_GAME_ROW_INVALID',
      'The target Games row must be row 4 or later.'
    );
  }

  if (!Number.isInteger(gamesPublishedAtColumnIndex) ||
      gamesPublishedAtColumnIndex < 0) {
    throw planError(
      'PUBLICATION_GAME_COLUMN_INVALID',
      'The Games Published At column index is required.'
    );
  }

  if (!positiveInteger(currentPublicGridRowCount) ||
      !positiveInteger(existingPublicDataRowCount)) {
    throw planError(
      'PUBLICATION_GRID_STATE_INVALID',
      'PublicLeaderboard grid dimensions are invalid.'
    );
  }

  if (currentPublicGridRowCount < PUBLIC_DATA_START_ROW_INDEX) {
    throw planError(
      'PUBLICATION_GRID_STATE_INVALID',
      'PublicLeaderboard does not contain the required header rows.'
    );
  }

  const publishedAtText = String(publishedAt || '').trim();
  if (!publishedAtText || !Number.isFinite(Date.parse(publishedAtText))) {
    throw planError(
      'PUBLICATION_TIMESTAMP_INVALID',
      'Published At must be a valid timestamp.'
    );
  }

  assertSnapshotRows(snapshotRows);

  const replacementRowCount = Math.max(
    snapshotRows.length,
    existingPublicDataRowCount
  );

  const requiredPublicGridRowCount =
    PUBLIC_DATA_START_ROW_INDEX + replacementRowCount;

  const requests = [];

  if (requiredPublicGridRowCount > currentPublicGridRowCount) {
    requests.push({
      appendDimension:{
        sheetId:publicSheetId,
        dimension:'ROWS',
        length:requiredPublicGridRowCount - currentPublicGridRowCount,
      },
    });
  }

  const replacementRows = [
    ...snapshotRows.map(row => snapshotValues(row)),
    ...Array.from(
      {length:replacementRowCount - snapshotRows.length},
      () => blankValues()
    ),
  ];

  requests.push({
    updateCells:{
      range:{
        sheetId:publicSheetId,
        startRowIndex:PUBLIC_DATA_START_ROW_INDEX,
        endRowIndex:PUBLIC_DATA_START_ROW_INDEX + replacementRowCount,
        startColumnIndex:0,
        endColumnIndex:PUBLIC_LEADERBOARD_HEADERS.length,
      },
      rows:replacementRows.map(rowData),
      fields:'userEnteredValue',
    },
  });

  requests.push({
    updateCells:{
      range:{
        sheetId:gamesSheetId,
        startRowIndex:gamesRowNumber - 1,
        endRowIndex:gamesRowNumber,
        startColumnIndex:gamesPublishedAtColumnIndex,
        endColumnIndex:gamesPublishedAtColumnIndex + 1,
      },
      rows:[rowData([publishedAtText])],
      fields:'userEnteredValue',
    },
  });

  return {
    requests,
    snapshot_row_count:snapshotRows.length,
    replacement_row_count:replacementRowCount,
    required_public_grid_row_count:requiredPublicGridRowCount,
    expanded_by_rows:Math.max(
      0,
      requiredPublicGridRowCount - currentPublicGridRowCount
    ),
    games_row_number:gamesRowNumber,
    published_at:publishedAtText,
  };
}