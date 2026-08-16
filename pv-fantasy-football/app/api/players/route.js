import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../lib/google-sheets';

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

  // Keep flex eligibility side-safe even if future roster positions are added.
  if (side === 'OFF' && !slots.includes('Offensive Flex') && ['QB','RB','WR','TE'].includes(position)) {
    slots.push('Offensive Flex');
  }
  if (side === 'DEF' && !slots.includes('Defensive Flex') && ['DL','LB','DB'].includes(position)) {
    slots.push('Defensive Flex');
  }
  return slots;
}

export async function GET() {
  try {
    const rows = await readSheetRange('Players!A3:H1000');
    if (!rows.length) {
      return NextResponse.json({players: [], status: 'empty_roster'}, {status: 200});
    }

    const [header, ...data] = rows;
    const index = Object.fromEntries(header.map((name, i) => [name, i]));

    const players = data
      .filter(row => String(row[index['Active']] || '').trim().toUpperCase() === 'YES')
      .map(row => {
        const position = String(row[index['Position']] || '').trim();
        const side = String(row[index['Side']] || '').trim().toUpperCase();
        return {
          player_key: String(row[index['Player ID']] || '').trim(),
          display_name: String(row[index['Player Name']] || '').trim(),
          position,
          side,
          class_year: String(row[index['Class']] || '').trim(),
          jersey: String(row[index['Jersey']] || '').trim(),
          eligible_slots: slotsFor(position, side),
        };
      })
      .filter(p => p.player_key && p.display_name && p.eligible_slots.length > 0);

    return NextResponse.json(
      {players, count: players.length, status: 'live_google_sheets'},
      {headers: {'Cache-Control': 'no-store, max-age=0'}}
    );
  } catch (error) {
    console.error('GET /api/players failed:', error);
    return NextResponse.json(
      {players: [], status: 'backend_error', message: 'Unable to load the live PV player pool.'},
      {status: 500}
    );
  }
}
