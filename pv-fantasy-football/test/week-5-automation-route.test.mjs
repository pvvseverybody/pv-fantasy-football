import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Week 5 route uses the guarded final ESPN reconciliation',async()=>{
  const source=await readFile(new URL('../app/api/automation/week-5/route.js',import.meta.url),'utf8');
  assert.match(source,/verifyWeek5GithubToken/);
  assert.match(source,/2026-W5/);
  assert.match(source,/401868965/);
  assert.match(source,/opponentTeamId:'2400'/);
  assert.match(source,/allowFinalReconciliation:true/);
});

test('Week 5 workflow requests the matching OIDC audience',async()=>{
  const source=await readFile(new URL('../../.github/workflows/week-5-automation.yml',import.meta.url),'utf8');
  assert.match(source,/workflow_dispatch/);
  assert.match(source,/audience=pv-fantasy-week-5/);
  assert.match(source,/api\/automation\/week-5/);
});
