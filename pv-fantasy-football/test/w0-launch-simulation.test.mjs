import test from 'node:test';
import assert from 'node:assert/strict';
import {runW0LaunchSimulation} from '../certification/run-w0-launch-simulation.mjs';

test('W0 launch simulation remains fail-closed through final publication',()=>{
  const result=runW0LaunchSimulation();
  assert.equal(result.pass,true);assert.equal(result.duplicate_retry,true);assert.equal(result.late_state,'REJECTED_LATE');
  assert.equal(result.provisional_publication,'HOLD');assert.equal(result.final_before_approval,'HOLD');assert.equal(result.publication,'PUBLISH');
  assert.equal(result.active_replacement,'SUB-1-V2');assert.ok(result.reconciliation.every(item=>item.pass));assert.equal(result.leaderboard.length,3);
});
