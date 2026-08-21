import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../lib/google-sheets';
import {publicPlayerDirectory,rowsToRecords} from '../../../lib/participant-experience.mjs';
import {logServerFailure} from '../../../lib/safe-server-log.mjs';

export const dynamic = 'force-dynamic';

const SLOT_RULES = {
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  'Offensive Flex': ['QB', 'RB', 'WR', 'TE'],
  DL: ['DL'],
  LB: ['LB'],
  DB: ['DB'],
  'Defensive Flex': ['DL', 'LB', 'DB'],
};

function slotsFor(position, side) {
  const slots = Object.entries(SLOT_RULES)
    .filter(([, positions]) => positions.includes(position))
    .map(([slot]) => slot);

  if (side === 'OFF' && !slots.includes('Offensive Flex') && ['QB','RB','WR','TE'].includes(position)) {
    slots.push('Offensive Flex');
  }
  if (side === 'DEF' && !slots.includes('Defensive Flex') && ['DL','LB','DB'].includes(position)) {
    slots.push('Defensive Flex');
  }
  return slots;
}

export async function GET(request) {
  try {
    const week = new URL(request.url).searchParams.get('week') || '';

    const [playerRows,scoreRows,gameRows,publishRows] = await Promise.all([
      readSheetRange("'Players'!A3:H1000"),
      readSheetRange("'PlayerScores'!A3:V2000"),
      readSheetRange("'Games'!A3:M100"),
      readSheetRange("'PublishControl'!A3:N200"),
    ]);

    const players = rowsToRecords(playerRows)
      .filter(row => String(row.Active || '').trim().toUpperCase() === 'YES')
      .map(row => {
        const position = String(row.Position || '').trim();
        const side = String(row.Side || '').trim().toUpperCase();

        return {
          player_key: String(row['Player ID'] || '').trim(),
          display_name: String(row['Player Name'] || '').trim(),
          position,
          side,
          class_year: String(row.Class || '').trim(),
          jersey: String(row.Jersey || '').trim(),
          eligible_slots: slotsFor(position, side),
        };
      })
      .filter(player => player.player_key && player.display_name && player.eligible_slots.length > 0);

    const publish = rowsToRecords(publishRows);
    const release = publish.find(row => String(row.Control || '').toUpperCase() === 'OFFICIAL RELEASE');

    const result = publicPlayerDirectory({
      players,
      scores: rowsToRecords(scoreRows),
      games: rowsToRecords(gameRows),
      releaseStatus: release?.Status || '',
    }, week);

    return NextResponse.json(
      {
        ...result,
        count: result.players.length,
        status: result.players.length ? 'live_google_sheets' : 'empty_roster',
      },
      {headers: {'Cache-Control': 'no-store, max-age=0'}}
    );
  } catch (error) {
    logServerFailure('players',error);
    return NextResponse.json(
      {players: [], status: 'backend_error', message: 'Unable to load the live PV player pool.'},
      {status: 500}
    );
  }
}