import {NextResponse} from 'next/server';
import {runEspnGameAutomation} from '../../../../lib/espn-ingestion-service';
import {verifyWeek4GithubToken} from '../../../../lib/github-actions-oidc.mjs';
import {logServerFailure} from '../../../../lib/safe-server-log.mjs';

export const dynamic='force-dynamic';
export const maxDuration=60;

export async function POST(request){
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!await verifyWeek4GithubToken(token))return NextResponse.json({ok:false,code:'UNAUTHORIZED'},{status:401});
  try{return NextResponse.json({ok:true,...await runEspnGameAutomation('2026-W4',{espnEventId:'401868954',opponentTeamId:'2755'})},{headers:{'Cache-Control':'no-store'}});}
  catch(error){logServerFailure('week-4-automation',error);const review=['IDENTITY_REVIEW_REQUIRED','GAME_IDENTITY_MISMATCH','ESPN_EVENT_UNCONFIGURED'].includes(error.code);return NextResponse.json({ok:false,code:error.code||'AUTOMATION_FAILED',message:review?error.message:'Week 4 automation failed safely.',issues:error.issues||undefined},{status:review?422:500});}
}
