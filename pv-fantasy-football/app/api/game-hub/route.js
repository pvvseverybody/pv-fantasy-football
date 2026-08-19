import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../lib/google-sheets';
import {logServerFailure} from '../../../lib/safe-server-log.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await readSheetRange('Games!A3:M40');
    const [header, ...data] = rows;
    const ix = Object.fromEntries(header.map((v,i)=>[v,i]));
    const games = data.filter(r => r[ix['Game ID']]).map(r => ({
      week: r[ix['Week']] || '',
      game_id: r[ix['Game ID']] || '',
      kickoff_ct: r[ix['Kickoff (CT)']] || '',
      opponent: r[ix['Opponent']] || '',
      site: r[ix['Site']] || '',
      location: r[ix['Location']] || '',
      pick_status: r[ix['Pick Status']] || '',
      stats_final: r[ix['Stats Final?']] || 'NO'
    }));
    return NextResponse.json({games, status:'live_google_sheets'}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    logServerFailure('game-hub',error);
    return NextResponse.json({games:[],status:'backend_error'}, {status:500});
  }
}
