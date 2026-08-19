import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../../lib/google-sheets';
import {AUTH_COOKIE,cookieValue,requiredAuthConfig} from '../../../../lib/participant-auth.mjs';
import {participantAuthService} from '../../../../lib/participant-auth-service';

const records=rows=>{if(!rows.length)return[];const[headers,...data]=rows;return data.filter(row=>row.some(value=>value!=='')).map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]??''])))};
const slotNames={OFF_FLEX:'Offensive Flex',DEF_FLEX:'Defensive Flex'};
export const dynamic='force-dynamic';

export async function GET(request){
  try{
    requiredAuthConfig();const participant=await participantAuthService().authenticate(cookieValue(request,AUTH_COOKIE));
    if(!participant)return NextResponse.json({state:'UNAUTHENTICATED',message:'Sign in to view your accepted lineup.'},{status:401});
    const [activeRows,pickRows,gameRows]=await Promise.all([readSheetRange("'ActiveLineups'!A3:N1000"),readSheetRange("'Picks'!A3:O2000"),readSheetRange("'Games'!A3:M100")]);
    const active=records(activeRows).filter(row=>row['Participant ID']===participant.id&&String(row['Accepted?']).toUpperCase()==='YES'&&String(row['Scoring Version?']).toUpperCase()==='YES').sort((a,b)=>String(b.Week).localeCompare(String(a.Week),undefined,{numeric:true}))[0];
    if(!active)return NextResponse.json({state:'NO_LINEUP',message:'No accepted lineup has been submitted yet.'},{headers:{'Cache-Control':'no-store'}});
    const game=records(gameRows).find(row=>row['Game ID']===active['Game ID'])||{};const open=String(game['Pick Status']).toUpperCase()==='OPEN';
    const picks=records(pickRows).filter(row=>row['Submission ID']===active['Active Submission ID']&&String(row['Valid?']).toUpperCase()==='YES'&&String(row['Scoring Version?']).toUpperCase()==='YES'&&['ACCEPTED','ACTIVE'].includes(String(row['Submission State']).toUpperCase())).map(row=>({slot:slotNames[row['Slot ID']]||row['Slot ID'],player_key:row['Player ID']}));
    if(picks.length!==8)return NextResponse.json({state:'UNAVAILABLE',message:'Your accepted lineup is temporarily unavailable while it is reconciled.'},{status:503});
    return NextResponse.json({state:open?'ACCEPTED_EDITABLE':'SCORING_LINEUP',message:open?'Your accepted lineup is still editable before lock.':'This is your locked scoring lineup.',game_id:active['Game ID'],week:active.Week,opponent:game.Opponent||'',kickoff_ct:game['Kickoff (CT)']||'',replaced_previous:Number(active.Version)>1,picks},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({state:'UNAVAILABLE',message:'Your accepted lineup is temporarily unavailable.'},{status:503})}
}
