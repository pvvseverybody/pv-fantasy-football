import {createHash} from 'node:crypto';

function canonical(value){if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
export function transportHash(value){return createHash('sha256').update(canonical(value)).digest('hex');}

function numbers(value,path='',result=new Map()){if(Array.isArray(value))value.forEach((item,index)=>numbers(item,`${path}[${index}]`,result));else if(value&&typeof value==='object')Object.entries(value).forEach(([key,item])=>numbers(item,path?`${path}.${key}`:key,result));else if(typeof value==='number')result.set(path,value);return result;}
export function numericReductions(previous,current){const before=numbers(previous),after=numbers(current),reductions=[];for(const[path,value]of before){if(after.has(path)&&after.get(path)<value)reductions.push({path,from:value,to:after.get(path)});}return reductions;}

export async function monitorLiveTransport({fetchSnapshot,inspectState,intervalMs=15000,maxSamples=100,finalVerificationSamples=2,retryDelaysMs=[1000,2000,5000],maxConsecutiveFailedSamples=12,maxDurationMs=12*60*60*1000,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>new Date().toISOString(),nowMs=()=>Date.now(),onRawSnapshot=async()=>{},onEvidence=async()=>{},initialSnapshot=null}){
  const evidence=[];let previous=initialSnapshot;let previousHash=initialSnapshot?transportHash(initialSnapshot):null;let previousState=initialSnapshot?inspectState(initialSnapshot):null;let finalSeen=0;let consecutiveFailedSamples=0;let stopped='MAX_SAMPLES';const startedAt=nowMs();
  async function record(item){evidence.push(item);await onEvidence(item);}
  for(let sample=1;sample<=maxSamples;sample++){
    if(nowMs()-startedAt>=maxDurationMs){stopped='MAX_DURATION';await record({timestamp:now(),type:'POLLING_STOPPED',reason:stopped});break;}
    let payload;let recovered=false;
    for(let attempt=0;;attempt++){
      try{payload=await fetchSnapshot();if(attempt||consecutiveFailedSamples)await record({timestamp:now(),type:'RECOVERED',sample,attempt:attempt+1,failedSamples:consecutiveFailedSamples});recovered=attempt>0||consecutiveFailedSamples>0;consecutiveFailedSamples=0;break;}
      catch(error){await record({timestamp:now(),type:'REQUEST_FAILURE',sample,attempt:attempt+1,message:error.message});if(attempt>=retryDelaysMs.length){consecutiveFailedSamples++;await record({timestamp:now(),type:'SAMPLE_FAILED',sample,consecutiveFailedSamples});break;}await sleep(retryDelaysMs[attempt]);}
    }
    if(!payload){if(consecutiveFailedSamples>=maxConsecutiveFailedSamples){stopped='FAILURE_LIMIT';await record({timestamp:now(),type:'POLLING_STOPPED',reason:stopped});break;}if(sample<maxSamples)await sleep(intervalMs);continue;}
    const hash=transportHash(payload);const state=inspectState(payload);const changed=hash!==previousHash;const reductions=previous&&changed?numericReductions(previous,payload):[];
    await record({timestamp:now(),type:changed?'CHANGED_SNAPSHOT':'UNCHANGED_SUPPRESSED',sample,hash,state,recovered,reductions});
    if(changed)await onRawSnapshot({timestamp:now(),sample,hash,state,payload});
    if(previousState&&(state.state!==previousState.state||state.completed!==previousState.completed))await record({timestamp:now(),type:'STATE_TRANSITION',sample,from:previousState,to:state});
    for(const reduction of reductions)await record({timestamp:now(),type:'NUMERIC_REDUCTION',sample,...reduction});
    if(state.completed){finalSeen++;await record({timestamp:now(),type:'FINAL_VERIFICATION',sample,count:finalSeen,required:finalVerificationSamples});}else finalSeen=0;
    previous=payload;previousHash=hash;previousState=state;
    if(finalSeen>=finalVerificationSamples){stopped='FINAL_VERIFIED';await record({timestamp:now(),type:'POLLING_STOPPED',reason:stopped});break;}
    if(sample<maxSamples)await sleep(intervalMs);
  }
  if(stopped==='MAX_SAMPLES'&&!evidence.some(item=>item.type==='POLLING_STOPPED'))await record({timestamp:now(),type:'POLLING_STOPPED',reason:stopped});
  return {evidence,stopped,rawSnapshotCount:evidence.filter(item=>item.type==='CHANGED_SNAPSHOT').length};
}

export function inspectEspnNflState(payload){const competition=payload?.header?.competitions?.[0];const type=competition?.status?.type;if(!competition||!type)throw new Error('NFL summary is missing game status.');return{eventId:String(payload.header.id),state:type.state,completed:Boolean(type.completed),detail:type.detail||null,period:Number(competition.status.period||0),clock:competition.status.displayClock||null};}
