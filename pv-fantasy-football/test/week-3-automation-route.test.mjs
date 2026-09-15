import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Week 3 automation route is bearer protected and fixed to the authoritative ESPN event',async()=>{
  const source=await readFile(new URL('../app/api/automation/week-3/route.js',import.meta.url),'utf8');
  assert.match(source,/verifyWeek3GithubToken/);
  assert.match(source,/2026-W3/);
  assert.match(source,/401868307/);
  assert.match(source,/2617/);
  assert.match(source,/runEspnGameAutomation/);
});

test('Week 3 scheduled workflow covers Saturday and the Sunday UTC post-kickoff window',async()=>{
  const source=await readFile(new URL('../../.github/workflows/week-3-automation.yml',import.meta.url),'utf8');
  assert.match(source,/cron: '\*\/5 \* \* \* 6'/);
  assert.match(source,/cron: '\*\/5 0-12 \* \* 0'/);
  assert.match(source,/id-token: write/);
  assert.match(source,/audience=pv-fantasy-week-3/);
  assert.match(source,/Authorization: Bearer/);
  assert.match(source,/api\/automation\/week-3/);
});
