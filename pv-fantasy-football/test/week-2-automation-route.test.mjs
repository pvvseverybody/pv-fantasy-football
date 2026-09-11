import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Week 2 automation route is bearer protected and fixed to the authoritative ESPN event',async()=>{
  const source=await readFile(new URL('../app/api/automation/week-2/route.js',import.meta.url),'utf8');
  assert.match(source,/verifyWeek2GithubToken/);
  assert.match(source,/2026-W2/);
  assert.match(source,/401856784/);
  assert.match(source,/official_publication:false|runEspnGameAutomation/);
});

test('Week 2 scheduled workflow uses the protected production endpoint on Saturdays',async()=>{
  const source=await readFile(new URL('../../.github/workflows/week-2-automation.yml',import.meta.url),'utf8');
  assert.match(source,/cron: '\*\/5 \* \* \* 6'/);
  assert.match(source,/id-token: write/);
  assert.match(source,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(source,/Authorization: Bearer/);
  assert.match(source,/api\/automation\/week-2/);
});
