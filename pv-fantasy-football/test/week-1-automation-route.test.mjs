import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Week 1 automation route is bearer protected and fixed to the authoritative ESPN event',async()=>{
  const source=await readFile(new URL('../app/api/automation/week-1/route.js',import.meta.url),'utf8');
  assert.match(source,/verifyWeek1GithubToken/);
  assert.match(source,/2026-W1/);
  assert.match(source,/401868967/);
  assert.match(source,/official_publication:false|runEspnGameAutomation/);
});

test('Week 1 scheduled workflow uses the protected production endpoint',async()=>{
  const source=await readFile(new URL('../.github/workflows/week-1-automation.yml',import.meta.url),'utf8');
  assert.match(source,/id-token: write/);
  assert.match(source,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(source,/Authorization: Bearer/);
  assert.match(source,/api\/automation\/week-1/);
});
