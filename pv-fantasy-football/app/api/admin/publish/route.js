import {NextResponse} from 'next/server';
import {publishGame} from '../../../../lib/publication-service';
import {logServerFailure} from '../../../../lib/safe-server-log.mjs';

export const dynamic = 'force-dynamic';

const REVIEW_CODES = new Set([
  'PUBLICATION_NOT_READY',
  'PUBLICATION_LINEUPS_NOT_LOCKED',
  'PUBLICATION_WEEKLY_SCORE_INCOMPLETE',
  'PUBLICATION_SNAPSHOT_MISSING',
  'PUBLICATION_SNAPSHOT_ORPHANED',
  'DUPLICATE_WEEKLY_SCORE',
  'DUPLICATE_PUBLIC_SNAPSHOT',
]);

const CLIENT_CODES = new Set([
  'INVALID_PUBLICATION_GAME',
  'INVALID_PUBLICATION_TARGET',
  'PUBLICATION_GAME_NOT_FOUND',
]);

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        published:false,
        code:'INVALID_REQUEST_BODY',
        message:'A JSON body with game_id is required.',
      },
      {
        status:400,
        headers:{'Cache-Control':'no-store'},
      }
    );
  }

  const gameId = String(body?.game_id || '').trim();

  if (!gameId) {
    return NextResponse.json(
      {
        published:false,
        code:'GAME_ID_REQUIRED',
        message:'game_id is required.',
      },
      {
        status:400,
        headers:{'Cache-Control':'no-store'},
      }
    );
  }

  try {
    const result = await publishGame(gameId);

    return NextResponse.json(
      result,
      {
        status:result.correction ? 200 : 201,
        headers:{'Cache-Control':'no-store'},
      }
    );
  } catch (error) {
    const code = error?.code || 'PUBLICATION_FAILED';

    if (!REVIEW_CODES.has(code) && !CLIENT_CODES.has(code)) {
      logServerFailure('admin-publication', error);
    }

    const status =
      CLIENT_CODES.has(code) ? 400 :
      REVIEW_CODES.has(code) ? 422 :
      code === 'PUBLICATION_SCHEMA_MISMATCH' ||
      code === 'PUBLICATION_SHEET_NOT_FOUND' ||
      code === 'PUBLICATION_GRID_STATE_INVALID' ||
      code === 'PUBLICATION_DEPENDENCY_MISSING'
        ? 503
        : 500;

    return NextResponse.json(
      {
        published:false,
        code,
        message:error?.message || 'Publication failed.',
        ...(Array.isArray(error?.reasons)
          ? {reasons:error.reasons}
          : {}),
      },
      {
        status,
        headers:{'Cache-Control':'no-store'},
      }
    );
  }
}