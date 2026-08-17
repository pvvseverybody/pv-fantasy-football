import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../lib/google-sheets';
import {publicLeaderboard,rowsToRecords} from '../../../lib/participant-experience.mjs';

export const dynamic='force-dynamic';
export async function GET(request){
  try{
    const week=new URL(request.url).searchParams.get('week')||'';
    const [weekly,leaderboard,games,publish]=await Promise.all([readSheetRange("'WeeklyScores'!A3:H1000"),readSheetRange("'Leaderboard'!A3:S1000"),readSheetRange("'Games'!A3:M100"),readSheetRange("'PublishControl'!A3:N200")]);
    const release=rowsToRecords(publish).find(row=>String(row.Control).toUpperCase()==='OFFICIAL RELEASE');
    const result=publicLeaderboard({weekly:rowsToRecords(weekly),leaderboard:rowsToRecords(leaderboard),games:rowsToRecords(games),releaseStatus:release?.Status||''},week);
    return NextResponse.json({...result,status:result.weekly.length||result.cumulative.length?'available':'awaiting_results'},{headers:{'Cache-Control':'no-store'}});
  }catch(error){console.error('GET /api/leaderboard failed:',error);return NextResponse.json({weekly:[],cumulative:[],status:'backend_error',message:'Standings are temporarily unavailable.'},{status:500});}
}
