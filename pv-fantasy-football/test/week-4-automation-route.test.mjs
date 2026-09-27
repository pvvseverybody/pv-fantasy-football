import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Week 4 automation route is bearer protected and fixed to the authoritative ESPN event',async()=>{
  const source=await readFile(new URL('../app/api/automation/week-4/route.js',import.meta.url),'utf8');
  assert.match(source,/verifyWeek4GithubToken/);
  assert.match(source,/2026-W4/);
  assert.match(source,/401868954/);
  assert.match(source,/2755/);
  assert.match(source,/runEspnGameAutomation/);
});

test('Week 4 manual workflow retains protected OIDC execution after final import',async()=>{
  const source=await readFile(new URL('../../.github/workflows/week-4-automation.yml',import.meta.url),'utf8');
  assert.match(source,/workflow_dispatch:/);
  assert.match(source,/id-token: write/);
  assert.match(source,/audience=pv-fantasy-week-4/);
  assert.match(source,/Authorization: Bearer/);
  assert.match(source,/api\/automation\/week-4/);
  assert.doesNotMatch(source,/schedule:/);
});
