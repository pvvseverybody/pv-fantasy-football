import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReleaseMode} from '../lib/beta-mode.mjs';
import {BETA_ACCEPTANCE_CATEGORIES,evaluateBetaAcceptance} from '../lib/beta-acceptance.mjs';

test('release mode defaults closed and accepts only explicit server values',()=>{
  assert.deepEqual(evaluateReleaseMode({}),{mode:'DEVELOPMENT',configured:false,public_authorized:false});
  assert.equal(evaluateReleaseMode({PV_FANTASY_RELEASE_MODE:'invalid'}).mode,'DEVELOPMENT');
  assert.equal(evaluateReleaseMode({PV_FANTASY_RELEASE_MODE:'BETA'}).mode,'BETA');
  assert.equal(evaluateReleaseMode({PV_FANTASY_RELEASE_MODE:'PUBLIC'}).public_authorized,true);
});

test('beta ledger requires every acceptance category and fails closed',()=>{
  assert.equal(evaluateBetaAcceptance([]).status,'PENDING');
  const pass=BETA_ACCEPTANCE_CATEGORIES.map(category=>({category,status:'PASS',checked_at:'2026-08-19T12:00:00Z',evidence:`fixture:${category}`}));
  assert.equal(evaluateBetaAcceptance(pass).status,'PASS');
  pass[1].evidence='person@example.test';assert.equal(evaluateBetaAcceptance(pass).categories[1].evidence,null);
  pass[0].status='FAIL';assert.equal(evaluateBetaAcceptance(pass).status,'FAIL');
});
