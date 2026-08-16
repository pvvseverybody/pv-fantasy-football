import {createHash, timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {scoreGame} from '../../../lib/scoring-pipeline';

function authorized(request) {
  const expected = process.env.SCORING_PIPELINE_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || !supplied) return false;
  const expectedHash = createHash('sha256').update(expected).digest();
  const suppliedHash = createHash('sha256').update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({scored:false,code:'UNAUTHORIZED'}, {status:401});
  }
  try {
    const body = await request.json();
    const result = await scoreGame(body.game_id);
    return NextResponse.json({scored:true,...result});
  } catch (error) {
    console.error('POST /api/scoring failed:', error);
    const review = ['SCORING_INPUT_REVIEW_REQUIRED','MISSING_PLAYER_STAT_LINE'].includes(error.code);
    return NextResponse.json({
      scored:false,
      code:error.code || 'SCORING_FAILED',
      message:review ? error.message : 'Unable to calculate and propagate game scoring.',
      issues:error.issues || undefined,
      player_ids:error.playerIds || undefined,
    }, {status:review ? 422 : error.code === 'INVALID_GAME' ? 400 : 500});
  }
}
