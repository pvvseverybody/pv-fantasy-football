import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateProductionConfig} from '../lib/production-config.mjs';
import {WORKBOOK_SCHEMAS,validateSheetHeaders,validateWorkbookSchemas} from '../lib/workbook-schema.mjs';
import {evaluateSystemReadiness} from '../lib/system-readiness.mjs';

const validEnvironment=()=>({
  BACKEND_SPREADSHEET_ID:'1abcdefghijklmnopqrstuvwxyz123456789',
  GOOGLE_SERVICE_ACCOUNT_EMAIL:'pv-fantasy@example-project.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY:['-----BEGIN ','PRIVATE KEY-----\nfixture-only\n-----END ','PRIVATE KEY-----'].join(''),
  SCORING_PIPELINE_SECRET:'fixture-scoring-secret-that-is-long-enough',
  PV_ADMIN_USERNAME:'operations',PV_ADMIN_PASSWORD:'fixture-admin-password-long',
  PARTICIPANT_AUTH_SECRET:'fixture-participant-secret-that-is-long-enough',
  RESEND_API_KEY:'re_fixture_key',PARTICIPANT_AUTH_FROM:'PV Fantasy <login@example.test>',
});

test('production configuration reports only status metadata',()=>{
  const result=evaluateProductionConfig(validEnvironment());
  assert.equal(result.status,'CONFIGURED');
  assert.ok(result.items.every(entry=>Object.keys(entry).sort().join(',')==='classification,name,status'));
  assert.doesNotMatch(JSON.stringify(result),/fixture-scoring-secret|PRIVATE KEY|re_fixture_key/);
});

test('missing and malformed configuration fail closed without value details',()=>{
  const environment=validEnvironment();delete environment.RESEND_API_KEY;environment.GOOGLE_SERVICE_ACCOUNT_EMAIL='not-an-email';
  const result=evaluateProductionConfig(environment);
  assert.equal(result.status,'CONFIGURATION_REQUIRED');
  assert.equal(result.items.find(item=>item.name==='RESEND_API_KEY').status,'MISSING');
  assert.equal(result.items.find(item=>item.name==='GOOGLE_SERVICE_ACCOUNT_EMAIL').status,'INVALID_CONFIGURATION');
});

test('compatible schemas allow harmless trailing columns',()=>{
  const actual=[...WORKBOOK_SCHEMAS.GameStats,'Operator Note'];
  assert.equal(validateSheetHeaders('GameStats',actual).status,'COMPATIBLE');
});

test('missing, moved, and duplicate write headers fail closed',()=>{
  const missing=WORKBOOK_SCHEMAS.Picks.filter(header=>header!=='Player ID');
  assert.equal(validateSheetHeaders('Picks',missing).status,'INCOMPATIBLE');
  const moved=[...WORKBOOK_SCHEMAS.Picks];[moved[0],moved[1]]=[moved[1],moved[0]];
  assert.ok(validateSheetHeaders('Picks',moved).issues.some(issue=>issue.code==='INCOMPATIBLE_HEADER_ORDER'));
  assert.ok(validateSheetHeaders('Picks',[...WORKBOOK_SCHEMAS.Picks,'Player ID']).issues.some(issue=>issue.code==='DUPLICATE_HEADERS'));
});

test('workbook validation reports any incompatible critical tab',()=>{
  const fixture=Object.fromEntries(Object.entries(WORKBOOK_SCHEMAS).map(([sheet,headers])=>[sheet,[...headers]]));
  fixture.ParticipantSession=[];
  assert.equal(validateWorkbookSchemas(fixture).status,'INCOMPATIBLE');
});

const readyInput=()=>({configuration:evaluateProductionConfig(validEnvironment()),connectivity:{status:'CONNECTED',schema:{status:'COMPATIBLE'}},preflight:{status:'READY'},gameReadiness:{readiness:'HOLD',publication:{status:'HOLD'}},releaseMode:{mode:'BETA'},betaAcceptance:{status:'PASS'}});

test('system readiness requires human beta acceptance before public entry',()=>{
  const result=evaluateSystemReadiness(readyInput());
  assert.equal(result.status,'READY FOR BETA');
  assert.equal(result.safe_to_open_to_participants,false);
  assert.equal(evaluateSystemReadiness({...readyInput(),releaseMode:{mode:'PUBLIC'}}).status,'READY FOR PUBLIC ENTRY');
});

test('system readiness distinguishes configuration, schema, and preseason holds',()=>{
  assert.equal(evaluateSystemReadiness({...readyInput(),configuration:evaluateProductionConfig({})}).status,'CONFIGURATION REQUIRED');
  assert.equal(evaluateSystemReadiness({...readyInput(),connectivity:{status:'CONNECTED_WITH_SCHEMA_ERRORS',schema:{status:'INCOMPATIBLE'}}}).status,'BLOCKED');
  assert.equal(evaluateSystemReadiness({...readyInput(),preflight:{status:'HOLD'}}).status,'PRESEASON HOLD');
  assert.equal(evaluateSystemReadiness({...readyInput(),releaseMode:{mode:'PUBLIC'},deploymentSafety:{status:'BLOCKED'}}).status,'BLOCKED');
});
