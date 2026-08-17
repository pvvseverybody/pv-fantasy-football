import test from 'node:test';import assert from 'node:assert/strict';
import {monitorLiveTransport} from '../lib/live-transport-monitor.mjs';

const state=payload=>({state:payload.state,completed:payload.completed});
test('records failures, recovery, suppression, changes, reductions, final verification and shutdown',async()=>{
  const sequence=[new Error('temporary'),{state:'pre',completed:false,value:0},{state:'pre',completed:false,value:0},{state:'in',completed:false,value:7},{state:'in',completed:false,value:5},{state:'post',completed:true,value:5},{state:'post',completed:true,value:5}];let index=0;const raw=[];let tick=0;
  const result=await monitorLiveTransport({fetchSnapshot:async()=>{const item=sequence[index++];if(item instanceof Error)throw item;return item;},inspectState:state,intervalMs:15,maxSamples:6,finalVerificationSamples:2,retryDelaysMs:[1],sleep:async()=>{},now:()=>`T${++tick}`,onRawSnapshot:async item=>raw.push(item)});
  assert.equal(result.stopped,'FINAL_VERIFIED');assert.equal(result.rawSnapshotCount,4);assert.equal(raw.length,4);
  for(const type of ['REQUEST_FAILURE','RECOVERED','UNCHANGED_SUPPRESSED','CHANGED_SNAPSHOT','FINAL_VERIFICATION','POLLING_STOPPED'])assert.ok(result.evidence.some(item=>item.type===type),type);
  assert.ok(result.evidence.some(item=>item.reductions?.some(reduction=>reduction.path==='value'&&reduction.from===7&&reduction.to===5)));
});

test('does not stop on a single apparent final',async()=>{let index=0;const sequence=[{state:'in',completed:false},{state:'post',completed:true},{state:'in',completed:false},{state:'post',completed:true},{state:'post',completed:true}];const result=await monitorLiveTransport({fetchSnapshot:async()=>sequence[index++],inspectState:state,maxSamples:5,finalVerificationSamples:2,sleep:async()=>{}});assert.equal(result.stopped,'FINAL_VERIFIED');assert.equal(result.evidence.filter(item=>item.type==='FINAL_VERIFICATION').length,3);});
