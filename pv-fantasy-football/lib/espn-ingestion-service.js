import {batchUpdateSpreadsheet,getSpreadsheetMetadata,readSheetRange} from './google-sheets';
import {centralKickoffEpoch} from './participant-experience.mjs';
import {fetchEspnSummary,inspectEspnGame,normalizeEspnPvStats,normalizedName} from './espn-adapter.mjs';
import {scoreGame} from './scoring-pipeline';

const records=rows=>{if(!rows.length)return[];const[headers,...data]=rows;return data.filter(row=>row.some(value=>value!==''&&value!==undefined)).map((row,index)=>({...Object.fromEntries(headers.map((header,column)=>[header,row[column]??''])),__row:index+4}));};
const valueData=value=>typeof value==='number'?{userEnteredValue:{numberValue:value}}:{userEnteredValue:{stringValue:String(value??'')}};
const updateRow=(sheetId,rowNumber,values)=>({updateCells:{range:{sheetId,startRowIndex:rowNumber-1,endRowIndex:rowNumber,startColumnIndex:0,endColumnIndex:values.length},rows:[{values:values.map(valueData)}],fields:'userEnteredValue'}});
const updateCell=(sheetId,rowNumber,columnIndex,value)=>({updateCells:{range:{sheetId,startRowIndex:rowNumber-1,endRowIndex:rowNumber,startColumnIndex:columnIndex,endColumnIndex:columnIndex+1},rows:[{values:[valueData(value)]}],fields:'userEnteredValue'}});
const first=(row,names)=>names.map(name=>row[name]).find(value=>String(value??'').trim())??'';

function automationError(code,message,details={}){const error=new Error(message);error.code=code;Object.assign(error,details);return error;}
function sheetId(metadata,title){const sheet=(metadata.sheets||[]).find(item=>item.properties.title===title);if(!sheet)throw automationError('SCHEMA_MISMATCH',`Missing sheet ${title}.`);return sheet.properties.sheetId;}
function aliasesFrom(rows){const map=new Map();for(const row of records(rows)){const source=first(row,['Provider Name','Source Name','Alias','Raw Name']);const target=first(row,['Player Name','Roster Name','Canonical Name','PV Player Name']);if(source&&target)map.set(normalizedName(source),target);}return map;}

export async function runEspnGameAutomation(gameId,{now=new Date(),espnEventId='',fetchSummary=fetchEspnSummary,score=scoreGame}={}){
  const normalizedGameId=String(gameId||'').trim();if(!normalizedGameId)throw automationError('INVALID_GAME','game_id is required.');
    const [gameRows,feedRows,playerRows,nameRows,statsRows,metadata]=await Promise.all([
      readSheetRange("'Games'!A3:L100",{valueRenderOption:'FORMATTED_VALUE'}),
      readSheetRange("'FeedControl'!A3:N100",{valueRenderOption:'FORMATTED_VALUE'}),
      readSheetRange("'Players'!A3:Z1000",{valueRenderOption:'FORMATTED_VALUE'}),
      readSheetRange("'NameMap'!A3:J1000",{valueRenderOption:'FORMATTED_VALUE'}),
      readSheetRange("'GameStats'!A3:Z1000",{valueRenderOption:'UNFORMATTED_VALUE'}),getSpreadsheetMetadata(),
    ]);
    const games=records(gameRows),feeds=records(feedRows);const game=games.find(row=>row['Game ID']===normalizedGameId);const feed=feeds.find(row=>row['Game ID']===normalizedGameId);
    if(!game||!feed)throw automationError('GAME_CONFIGURATION_MISSING','Games and FeedControl must both contain the game.');
    const eventId=String(espnEventId||first(feed,['ESPN Event ID','Event ID'])||'').trim();
    if(!/^\d+$/.test(eventId))throw automationError('ESPN_EVENT_UNCONFIGURED','FeedControl Event ID must be the ESPN numeric event ID.');
    const kickoff=centralKickoffEpoch(game['Kickoff (CT)']);if(!kickoff)throw automationError('INVALID_KICKOFF','The authoritative kickoff cannot be parsed.');
    if(now.getTime()<kickoff-2*60*60*1000)return{game_id:normalizedGameId,status:'TOO_EARLY',next_action:'WAIT_FOR_LIVE_WINDOW'};
    if(now.getTime()>kickoff+12*60*60*1000)return{game_id:normalizedGameId,status:'WINDOW_CLOSED',next_action:'OFFICIAL_RECONCILIATION'};

    const requests=[];
    if(now.getTime()>=kickoff&&String(game['Pick Status']).toUpperCase()==='OPEN')requests.push(updateCell(sheetId(metadata,'Games'),game.__row,9,'LOCKED'));
    if(requests.length)await batchUpdateSpreadsheet(requests);

    const snapshot=await fetchSummary(eventId);const identity=inspectEspnGame(snapshot.payload,{eventId});
    if(!identity.valid)throw automationError('GAME_IDENTITY_MISMATCH','ESPN game identity failed closed.',{issues:identity.findings});
    if(identity.state==='pre')return{game_id:normalizedGameId,status:'PREGAME',lineups_locked:now.getTime()>=kickoff};
    const normalized=normalizeEspnPvStats(snapshot.payload,{players:records(playerRows),aliases:aliasesFrom(nameRows),gameId:normalizedGameId,week:game.Week,sourceUrl:snapshot.sourceUrl,importedAt:snapshot.fetchedAt});
    if(!normalized.valid)throw automationError('IDENTITY_REVIEW_REQUIRED','ESPN player identity requires review before any write.',{issues:normalized.findings});

    const existing=records(statsRows);const byPlayer=new Map(existing.filter(row=>row['Game ID']===normalizedGameId).map(row=>[row['Player ID'],row.__row]));
    let nextRow=Math.max(4,...existing.map(row=>row.__row))+1;const statsSheetId=sheetId(metadata,'GameStats');
    const writes=normalized.rows.map(row=>updateRow(statsSheetId,byPlayer.get(row[2])||nextRow++,row));
    await batchUpdateSpreadsheet(writes);
    const scoring=await score(normalizedGameId);
    return{game_id:normalizedGameId,status:identity.completed?'FINAL_REVIEW_REQUIRED':'LIVE_PROVISIONAL',players_normalized:normalized.rows.length,scoring,official_publication:false};
}
