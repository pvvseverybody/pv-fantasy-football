import {createCertificationStore,ingestNormalizedStats,scoreCertificationGame,submitCertificationLineup,certifyReconciliation} from '../lib/preseason-certification.mjs';
import {pathToFileURL} from 'node:url';

const zero={rushYards:0,rushTouchdowns:0,receptions:0,receivingYards:0,receivingTouchdowns:0,passingInterceptions:0,fumblesLost:0,tackles:0,tacklesForLoss:0,tackleForLossYards:0,sacks:0,sackYards:0,quarterbackHurries:0,passBreakups:0,defensiveInterceptions:0,interceptionReturnYards:0,forcedFumbles:0,fumbleRecoveries:0,defensiveReturnTouchdowns:0};
const players=Array.from({length:12},(_,index)=>`PV-${index+1}`);
const row=(playerId,index,final=false)=>({gameId:'2026-W0',week:'W0',playerId,playerName:`Player ${index+1}`,...zero,rushYards:index<6?(index+1)*10:0,receptions:index<6?index%4:0,receivingYards:index<6?index*7:0,tackles:index>=6?index-3:0,tacklesForLoss:index>=8?1:0,tackleForLossYards:index>=8?3:0,sacks:index>=9?1:0,sackYards:index>=9?5:0,forcedFumbles:final&&index===9?1:0,fumbleRecoveries:final&&index===10?1:0,defensiveReturnTouchdowns:final&&index===10?1:0,sourceUrl:'https://official.example.test/w0',importedAt:final?'2026-08-30T04:30:00Z':'2026-08-30T02:00:00Z'});

export function runW0LaunchSimulation(){
  const participants=[1,2,3].map(index=>({id:`PART-${index}`,displayName:`Beta ${index}`}));
  const kickoff='2026-08-30T01:00:00Z';const store=createCertificationStore({participants,games:[{id:'2026-W0',week:'W0',kickoff,status:'OPEN'}]});
  const base=players.slice(0,8);const submissions=[];
  participants.forEach((participant,index)=>{const selected=players.slice(index,index+8);const submission={id:`SUB-${index+1}-V1`,gameId:'2026-W0',participantId:participant.id,version:1,submittedAt:'2026-08-30T00:00:00Z',playerIds:selected};submissions.push(submission);submitCertificationLineup(store,submission)});
  const replacement={id:'SUB-1-V2',gameId:'2026-W0',participantId:'PART-1',version:2,submittedAt:'2026-08-30T00:59:59Z',playerIds:[...base.slice(0,7),players[8]]};
  submitCertificationLineup(store,replacement);const duplicate=submitCertificationLineup(store,replacement);
  store.games.get('2026-W0').status='LOCKED';const exactKickoff=submitCertificationLineup(store,{id:'SUB-LATE',gameId:'2026-W0',participantId:'PART-2',version:2,submittedAt:kickoff,playerIds:base});
  ingestNormalizedStats(store,players.map((id,index)=>row(id,index,false)));const provisional=scoreCertificationGame(store,'2026-W0',{publish:false});
  const provisionalTotals=[...store.weeklyScores.values()].map(item=>item.fantasyScore);
  ingestNormalizedStats(store,players.map((id,index)=>row(id,index,true)));const finalScoring=scoreCertificationGame(store,'2026-W0',{publish:false});
  const reconciliation=certifyReconciliation(store);const fallbackComplete=[...store.gameStats.values()].every(item=>['forcedFumbles','fumbleRecoveries','defensiveReturnTouchdowns'].every(field=>Number.isFinite(item[field])));
  if(fallbackComplete&&reconciliation.every(item=>item.pass))store.publishControl.set('2026-W0','PUBLISH');
  const active=store.activeLineups.get('2026-W0|PART-1');const oldPicks=[...store.picks.values()].filter(item=>item.submissionId==='SUB-1-V1');const newPicks=[...store.picks.values()].filter(item=>item.submissionId==='SUB-1-V2');
  return{pass:duplicate.duplicate&&exactKickoff.record.state==='REJECTED_LATE'&&provisional.publication==='HOLD'&&finalScoring.publication==='HOLD'&&store.publishControl.get('2026-W0')==='PUBLISH'&&active.submissionId==='SUB-1-V2'&&oldPicks.every(item=>!item.scoringVersion&&item.fantasyScore===0)&&newPicks.length===8&&newPicks.every(item=>item.scoringVersion)&&reconciliation.every(item=>item.pass),duplicate_retry:duplicate.duplicate,late_state:exactKickoff.record.state,provisional_publication:provisional.publication,final_before_approval:finalScoring.publication,publication:store.publishControl.get('2026-W0'),active_replacement:active.submissionId,provisional_totals:provisionalTotals,final_totals:[...store.weeklyScores.values()].map(item=>item.fantasyScore),leaderboard:store.leaderboard,reconciliation};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(runW0LaunchSimulation(),null,2));
