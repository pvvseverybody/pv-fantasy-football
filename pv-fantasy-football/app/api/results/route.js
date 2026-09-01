import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../lib/google-sheets';
import {participantResults,rowsToRecords} from '../../../lib/participant-experience.mjs';
import {AUTH_COOKIE,authenticatedParticipantEmail,cookieValue,requiredAuthConfig,secureRequest} from '../../../lib/participant-auth.mjs';
import {participantAuthService} from '../../../lib/participant-auth-service';
import {logServerFailure} from '../../../lib/safe-server-log.mjs';

export const dynamic='force-dynamic';
export async function POST(request){
  try{
    if(!secureRequest(request))return NextResponse.json({found:false,code:'HTTPS_REQUIRED'},{status:400});
    requiredAuthConfig();const authenticated=await participantAuthService().authenticate(cookieValue(request,AUTH_COOKIE));
    if(!authenticated)return NextResponse.json({found:false,code:'UNAUTHENTICATED',message:'Sign in to view your results.'},{status:401});
    const ranges=["'Participants'!A3:K1000","'ActiveLineups'!A3:N1000","'Picks'!A3:O2000","'PlayerScores'!A3:V2000","'WeeklyScores'!A3:H1000","'Games'!A3:M100","'Players'!A3:H1000","'PublishControl'!A3:N200","'PublicLeaderboard'!A3:K"];
    const [participants,active,picks,scores,weekly,games,players,publish,publicSnapshots]=await Promise.all(ranges.map(range=>readSheetRange(range)));
    const release=rowsToRecords(publish).find(row=>String(row.Control).toUpperCase()==='OFFICIAL RELEASE');
    const result=participantResults({participants:rowsToRecords(participants),active:rowsToRecords(active),picks:rowsToRecords(picks),scores:rowsToRecords(scores),weekly:rowsToRecords(weekly),games:rowsToRecords(games),players:rowsToRecords(players),publicSnapshots:rowsToRecords(publicSnapshots),releaseStatus:release?.Status||''},authenticatedParticipantEmail(authenticated));
    if(!result)return NextResponse.json({found:false,code:'UNAUTHENTICATED',message:'Sign in to view your results.'},{status:401});
    return NextResponse.json({found:true,...result},{headers:{'Cache-Control':'no-store'}});
  }catch(error){logServerFailure('results',error);return NextResponse.json({found:false,code:error.code==='AUTH_NOT_CONFIGURED'?error.code:'BACKEND_ERROR',message:'Results are temporarily unavailable.'},{status:error.code==='AUTH_NOT_CONFIGURED'?503:500});}
}
