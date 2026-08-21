import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalOpponent,officialAsset} from '../lib/official-assets.mjs';

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
  for(const provision of ['PVFF-1.0','one account','Fantasy Team Name','newest accepted scoring version','Live scores are provisional','official event statistics','unauthorized access','Privacy and data use'])assert.match(rules,new RegExp(provision,'i'));
});

test('participant navigation exposes core mobile destinations without admin links',async()=>{
  const navigation=await source('app/components/SiteHeader.js');
  for(const route of ['/lineup','/results','/leaderboard','/players','/rules'])assert.match(navigation,new RegExp(route.replace('/','\\/')));
  assert.match(navigation,/aria-current/);
  assert.doesNotMatch(navigation,/\/admin/);
});

test('lineup selection uses player cards and exposes eight-player side progress',async()=>{
  const lineup=await source('app/lineup/page.js');
  for(const marker of ['playerChoiceList','playerAvatar','sideProgress','stickyLineupAction','8 SELECTED','latest accepted lineup before lock'])assert.match(lineup,new RegExp(marker));
  assert.doesNotMatch(lineup,/<select/);
});

test('official assets resolve by authoritative opponent without altering lineup architecture',()=>{
  assert.equal(canonicalOpponent('Stephen F Austin'),'Stephen F. Austin');
  assert.equal(canonicalOpponent('UAPB'),'Arkansas-Pine Bluff');
  assert.equal(officialAsset('opponent','Tarleton State').src,'/assets/official/opponents/tarleton-state.png');
  assert.equal(officialAsset('opponent','Tarleton State').approved,true);
  assert.equal(officialAsset('opponent','Unknown Opponent').src,'');
  assert.equal(officialAsset('pvamu').src,'/assets/official/prairie-view-am-logo.png');
  assert.equal(officialAsset('pvamu').approved,true);
  assert.equal(officialAsset('pv-fantasy').approved,true);
});
