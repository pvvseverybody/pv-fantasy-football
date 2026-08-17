import {NextResponse} from 'next/server';
import {getGameDayStatus} from '../../../../lib/game-day-status';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const gameId = new URL(request.url).searchParams.get('game_id')?.trim();
  if (!gameId) {
    return NextResponse.json(
      {readiness: 'BLOCKED', reasons: ['GAME_ID_REQUIRED']},
      {status: 400, headers: {'Cache-Control': 'no-store'}}
    );
  }
  try {
    const status = await getGameDayStatus(gameId);
    return NextResponse.json(status, {headers: {'Cache-Control': 'no-store'}});
  } catch {
    return NextResponse.json(
      {readiness: 'BLOCKED', game_id: gameId, reasons: ['BACKEND_STATE_UNAVAILABLE']},
      {status: 503, headers: {'Cache-Control': 'no-store'}}
    );
  }
}
