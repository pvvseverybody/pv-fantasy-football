import test from 'node:test';import assert from 'node:assert/strict';
import {monitorLiveTransport} from '../lib/live-transport-monitor.mjs';
import {waitForStart} from '../certification/run-nfl-live-window.mjs';

const state=payload=>({state:payload.state,completed:payload.completed});
test('records failures, recovery, suppression, changes, reductions, final verification and shutdown',async()=>{
  const sequence=[new Error('temporary'),{state:'pre',completed:false,value:0},{state:'pre',completed:false,value:0},{state:'in',completed:false,value:7},{state:'in',completed:false,value:5},{state:'post',completed:true,value:5},{state:'post',completed:true,value:5}];let index=0;const raw=[];let tick=0;
  const result=await monitorLiveTransport({fetchSnapshot:async()=>{const item=sequence[index++];if(item instanceof Error)throw item;return item;},inspectState:state,intervalMs:15,maxSamples:6,finalVerificationSamples:2,retryDelaysMs:[1],sleep:async()=>{},now:()=>`T${++tick}`,onRawSnapshot:async item=>raw.push(item)});
  assert.equal(result.stopped,'FINAL_VERIFIED');assert.equal(result.rawSnapshotCount,4);assert.equal(raw.length,4);
  for(const type of ['REQUEST_FAILURE','RECOVERED','UNCHANGED_SUPPRESSED','CHANGED_SNAPSHOT','FINAL_VERIFICATION','POLLING_STOPPED'])assert.ok(result.evidence.some(item=>item.type===type),type);
  assert.ok(result.evidence.some(item=>item.type==='STATE_TRANSITION'&&item.from.state==='pre'&&item.to.state==='in'));
  assert.ok(result.evidence.some(item=>item.type==='NUMERIC_REDUCTION'&&item.path==='value'&&item.from===7&&item.to===5));
  assert.ok(result.evidence.some(item=>item.reductions?.some(reduction=>reduction.path==='value'&&reduction.from===7&&reduction.to===5)));
});

test('does not stop on a single apparent final',async()=>{let index=0;const sequence=[{state:'in',completed:false},{state:'post',completed:true},{state:'in',completed:false},{state:'post',completed:true},{state:'post',completed:true}];const result=await monitorLiveTransport({fetchSnapshot:async()=>sequence[index++],inspectState:state,maxSamples:5,finalVerificationSamples:2,sleep:async()=>{}});assert.equal(result.stopped,'FINAL_VERIFIED');assert.equal(result.evidence.filter(item=>item.type==='FINAL_VERIFICATION').length,3);});

test('survives exhausted retry cycles and records outage recovery',async()=>{let call=0;const sequence=[new Error('down'),new Error('down'),{state:'in',completed:false},{state:'post',completed:true},{state:'post',completed:true}];const result=await monitorLiveTransport({fetchSnapshot:async()=>{const item=sequence[call++];if(item instanceof Error)throw item;return item;},inspectState:state,retryDelaysMs:[],maxSamples:5,finalVerificationSamples:2,sleep:async()=>{}});assert.equal(result.stopped,'FINAL_VERIFIED');assert.ok(result.evidence.some(item=>item.type==='SAMPLE_FAILED'));assert.ok(result.evidence.some(item=>item.type==='RECOVERED'&&item.failedSamples===2));});

test('stops at the failed-sample safeguard',async()=>{const result=await monitorLiveTransport({fetchSnapshot:async()=>{throw new Error('persistent');},inspectState:state,retryDelaysMs:[],maxSamples:99,maxConsecutiveFailedSamples:3,sleep:async()=>{}});assert.equal(result.stopped,'FAILURE_LIMIT');assert.equal(result.evidence.filter(item=>item.type==='SAMPLE_FAILED').length,3);});

test('unattended runner waits in bounded increments until its pre-kickoff start',async()=>{let clock=0;const waits=[];await waitForStart(125000,{nowMs:()=>clock,wait:async ms=>{waits.push(ms);clock+=ms;}});assert.deepEqual(waits,[60000,60000,5000]);});
