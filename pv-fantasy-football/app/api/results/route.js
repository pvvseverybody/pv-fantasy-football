import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../lib/google-sheets';
import {participantResults,rowsToRecords} from '../../../lib/participant-experience.mjs';

export const dynamic='force-dynamic';
export async function POST(request){
  try{
    const email=String((await request.json()).email||'').trim().toLowerCase();
    if(!email||!email.includes('@'))return NextResponse.json({found:false,code:'INVALID_IDENTITY',message:'Enter your registered email.'},{status:400});
    const ranges=["'Participants'!A3:K1000","'ActiveLineups'!A3:N1000","'Picks'!A3:O2000","'PlayerScores'!A3:V2000","'WeeklyScores'!A3:H1000","'Games'!A3:M100","'Players'!A3:H1000","'PublishControl'!A3:N200"];
    const [participants,active,picks,scores,weekly,games,players,publish]=await Promise.all(ranges.map(range=>readSheetRange(range)));
    const release=rowsToRecords(publish).find(row=>String(row.Control).toUpperCase()==='OFFICIAL RELEASE');
    const result=participantResults({participants:rowsToRecords(participants),active:rowsToRecords(active),picks:rowsToRecords(picks),scores:rowsToRecords(scores),weekly:rowsToRecords(weekly),games:rowsToRecords(games),players:rowsToRecords(players),releaseStatus:release?.Status||''},email);
    if(!result)return NextResponse.json({found:false,code:'UNKNOWN_PARTICIPANT',message:'We could not find an active verified participant for that email.'},{status:404});
    return NextResponse.json({found:true,...result},{headers:{'Cache-Control':'no-store'}});
  }catch(error){console.error('POST /api/results failed:',error);return NextResponse.json({found:false,code:'BACKEND_ERROR',message:'Results are temporarily unavailable.'},{status:500});}
}
