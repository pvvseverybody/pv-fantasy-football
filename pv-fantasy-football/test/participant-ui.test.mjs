import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url),'utf8');

test('participant lineup UI preserves the certified eight-slot structure',async()=>{
  const lineup=await source('app/lineup/page.js');
  for(const slot of ['RB','WR','TE','Offensive Flex','DL','LB','DB','Defensive Flex'])assert.match(lineup,new RegExp(`['"]${slot}['"]`));
  assert.doesNotMatch(lineup,/\['QB'|team defense/i);
  assert.match(lineup,/max="8" value=\{completed\}/);
});

test('rules screen presents certified scoring exclusions and penalties',async()=>{
  const rules=await source('app/rules/page.js');
  assert.match(rules,/Fumble lost','−2 pts/);
  assert.match(rules,/Interception thrown','−2 pts/);
  assert.match(rules,/Kick-return and punt-return touchdowns do not earn fantasy touchdown points/);
  assert.match(rules,/exactly eight accepted scoring-version picks/);
});

test('participant navigation exposes core mobile destinations without admin links',async()=>{
  const navigation=await source('app/components/SiteHeader.js');
  for(const route of ['/lineup','/results','/leaderboard','/rules'])assert.match(navigation,new RegExp(route.replace('/','\\/')));
  assert.doesNotMatch(navigation,/\/admin/);
});
