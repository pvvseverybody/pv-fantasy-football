import assert from 'node:assert/strict';
import test from 'node:test';
import {runPreseasonCertification} from '../certification/run-preseason-certification.mjs';

test('certifies the isolated end-to-end preseason workflow', () => {
  const result = runPreseasonCertification();
  assert.equal(result.pass,true);
  assert.ok(result.playerResults.every(item => item.pass));
  assert.ok(result.weeklyResults.every(item => item.pass));
  assert.ok(result.leaderboardResults.every(item => item.pass));
  assert.ok(result.reconciliation.every(item => item.pass));
  assert.ok(result.invariantChecks.every(item => item.pass));
  assert.equal(result.missingProbe.publication,'HOLD');
  assert.equal(result.missingProbe.playerScoreRows,0);
  assert.equal(result.missingProbe.weeklyRows,0);
  assert.equal(result.missingProbe.leaderboardRows,0);
});
