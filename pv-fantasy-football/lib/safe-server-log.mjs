const SAFE_CODES=new Set(['AUTH_NOT_CONFIGURED','INVALID_IDENTITY','IDENTITY_REVIEW_REQUIRED','LATE_SUBMISSION','UNSUPPORTED_OR_MISSING_STATS','MISSING_PLAYER_STAT_LINE','DUPLICATE_PLAYER_ROW']);
export function logServerFailure(operation, error) {
  const code = SAFE_CODES.has(error?.code) ? error.code : 'INTERNAL_FAILURE';
  const status = Number.isInteger(error?.status) ? error.status : undefined;
  console.error(JSON.stringify({operation, code, ...(status ? {status} : {})}));
}