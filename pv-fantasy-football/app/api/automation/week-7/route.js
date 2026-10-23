import {NextResponse} from 'next/server';
import {runEspnGameAutomation} from '../../../../lib/espn-ingestion-service';
import {publishGame} from '../../../../lib/publication-service';
import {verifyWeek7GithubToken} from '../../../../lib/github-actions-oidc.mjs';
import {logServerFailure} from '../../../../lib/safe-server-log.mjs';

export const dynamic='force-dynamic';
export const maxDuration=60;

export async function POST(request){
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!await verifyWeek7GithubToken(token))return NextResponse.json({ok:false,code:'UNAUTHORIZED'},{status:401});
  try{
    const automation=await runEspnGameAutomation('2026-W7',{espnEventId:'401868361',opponentTeamId:'2016',allowFinalReconciliation:true});
    const publication=await publishGame('2026-W7');
    return NextResponse.json({ok:true,...automation,publication},{headers:{'Cache-Control':'no-store'}});
  }
  catch(error){logServerFailure('week-7-automation',error);const review=['IDENTITY_REVIEW_REQUIRED','GAME_IDENTITY_MISMATCH','ESPN_EVENT_UNCONFIGURED','FINAL_STATS_UNAVAILABLE'].includes(error.code);return NextResponse.json({ok:false,code:error.code||'AUTOMATION_FAILED',message:review?error.message:'Week 7 automation failed safely.',issues:error.issues||undefined},{status:review?422:500});}
}
