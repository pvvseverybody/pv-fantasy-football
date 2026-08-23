import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../lib/google-sheets';
import {rowsToRecords} from '../../../lib/participant-experience.mjs';
import {publicLeaderboardFromSnapshots} from '../../../lib/public-leaderboard-snapshot.mjs';
import {logServerFailure} from '../../../lib/safe-server-log.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const week = new URL(request.url).searchParams.get('week') || '';

    const publicMatrix = await readSheetRange(
      "'PublicLeaderboard'!A3:K",
      {valueRenderOption:'UNFORMATTED_VALUE'}
    );

    const result = publicLeaderboardFromSnapshots(
      rowsToRecords(publicMatrix),
      week
    );

    return NextResponse.json(
      {
        ...result,
        status:result.weekly.length || result.cumulative.length
          ? 'available'
          : 'awaiting_results',
      },
      {headers:{'Cache-Control':'no-store'}}
    );
  } catch (error) {
    logServerFailure('leaderboard', error);

    return NextResponse.json(
      {
        weekly:[],
        cumulative:[],
        status:'backend_error',
        message:'Standings are temporarily unavailable.',
      },
      {
        status:500,
        headers:{'Cache-Control':'no-store'},
      }
    );
  }
}