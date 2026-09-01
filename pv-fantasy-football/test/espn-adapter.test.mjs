import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEspnGame,normalizeEspnPvStats} from '../lib/espn-adapter.mjs';

const players=[
  {'Player ID':'P100','Player Name':'Kaeden Smith',Position:'QB',Active:'YES',Jersey:'16'},
  {'Player ID':'P055','Player Name':'Jacob Davis',Position:'DB',Active:'YES',Jersey:'16'},
  {'Player ID':'P043','Player Name':'Zayvion Turner-Knox',Position:'RB',Active:'YES',Jersey:'13'},
  {'Player ID':'P048','Player Name':'Mohammed Bility',Position:'DB',Active:'YES',Jersey:'13'},
  {'Player ID':'P040','Player Name':'Tony Terry',Position:'TE',Active:'YES',Jersey:'49'},
];
const category=(name,keys,athletes)=>({name,keys,athletes:athletes.map(([displayName,jersey,stats])=>({athlete:{displayName,jersey},stats}))});
const payload={header:{id:'401868967',competitions:[{date:'2026-09-06T16:00Z',status:{type:{state:'in',completed:false}},competitors:[{team:{id:'2504'}},{team:{id:'2640'}}]}]},boxscore:{players:[{team:{id:'2504'},statistics:[
  category('rushing',['rushingYards','rushingTouchdowns'],[['Jacob Davis','16',['22','1']]]),
  category('defensive',['totalTackles','sacks','tacklesForLoss','passesDefended','hurries','defensiveTouchdowns'],[['Zayvion Turner-Knox','13',['4','1','1','0','2','0']],['Tony Terry','49',['2','0','0','0','0','0']]]),
]}]}};

test('validates the configured ESPN game identity',()=>{
  const result=inspectEspnGame(payload,{eventId:'401868967'});assert.equal(result.valid,true);assert.equal(result.state,'in');
});

test('uses position-compatible jersey fallback for known ESPN misattribution patterns',()=>{
  const result=normalizeEspnPvStats(payload,{players,gameId:'2026-W1',week:'W1',sourceUrl:'espn',importedAt:'now'});
  assert.equal(result.valid,true);
  const byId=new Map(result.rows.map(row=>[row[2],row]));
  assert.equal(byId.get('P100')[4],22);assert.equal(byId.get('P100')[5],1);assert.equal(byId.get('P055')[4],0);
  assert.equal(byId.get('P048')[11],4);assert.equal(byId.get('P048')[14],1);assert.equal(byId.get('P043')[11],0);
  assert.equal(byId.get('P040')[11],2);
  assert.ok(result.rows.every(row=>row[25]==='NO'));
});

test('ignores athletes outside the approved fantasy pool without inventing an identity',()=>{
  const changed=structuredClone(payload);changed.boxscore.players[0].statistics[0].athletes[0].athlete={displayName:'Unknown Runner',jersey:'99'};
  const result=normalizeEspnPvStats(changed,{players,gameId:'2026-W1',week:'W1',sourceUrl:'espn'});
  assert.equal(result.valid,true);assert.equal(result.findings[0].code,'NON_POOL_PLAYER_IGNORED');
  assert.ok(result.rows.every(row=>row[2]!=='99'));
});
