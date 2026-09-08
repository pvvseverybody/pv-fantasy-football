export function isAcceptedScoringPickRow(row, gameId = '') {
  return (!gameId || row[1] === gameId) && row[13] === 'YES' && row[14] === 'ACCEPTED';
}
