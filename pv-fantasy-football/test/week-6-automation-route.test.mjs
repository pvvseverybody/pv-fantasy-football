import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Week 6 route uses the guarded final ESPN reconciliation',async()=>{
  const source=await readFile(new URL('../app/api/automation/week-6/route.js',import.meta.url),'utf8');
  assert.match(source,/verifyWeek6GithubToken/);
  assert.match(source,/2026-W6/);
  assert.match(source,/401868968/);
  assert.match(source,/opponentTeamId:'2582'/);
  assert.match(source,/allowFinalReconciliation:true/);
  assert.match(source,/publishGame\('2026-W6'\)/);
});

test('Week 6 workflow requests the matching OIDC audience',async()=>{
  const source=await readFile(new URL('../../.github/workflows/week-6-automation.yml',import.meta.url),'utf8');
  assert.match(source,/workflow_dispatch/);
  assert.match(source,/week-6-run-now\.trigger/);
  assert.match(source,/audience=pv-fantasy-week-6/);
  assert.match(source,/api\/automation\/week-6/);
});
