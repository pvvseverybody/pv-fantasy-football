import 'server-only';
import {readSheetRange} from './google-sheets';
import {readGameDayTables,availableGames} from './game-day-status';
import {evaluateGameDayReadiness} from './game-day-readiness.mjs';
import {evaluateSeasonLaunchPreflight} from './season-launch-preflight.mjs';
import {evaluateProductionConfig} from './production-config.mjs';
import {WORKBOOK_SCHEMAS,validateWorkbookSchemas} from './workbook-schema.mjs';
import {evaluateSystemReadiness} from './system-readiness.mjs';
import {evaluateReleaseMode} from './beta-mode.mjs';
import {readBetaAcceptance} from './beta-acceptance-service';

const quote=name=>`'${name.replace(/'/g,"''")}'`;

export async function checkWorkbookConnectivity(reader=readSheetRange){
  const headersBySheet={};
  try{
    await Promise.all(Object.keys(WORKBOOK_SCHEMAS).map(async sheet=>{
      const rows=await reader(`${quote(sheet)}!A3:AZ3`);
      headersBySheet[sheet]=rows[0]||[];
    }));
    const schema=validateWorkbookSchemas(headersBySheet);
    return{status:schema.status==='COMPATIBLE'?'CONNECTED':'CONNECTED_WITH_SCHEMA_ERRORS',schema};
  }catch{
    return{status:'UNAVAILABLE',schema:{status:'UNKNOWN',sheets:[]}};
  }
}

export async function getSystemReadiness({environment=process.env,reader=readSheetRange}={}){
  const configuration=evaluateProductionConfig(environment);
  const releaseMode=evaluateReleaseMode(environment);const betaAcceptance=readBetaAcceptance(environment);
  if(configuration.groups.workbook!=='CONFIGURED')return evaluateSystemReadiness({configuration,connectivity:{status:'UNAVAILABLE',schema:{status:'UNKNOWN'}},preflight:{status:'BLOCKED'},gameReadiness:null,releaseMode,betaAcceptance});
  const [connectivity,tablesResult]=await Promise.all([checkWorkbookConnectivity(reader),readGameDayTables().then(tables=>({tables})).catch(()=>({tables:null}))]);
  if(!tablesResult.tables)return evaluateSystemReadiness({configuration,connectivity:{status:'UNAVAILABLE',schema:connectivity.schema},preflight:{status:'BLOCKED'},gameReadiness:null,releaseMode,betaAcceptance});
  const tables=tablesResult.tables;const games=availableGames(tables);const selected=games.find(game=>String((tables.Games||[]).find(row=>row['Game ID']===game.game_id)?.['Pick Status']).toUpperCase()==='OPEN')||games[0];
  const preflight=evaluateSeasonLaunchPreflight(tables);
  const gameReadiness=selected?evaluateGameDayReadiness(tables,selected.game_id):null;
  return evaluateSystemReadiness({configuration,connectivity,preflight,gameReadiness,releaseMode,betaAcceptance});
}
