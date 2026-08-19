import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDeploymentSafety} from '../lib/deployment-safety.mjs';
import {generateStagingFixtures} from '../certification/generate-staging-fixtures.mjs';
import {evaluatePublicOpeningGate,PUBLIC_GATE_DIMENSIONS} from '../lib/public-opening-gate.mjs';
import {deploymentVersion} from '../lib/deployment-version.mjs';

test('deployment classification defaults closed and rejects dangerous combinations',()=>{assert.equal(evaluateDeploymentSafety({}).environment,'development');assert.equal(evaluateDeploymentSafety({PV_FANTASY_ENV:'staging',PV_FANTASY_RELEASE_MODE:'PUBLIC'}).status,'BLOCKED');assert.equal(evaluateDeploymentSafety({PV_FANTASY_ENV:'production',NODE_ENV:'development'}).status,'BLOCKED')});
test('staging must pin a distinct isolated workbook',()=>{const safe={PV_FANTASY_ENV:'staging',PV_FANTASY_RELEASE_MODE:'BETA',BACKEND_SPREADSHEET_ID:'stage-id',PV_FANTASY_STAGING_SPREADSHEET_ID:'stage-id',PV_FANTASY_PRODUCTION_SPREADSHEET_ID:'prod-id'};assert.equal(evaluateDeploymentSafety(safe).status,'SAFE');assert.equal(generateStagingFixtures(safe).write_enabled,false);assert.throws(()=>generateStagingFixtures({PV_FANTASY_ENV:'production'}),error=>error.code==='STAGING_ONLY');assert.equal(evaluateDeploymentSafety({...safe,BACKEND_SPREADSHEET_ID:'prod-id'}).status,'BLOCKED')});
test('public opening gate never authorizes until every dimension passes',()=>{assert.equal(evaluatePublicOpeningGate({}).status,'READY_FOR_STAGING');const pass=Object.fromEntries(PUBLIC_GATE_DIMENSIONS.map(name=>[name,true]));assert.equal(evaluatePublicOpeningGate(pass).status,'READY_FOR_PUBLIC_AUTHORIZATION');pass.WORKBOOK='BLOCKED';assert.equal(evaluatePublicOpeningGate(pass).status,'BLOCKED')});
test('deployment version sanitizes provider metadata',()=>{assert.deepEqual(deploymentVersion({VERCEL_GIT_COMMIT_SHA:'abc123',VERCEL_DEPLOYMENT_ID:'deploy-1'}),{application_version:'1.0.1',commit:'abc123',deployment_id:'deploy-1'});assert.equal(deploymentVersion({VERCEL_GIT_COMMIT_SHA:'bad<script>'}).commit,'badscript')});
