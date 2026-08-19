import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('staging smoke certification refuses an unconfigured or production target',()=>{
  const run=spawnSync(process.execPath,['certification/run-staging-smoke.mjs'],{encoding:'utf8',env:{...process.env,PV_FANTASY_ENV:'production',PV_FANTASY_RELEASE_MODE:'PUBLIC',PV_FANTASY_STAGING_URL:'https://example.test'}});
  assert.notEqual(run.status,0);
  assert.match(`${run.stdout}${run.stderr}`,/Refusing smoke test/);
});
