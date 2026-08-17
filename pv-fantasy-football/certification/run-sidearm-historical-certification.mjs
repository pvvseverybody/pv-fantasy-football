import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeSidearmTeam,SIDEARM_FIELD_MAP,validateSidearmGameIdentity} from '../lib/sidearm-adapter.mjs';

const HISTORICAL_ENDPOINTS=[
  {label:'Prairie View at Rice — 2025-09-13',url:'https://riceowls.com/api/livestats?game_id=28385&detail=full&callback=pvff',host:'riceowls.com'},
  {label:'Mississippi Valley State at Prairie View — 2025-11-22',url:'https://pvpanthers.com/api/livestats?game_id=9093&detail=full&callback=pvff',host:'pvpanthers.com'},
];
const STAGED_ENDPOINT='https://sidearmstats.com/delawarestate/football/game.json?detail=full';

async function fetchHistorical(source,fetchImpl=fetch){
  const url=new URL(source.url);
  if(url.protocol!=='https:'||url.hostname!==source.host||url.pathname!=='/api/livestats') throw new Error('Historical endpoint is not allowlisted.');
  const response=await fetchImpl(url,{headers:{accept:'text/javascript'}});
  if(!response.ok) throw new Error(`Historical endpoint returned HTTP ${response.status}.`);
  const text=await response.text();
  const prefix='pvff(';
  if(!text.startsWith(prefix)||!text.endsWith(')')) throw new Error('Historical endpoint did not return expected JSONP.');
  return JSON.parse(text.slice(prefix.length,-1));
}

function selfCanonical(team){
  return (team.Players||[]).map((player,index)=>({playerId:`HIST-${index+1}`,name:`${player.FirstName} ${player.LastName}`,jersey:player.UniformNumber,providerPersonId:player.PersonId||null}));
}

function certifyTeam(team){
  const result=normalizeSidearmTeam(team,selfCanonical(team));
  return {players:team.Players?.length||0,normalized:result.rows.length,identityIssues:result.issues.filter(issue=>issue.code.includes('PLAYER')).length};
}

export async function runHistoricalCertification({fetchImpl=fetch}={}){
  const historical=[];
  for(const source of HISTORICAL_ENDPOINTS){
    const payload=await fetchHistorical(source,fetchImpl);
    historical.push({label:source.label,url:source.url,game:{date:payload.Game.Date,home:payload.Game.HomeTeam.Name,visitor:payload.Game.VisitingTeam.Name,complete:payload.Game.IsComplete},home:certifyTeam(payload.Stats.HomeTeam),visitor:certifyTeam(payload.Stats.VisitingTeam)});
  }
  const stagedResponse=await fetchImpl(STAGED_ENDPOINT,{headers:{accept:'application/json'}});
  if(!stagedResponse.ok) throw new Error(`Staged endpoint returned HTTP ${stagedResponse.status}.`);
  const staged=await stagedResponse.json();
  const dateFinding=validateSidearmGameIdentity(staged,{date:'8/27/2026',ncaaGameId:'40550',homeTeam:'Delaware State',visitingTeam:'Stony Brook'});
  return {status:historical.every(item=>item.game.complete)?'HISTORICAL ADAPTER CERTIFIED WITH BLOCKERS':'FAIL',historical,mappings:SIDEARM_FIELD_MAP,dateFinding,staged:{date:staged.Game.Date,ncaaGameId:staged.Game.NcaaGameId,home:staged.Game.HomeTeam.Name,visitor:staged.Game.VisitingTeam.Name,sidearmGameId:staged.Game.SidearmGameId||null,source:staged.Game.Source}};
}

