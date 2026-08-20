import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('accepted lineup confirmation includes the required audit details',async()=>{
  const lineup=await readFile(new URL('../app/lineup/page.js',import.meta.url),'utf8');
  assert.match(lineup,/The latest lineup accepted before lock is the only lineup that scores/);
  assert.match(lineup,/Submitted:/);
  assert.match(lineup,/confirmationLineup/);
  assert.match(lineup,/LINEUP_SLOTS\.map/);
});
test('accepted lineup confirmation scrolls to the top',async()=>{
  const lineup=await readFile(new URL('../app/lineup/page.js',import.meta.url),'utf8');
  assert.match(lineup,/if\(step===5\) window\.scrollTo\(\{top:0,behavior:'smooth'\}\)/);
});