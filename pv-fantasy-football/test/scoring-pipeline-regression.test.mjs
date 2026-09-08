import test from 'node:test';
import assert from 'node:assert/strict';
import {isAcceptedScoringPickRow} from '../lib/scoring-pick.mjs';

test('accepted scoring-version picks do not depend on the legacy Valid field',()=>{
  const row=[];
  row[1]='2026-W1';
  row[9]='NO';
  row[13]='YES';
  row[14]='ACCEPTED';

  assert.equal(isAcceptedScoringPickRow(row,'2026-W1'),true);
  assert.equal(isAcceptedScoringPickRow(row,'2026-W2'),false);

  row[14]='SUPERSEDED';
  assert.equal(isAcceptedScoringPickRow(row,'2026-W1'),false);
});