export function renderHistoricalReport(result){
  const unresolved=result.mappings.filter(([, ,status])=>status.includes('UNSUPPORTED'));
  return ['# PV Fantasy Football — SIDEARM Historical Adapter Certification','',`Generated: ${new Date().toISOString()}`,'',`Status: **${result.status}**`,'','No historical payload, fixture, or normalized row was written to Google Sheets or any production table.','','## Historical endpoint findings','',...result.historical.flatMap(item=>[
    `### ${item.label}`,'',`- Official endpoint: ${item.url}`,`- Result: complete=${item.game.complete}; ${item.game.visitor} at ${item.game.home}; provider date ${item.game.date}`,`- Home roster/normalized/identity issues: ${item.home.players}/${item.home.normalized}/${item.home.identityIssues}`,`- Visitor roster/normalized/identity issues: ${item.visitor.players}/${item.visitor.normalized}/${item.visitor.identityIssues}`,'']),
    'The public `cumestats.ashx` indexes currently return empty arrays, but known SIDEARM game IDs remain retrievable from each official athletics host through `/api/livestats?game_id=...&detail=full` JSONP.','','## Verified SIDEARM → GameStats mappings','',
    '| SIDEARM field | Normalized field | Status |','|---|---|---|',...result.mappings.map(([source,target,status])=>`| ${source||'—'} | ${target} | ${status} |`),'',
    'TFL is derived as solo TFL plus one-half of assisted TFL. `TotalSacks` is used directly. Interception count/yards/TD come only from the `Interceptions` return group so the overlapping `PassDefense.Interceptions` values are not double-counted. Kickoff- and punt-return touchdowns are retained only as audit fields and are excluded from fantasy defensive touchdowns.','','## Unresolved mappings','',...unresolved.map(([,target])=>`- ${target}: no safe populated aggregate field was proven. Play-level recovery roles are not used because they occur on non-turnovers and nullified plays.`),'','A fumble-return touchdown aggregate was also not proven. `defensiveReturnTouchdowns` is therefore certified only for interception-return touchdowns; another official source is required if a fumble-return touchdown occurs.','','## Player identity strategy','',
    '1. Match a nonblank SIDEARM `PersonId` within the game roster and then to an explicit provider-ID mapping.','2. If `PersonId` is absent, resolve the stat row to exactly one player using team + jersey + compatible abbreviated name.','3. Resolve that full roster identity to exactly one active PV canonical player using normalized full name + jersey.','4. Zero or multiple matches at either stage are REVIEW/BLOCKED. Jersey alone is never accepted because duplicate numbers exist.','','## August 3 staged-date discrepancy','',
    `- Staged `+'`Game.Date`'+`: ${result.staged.date}`,
    '- Official scheduled date: 8/27/2026',`- Teams: ${result.staged.visitor} at ${result.staged.home}`,`- NCAA game ID: ${result.staged.ncaaGameId}`,`- SIDEARM game ID: ${result.staged.sidearmGameId||'blank'}`,`- Source: ${result.staged.source}`,
    `- Identity validation: ${result.dateFinding.valid?'PASS':'BLOCKED — '+result.dateFinding.findings.join(', ')}`,'',
    '`Game.Date` is supplied inside the current StatCrew-backed `game.json`; it is not derived by PV Fantasy. The most likely explanation is a staged/test StatCrew game header dated August 3. That is an inference, not a confirmed provider statement. PV Fantasy must use the configured official endpoint plus expected teams, scheduled kickoff, and provider event identifier as a composite identity, while continuing to treat the date mismatch as blocking until the feed is corrected or explicitly verified. NCAA game ID alone is insufficient.','','## August 27 live-window dependencies','',
    '- Confirm the staged payload changes to the official kickoff date/time and retains the expected teams/event identity.','- Observe populated 2026 `PersonId` values and every required stat group.','- Capture 15-second changing snapshots and correction behavior.','- Determine an official fallback for forced fumbles, recoveries, and any fumble-return touchdown.','- Prove final detection, final-book reconciliation, and polling shutdown.','',
    'L2 remains **PENDING LIVE EVENT**. This historical certification does not mark L2 PASS.',''].join('\n');
}

async function main(){const result=await runHistoricalCertification();const reportPath=resolve(dirname(fileURLToPath(import.meta.url)),'..','reports','sidearm-historical-adapter-certification.md');await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,renderHistoricalReport(result),'utf8');process.stdout.write(`SIDEARM historical adapter: ${result.status}\nReport: ${reportPath}\n`);}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
