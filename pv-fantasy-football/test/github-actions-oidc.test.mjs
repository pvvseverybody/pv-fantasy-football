import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyWeek1GithubToken} from '../lib/github-actions-oidc.mjs';

const token=(header,claims)=>`${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.invalid`;

test('GitHub OIDC verifier rejects malformed and wrong-workflow tokens before network access',async()=>{
  let fetched=false;const fetchImpl=async()=>{fetched=true;throw new Error('unexpected');};
  assert.equal(await verifyWeek1GithubToken('bad',{fetchImpl}),false);
  const value=token({alg:'RS256',kid:'k'},{iss:'https://token.actions.githubusercontent.com',aud:'pv-fantasy-week-1',repository:'other/repo',workflow_ref:'wrong',ref:'refs/heads/main',event_name:'schedule',iat:100,exp:1000});
  assert.equal(await verifyWeek1GithubToken(value,{fetchImpl,now:500}),false);assert.equal(fetched,false);
});
