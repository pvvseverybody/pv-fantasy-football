import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGameDayReadiness} from '../lib/game-day-readiness.mjs';

const gameId='2026-W0';
function fixture(){const ids=Array.from({length:8},(_,index)=>`PV-${index+1}`),submission='SUB-A';return{Games:[{'Game ID':gameId,'Pick Status':'LOCKED','Stats Final?':'YES'}],FeedControl:[{'Game ID':gameId,'Feed Status':'FINAL','Final?':'YES','Poll Sec':15}],RunnerState:[{'Game ID':gameId,'Last Game State':'FINAL','Poll Sec':15,'Consecutive Errors':0}],FeedSnapshots:[{'Game ID':gameId,'Captured At CT':'2026-08-30T04:00:00Z'}],IngestionLog:[{'Game ID':gameId,'Started At':'2026-08-30T04:00:00Z',Status:'PASS'}],IngestionQA:[],SubmissionHistory:[{'Game ID':gameId,'Submission ID':submission,Status:'ACCEPTED','On Time?':'YES'}],Picks:ids.map((id,index)=>({'Game ID':gameId,'Submission ID':submission,'Player ID':id,'Slot ID':`S${index}`,'Valid?':'YES','Scoring Version?':'YES','Submission State':'ACCEPTED','Fantasy Points':index+1})),Lineups:[{'Game ID':gameId,'Participant ID':'P1','Submission ID':submission,'Fantasy Score':36}],ActiveLineups:[{'Game ID':gameId,'Participant ID':'P1','Active Submission ID':submission,'Accepted?':'YES','Scoring Version?':'YES','Fantasy Score':36}],WeeklyScores:[{'Game ID':gameId,'Participant ID':'P1','Fantasy Score':36}],GameStats:ids.map(id=>({'Game ID':gameId,'Player ID':id,'Forced Fumble':0,'Fumble Recovery':0,'Def Return TD':0})),PlayerScores:ids.map((id,index)=>({'Game ID':gameId,'Player ID':id,TOTAL:index+1})),Reconciliation:[{'Game ID':gameId,'Feed Final?':'YES','Official Final?':'YES','Stat Differences':0,'Unmatched Names':0,'QA Open Critical':0,'Reconciliation Status':'PASS','Lock Status':'READY_TO_LOCK'}],InvariantMonitor:[],WriterGate:[],ScoringGate:[],ScoringE2E:[],PublishControl:[{Control:'OFFICIAL RELEASE',Status:'PUBLISH'}]}}
const reasons=tables=>evaluateGameDayReadiness(tables,gameId,{now:new Date('2026-08-30T04:01:00Z')}).reasons;

test('provider, identity, stats, reconciliation, and publication failures all close safely',()=>{
  let data=fixture();data.FeedControl[0]['Feed Status']='UNAVAILABLE';assert.ok(reasons(data).includes('PROVIDER_UNAVAILABLE'));
  data=fixture();data.RunnerState[0]['Last Game State']='LIVE';data.FeedSnapshots[0]['Captured At CT']='2026-08-30T03:00:00Z';assert.ok(reasons(data).includes('STALE_FEED'));
  data=fixture();data.IngestionQA.push({'Game ID':gameId,'Exception Type':'GAME_IDENTITY_MISMATCH',Status:'OPEN'});assert.ok(reasons(data).includes('GAME_IDENTITY_MISMATCH'));
  data=fixture();data.IngestionQA.push({'Game ID':gameId,'Exception Type':'AMBIGUOUS_PLAYER',Status:'OPEN'});assert.ok(reasons(data).includes('ROSTER_IDENTITY_AMBIGUITY'));
  data=fixture();data.GameStats.push({...data.GameStats[0]});assert.ok(reasons(data).includes('DUPLICATE_GAME_STATS'));
  data=fixture();data.GameStats.pop();assert.ok(reasons(data).includes('MISSING_NORMALIZED_STATS'));
  data=fixture();data.GameStats[0]['Forced Fumble']='';assert.ok(reasons(data).includes('DEFENSIVE_FALLBACK_PENDING'));
  data=fixture();data.Reconciliation[0]['Stat Differences']=1;assert.ok(reasons(data).includes('RECONCILIATION_DISCREPANCY'));
  data=fixture();data.PublishControl[0].Status='HOLD';assert.ok(reasons(data).includes('PUBLICATION_HOLD'));
  data=fixture();data.Games[0]['Stats Final?']='NO';assert.ok(reasons(data).includes('OFFICIAL_FINAL_NOT_VERIFIED'));
});
