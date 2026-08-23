import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSeasonLaunchPreflight} from '../lib/season-launch-preflight.mjs';

function baseTables(){
  return {
    Games:[{'Game ID':'2026-W0',Week:'W0',Opponent:'Tarleton State','Kickoff (CT)':'2026-08-29 8:00 PM','Pick Status':'OPEN'}],
    FeedControl:[{'Game ID':'2026-W0',Week:'W0',Opponent:'Tarleton State','Kickoff (CT)':'2026-08-29 8:00 PM','Provider Event ID':'TARLETON-2026-W0'}],
    RunnerState:[{'Game ID':'2026-W0'}],
    Reconciliation:[{'Game ID':'2026-W0'}],
    Participants:[{'Participant ID':'PART-001','Email':'fan@example.com','Display Name':'Panther Pride','Active?':'YES'}],
    Players:Array.from({length:8},(_,index)=>({'Player ID':`PV-${index+1}`,'Active?':'YES','Source Status':'FINAL_ROSTER'})),
  };
}

test('clean production identity state is READY',()=>{
  const result=evaluateSeasonLaunchPreflight(baseTables());
  assert.equal(result.status,'READY');
  assert.equal(result.summary.blockers,0);
  assert.equal(result.summary.holds,0);
});

test('cross-table opponent drift blocks launch',()=>{
  const tables=baseTables();
  tables.FeedControl[0].Opponent='Texas Southern';
  const result=evaluateSeasonLaunchPreflight(tables);
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.active_blockers.includes('GAME_IDENTITY_DRIFT'));
});

test('orphan control game ID blocks launch',()=>{
  const tables=baseTables();
  tables.RunnerState.push({'Game ID':'2026-W9'});
  const result=evaluateSeasonLaunchPreflight(tables);
  assert.ok(result.active_blockers.includes('ORPHAN_CONTROL_GAME_ID'));
});

test('multiple open lineup windows require an explicit launch decision',()=>{
  const tables=baseTables();
  tables.Games.push({'Game ID':'2026-W1',Week:'W1',Opponent:'Texas Southern','Kickoff (CT)':'2026-09-05 6:00 PM','Pick Status':'OPEN'});
  tables.FeedControl.push({'Game ID':'2026-W1','Provider Event ID':'TSU-2026-W1'});
  const result=evaluateSeasonLaunchPreflight(tables);
  assert.equal(result.status,'HOLD');
  assert.ok(result.diagnostics.some(item=>item.code==='MULTIPLE_ENTRY_WINDOWS_OPEN'));
});

test('active demo records and participant identity collisions block launch',()=>{
  const tables=baseTables();
  tables.Participants.push({'Participant ID':'DEMO-001','Email':'fan@example.com','Display Name':'panther pride','Active?':'YES'});
  const result=evaluateSeasonLaunchPreflight(tables);
  assert.ok(result.active_blockers.includes('DEMO_PARTICIPANT_ACTIVE'));
  assert.ok(result.active_blockers.includes('DUPLICATE_PARTICIPANT_EMAIL'));
  assert.ok(result.active_blockers.includes('DUPLICATE_TEAM_NAME'));
});

test('provisional roster holds launch certification without inventing a hard data failure',()=>{
  const tables=baseTables();
  tables.Players=tables.Players.map(row=>({...row,'Source Status':'PROVISIONAL_FALL_CAMP'}));
  const result=evaluateSeasonLaunchPreflight(tables);
  assert.equal(result.status,'HOLD');
  assert.ok(result.diagnostics.some(item=>item.code==='ROSTER_PROVISIONAL'));
});

test('empty backend state fails closed',()=>{
  const result=evaluateSeasonLaunchPreflight({});
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.active_blockers.includes('NO_ACTIVE_ELIGIBLE_PLAYERS'));
});

test('certification control rows are ignored as non-production game identities',()=>{
  const tables=baseTables();
  tables.FeedControl.push({'Game ID':'CERT-AUG27','Provider Event ID':'TBD'});
  tables.RunnerState.push({'Game ID':'CERT-AUG27'});
  tables.Reconciliation.push({'Game ID':'CERT-AUG27'});
  const result=evaluateSeasonLaunchPreflight(tables);
  assert.ok(!result.diagnostics.some(item=>item.code==='ORPHAN_CONTROL_GAME_ID'&&item.game_id==='CERT-AUG27'));
});

test('system reconciliation rows are ignored as non-production game identities',()=>{
  const tables=baseTables();
  tables.Reconciliation.push({'Game ID':'SYSTEM-RULE'});
  const result=evaluateSeasonLaunchPreflight(tables);
  assert.ok(!result.diagnostics.some(item=>item.code==='ORPHAN_CONTROL_GAME_ID'&&item.game_id==='SYSTEM-RULE'));
});

test('placeholder provider event IDs do not count as duplicate provider identities',()=>{
  const tables=baseTables();
  tables.Games.push({'Game ID':'2026-W1',Week:'W1',Opponent:'Texas Southern','Pick Status':'PENDING'});
  tables.Games.push({'Game ID':'2026-W2',Week:'W2',Opponent:'Baylor','Pick Status':'PENDING'});
  tables.FeedControl.push({'Game ID':'2026-W1','Provider Event ID':'TBD'});
  tables.FeedControl.push({'Game ID':'2026-W2','Provider Event ID':'TBD'});
  const result=evaluateSeasonLaunchPreflight(tables);
  assert.ok(!result.active_blockers.includes('DUPLICATE_PROVIDER_EVENT_ID'));
});

test('real duplicate provider event IDs still block launch',()=>{
  const tables=baseTables();
  tables.Games.push({'Game ID':'2026-W1',Week:'W1',Opponent:'Texas Southern','Pick Status':'PENDING'});
  tables.FeedControl.push({'Game ID':'2026-W1','Provider Event ID':'TARLETON-2026-W0'});
  const result=evaluateSeasonLaunchPreflight(tables);
  assert.ok(result.active_blockers.includes('DUPLICATE_PROVIDER_EVENT_ID'));
});
