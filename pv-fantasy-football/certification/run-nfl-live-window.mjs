import {appendFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectEspnNflState,monitorLiveTransport} from '../lib/live-transport-monitor.mjs';
import {NFL_ENDPOINT,NFL_EVENT_ID,renderNflReport} from './run-nfl-live-transport.mjs';

export const NFL_KICKOFF='2026-08-21T00:00:00.000Z';
export const LIVE_INTERVAL_MS=15000;
export const LIVE_LEAD_MS=30*60*1000;
export const LIVE_MAX_DURATION_MS=9*60*60*1000;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchNfl(){const response=await fetch(NFL_ENDPOINT,{headers:{accept:'application/json','cache-control':'no-cache'}});if(!response.ok)throw new Error(`NFL endpoint returned HTTP ${response.status}.`);return response.json();}
async function lastJsonLine(path){try{const lines=(await readFile(path,'utf8')).trim().split(/\r?\n/).filter(Boolean);return lines.length?JSON.parse(lines.at(-1)):null;}catch(error){if(error.code==='ENOENT')return null;throw error;}}
export async function waitForStart(startAt,{nowMs=()=>Date.now(),wait=sleep,onTick=()=>{}}={}){while(nowMs()<startAt){const remaining=startAt-nowMs();onTick(remaining);await wait(Math.min(remaining,60000));}}

export async function runNflLiveWindow({nowMs=()=>Date.now(),wait=sleep}={}){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const evidenceDir=resolve(root,'reports','evidence');await mkdir(evidenceDir,{recursive:true});
  const prefix=`nfl-${NFL_EVENT_ID}-live`;const rawPath=resolve(evidenceDir,`${prefix}-raw.jsonl`);const evidencePath=resolve(evidenceDir,`${prefix}-events.jsonl`);const reportPath=resolve(root,'reports','nfl-live-window-certification.md');
  const startAt=Date.parse(NFL_KICKOFF)-LIVE_LEAD_MS;await waitForStart(startAt,{nowMs,wait,onTick:remaining=>process.stdout.write(`Waiting for live-window start: ${Math.ceil(remaining/60000)} minutes remaining.\n`)});
  const previousRaw=await lastJsonLine(rawPath);const initialSnapshot=previousRaw?.payload||null;
  let result;
  try{result=await monitorLiveTransport({fetchSnapshot:fetchNfl,inspectState:inspectEspnNflState,intervalMs:LIVE_INTERVAL_MS,maxSamples:2160,finalVerificationSamples:3,retryDelaysMs:[1000,2000,5000,10000],maxConsecutiveFailedSamples:20,maxDurationMs:LIVE_MAX_DURATION_MS,initialSnapshot,onEvidence:item=>appendFile(evidencePath,JSON.stringify(item)+'\n','utf8'),onRawSnapshot:item=>appendFile(rawPath,JSON.stringify(item)+'\n','utf8')});}
  catch(error){const failed={timestamp:new Date().toISOString(),type:'RUNNER_FATAL',message:error.message};await appendFile(evidencePath,JSON.stringify(failed)+'\n','utf8');result={evidence:[failed],stopped:'RUNNER_FATAL',rawSnapshotCount:0};}
  const historicalEvidence=[];try{for(const line of(await readFile(evidencePath,'utf8')).split(/\r?\n/).filter(Boolean))historicalEvidence.push(JSON.parse(line));}catch{}
  const complete={...result,evidence:historicalEvidence,endpoint:NFL_ENDPOINT,eventId:NFL_EVENT_ID,rawPath,evidencePath,kickoff:NFL_KICKOFF,intervalMs:LIVE_INTERVAL_MS};await writeFile(reportPath,renderNflReport(complete),'utf8');return{...complete,reportPath};
}

async function main(){const result=await runNflLiveWindow();process.stdout.write(`NFL live-window runner stopped: ${result.stopped}\nReport: ${result.reportPath}\n`);process.exitCode=result.stopped==='FINAL_VERIFIED'?0:2;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
