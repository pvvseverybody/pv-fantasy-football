import {NextResponse} from 'next/server';
import {readGameDayTables} from '../../../../lib/game-day-status';
import {evaluateSeasonLaunchPreflight} from '../../../../lib/season-launch-preflight.mjs';
import {logServerFailure} from '../../../../lib/safe-server-log.mjs';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const tables=await readGameDayTables();
    const status=evaluateSeasonLaunchPreflight(tables);
    return NextResponse.json(status,{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    logServerFailure('admin-preflight',error);
    return NextResponse.json(
      {status:'BLOCKED',active_blockers:['BACKEND_STATE_UNAVAILABLE'],diagnostics:[{code:'BACKEND_STATE_UNAVAILABLE',severity:'BLOCKED',message:'Authoritative workbook state is unavailable.',recommended_action:'Verify server credentials and Google Sheets access before launch.'}]},
      {status:503,headers:{'Cache-Control':'no-store'}}
    );
  }
}
