import {createHash} from 'node:crypto';

function canonical(value){if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
export function transportHash(value){return createHash('sha256').update(canonical(value)).digest('hex');}

function numbers(value,path='',result=new Map()){if(Array.isArray(value))value.forEach((item,index)=>numbers(item,`${path}[${index}]`,result));else if(value&&typeof value==='object')Object.entries(value).forEach(([key,item])=>numbers(item,path?`${path}.${key}`:key,result));else if(typeof value==='number')result.set(path,value);return result;}
export function numericReductions(previous,current){const before=numbers(previous),after=numbers(current),reductions=[];for(const[path,value]of before){if(after.has(path)&&after.get(path)<value)reductions.push({path,from:value,to:after.get(path)});}return reductions;}

export async function monitorLiveTransport({fetchSnapshot,inspectState,intervalMs=15000,maxSamples=100,finalVerificationSamples=2,retryDelaysMs=[1000,2000,5000],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>new Date().toISOString(),onRawSnapshot=async()=>{}}){
  const evidence=[];let previous=null;let previousHash=null;let finalSeen=0;let stopped='MAX_SAMPLES';
  for(let sample=1;sample<=maxSamples;sample++){
    let payload;let recovered=false;
    for(let attempt=0;;attempt++){
      try{payload=await fetchSnapshot();if(attempt)evidence.push({timestamp:now(),type:'RECOVERED',sample,attempt:attempt+1});recovered=attempt>0;break;}
      catch(error){evidence.push({timestamp:now(),type:'REQUEST_FAILURE',sample,attempt:attempt+1,message:error.message});if(attempt>=retryDelaysMs.length)throw error;await sleep(retryDelaysMs[attempt]);}
    }
    const hash=transportHash(payload);const state=inspectState(payload);const changed=hash!==previousHash;const reductions=previous&&changed?numericReductions(previous,payload):[];
    evidence.push({timestamp:now(),type:changed?'CHANGED_SNAPSHOT':'UNCHANGED_SUPPRESSED',sample,hash,state,recovered,reductions});
    if(changed)await onRawSnapshot({timestamp:now(),sample,hash,state,payload});
    if(state.completed){finalSeen++;evidence.push({timestamp:now(),type:'FINAL_VERIFICATION',sample,count:finalSeen,required:finalVerificationSamples});}else finalSeen=0;
    previous=payload;previousHash=hash;
    if(finalSeen>=finalVerificationSamples){stopped='FINAL_VERIFIED';evidence.push({timestamp:now(),type:'POLLING_STOPPED',reason:stopped});break;}
    if(sample<maxSamples)await sleep(intervalMs);
  }
  return {evidence,stopped,rawSnapshotCount:evidence.filter(item=>item.type==='CHANGED_SNAPSHOT').length};
}

export function inspectEspnNflState(payload){const competition=payload?.header?.competitions?.[0];const type=competition?.status?.type;if(!competition||!type)throw new Error('NFL summary is missing game status.');return{eventId:String(payload.header.id),state:type.state,completed:Boolean(type.completed),detail:type.detail||null,period:Number(competition.status.period||0),clock:competition.status.displayClock||null};}
