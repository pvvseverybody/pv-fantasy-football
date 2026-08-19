import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {logServerFailure} from '../lib/safe-server-log.mjs';

test('safe server logging drops upstream messages, stacks, workbook IDs, and secrets',()=>{
  const original=console.error;let captured='';console.error=value=>{captured=String(value)};
  try{const error=new Error('spreadsheet 1productionWorkbookId secret@example.test token=abc');error.code='UNKNOWN';logServerFailure('fixture-operation',error)}finally{console.error=original}
  assert.equal(captured,'{"operation":"fixture-operation","code":"INTERNAL_FAILURE"}');
});

test('current lineup recovery is session-bound and omits participant/submission IDs',async()=>{
  const source=await readFile(new URL('../app/api/lineup/current/route.js',import.meta.url),'utf8');
  assert.match(source,/participantAuthService\(\)\.authenticate/);
  const responseSource=source.slice(source.indexOf("return NextResponse.json({state:open"));
  assert.doesNotMatch(responseSource,/participant_id:|submission_id:/i);
});
