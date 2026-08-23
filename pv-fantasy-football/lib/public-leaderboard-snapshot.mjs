import {PUBLICATION_WEEK_ORDER} from './publication-snapshot.mjs';

const number = value => Number(value || 0);
const upper = value => String(value || '').trim().toUpperCase();

function leaderboardError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function weekIndex(week) {
  const index = PUBLICATION_WEEK_ORDER.indexOf(String(week || '').trim());
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function isDemoRecord(row = {}) {
  return /^DEMO-|^TEST-|^UNIT-/i.test(
    String(row['Game ID'] || '')
  ) || /demo participant/i.test(String(row.Participant || ''));
}

function validRank(value) {
  const rank = Number(value);
  return Number.isFinite(rank) && rank >= 1;
}

function assertSnapshotIntegrity(rows) {
  const participantKeys = new Set();
  const gameIds = new Set();

  for (const row of rows) {
    if (
      !row?.['Game ID'] ||
      !row?.Week ||
      !row?.Participant ||
      !row?.['Published At'] ||
      upper(row.Status) !== 'FINAL \u2022 OFFICIAL'
    ) {
      throw leaderboardError(
        'PUBLIC_LEADERBOARD_INVALID',
        'A published standings row is incomplete or not official.'
      );
    }

    if (!validRank(row['Season Rank'])) {
      throw leaderboardError(
        'PUBLIC_LEADERBOARD_INVALID',
        'A published standings row has an invalid Season Rank.',
        {participant:row.Participant}
      );
    }

    for (const field of ['Week Points','Season Points','Average']) {
      if (!Number.isFinite(Number(row[field]))) {
        throw leaderboardError(
          'PUBLIC_LEADERBOARD_INVALID',
          `A published standings row has an invalid ${field}.`,
          {participant:row.Participant}
        );
      }
    }

    const participantKey = String(row.Participant).trim().toLowerCase();

    if (participantKeys.has(participantKey)) {
      throw leaderboardError(
        'PUBLIC_LEADERBOARD_INVALID',
        'A published standings snapshot contains a duplicate participant.',
        {participant:row.Participant}
      );
    }

    participantKeys.add(participantKey);
    gameIds.add(String(row['Game ID']));
  }

  if (gameIds.size > 1) {
    throw leaderboardError(
      'PUBLIC_LEADERBOARD_INVALID',
      'A published week contains more than one game snapshot.'
    );
  }
}

export function publicLeaderboardFromSnapshots(
  publicRows = [],
  requestedWeek = ''
) {
  const requested = String(requestedWeek || '').trim();

  const publishedRows = publicRows.filter(row =>
    row &&
    row['Game ID'] &&
    row.Week &&
    row.Participant &&
    !isDemoRecord(row)
  );

  if (!publishedRows.length) {
    return {
      week:requested,
      status_label:'AWAITING OFFICIAL RESULTS',
      weekly:[],
      cumulative:[],
    };
  }

  const availableWeeks = [
    ...new Set(publishedRows.map(row => String(row.Week || '').trim())),
  ].filter(Boolean).sort((a, b) =>
    weekIndex(a) - weekIndex(b) ||
    a.localeCompare(b)
  );

  const selectedWeek = requested || availableWeeks.at(-1) || '';
  const selectedRows = publishedRows.filter(
    row => String(row.Week || '').trim() === selectedWeek
  );

  if (!selectedRows.length) {
    return {
      week:selectedWeek,
      status_label:'AWAITING OFFICIAL RESULTS',
      weekly:[],
      cumulative:[],
    };
  }

  assertSnapshotIntegrity(selectedRows);

  const weekly = selectedRows
    .filter(row => validRank(row['Weekly Rank']))
    .sort((a, b) =>
      number(a['Weekly Rank']) - number(b['Weekly Rank']) ||
      String(a.Participant).localeCompare(String(b.Participant))
    )
    .map(row => ({
      rank:number(row['Weekly Rank']),
      participant:String(row.Participant),
      points:number(row['Week Points']),
    }));

  const cumulative = [...selectedRows]
    .sort((a, b) =>
      number(a['Season Rank']) - number(b['Season Rank']) ||
      String(a.Participant).localeCompare(String(b.Participant))
    )
    .map(row => ({
      rank:number(row['Season Rank']),
      participant:String(row.Participant),
      season_points:number(row['Season Points']),
      average:number(row.Average),
      best_week:String(row['Best Week'] || ''),
    }));

  return {
    week:selectedWeek,
    status_label:String(selectedRows[0].Status || 'FINAL \u2022 OFFICIAL'),
    weekly,
    cumulative,
  };
}