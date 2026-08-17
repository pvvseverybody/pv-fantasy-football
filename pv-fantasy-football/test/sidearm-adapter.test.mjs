import test from 'node:test';
import assert from 'node:assert/strict';
import {applyOfficialDefensiveStatbookFallback,normalizeSidearmTeam, resolveSidearmIdentity, validateSidearmGameIdentity} from '../lib/sidearm-adapter.mjs';
import {canonicalPlayers,historicalStructure} from './fixtures/sidearm-historical-structure.mjs';

test('normalizes verified SIDEARM fields without counting return touchdowns as fantasy TDs',()=>{
  const result=normalizeSidearmTeam(historicalStructure.Stats.HomeTeam,canonicalPlayers);
  const runner=result.rows.find(row=>row.playerId==='PV-RB');
  const defender=result.rows.find(row=>row.playerId==='PV-DB');
  assert.deepEqual({rush:runner.rushYards,rushTd:runner.rushTouchdowns,rec:runner.receptions,recYds:runner.receivingYards,recTd:runner.receivingTouchdowns,passInt:result.rows.find(row=>row.playerId==='PV-QB').passingInterceptions,fumLost:runner.fumblesLost}, {rush:71,rushTd:2,rec:3,recYds:25,recTd:1,passInt:1,fumLost:1});
  assert.deepEqual({tackles:defender.tackles,tfl:defender.tacklesForLoss,tflYds:defender.tackleForLossYards,sacks:defender.sacks,sackYds:defender.sackYards,qbh:defender.quarterbackHurries,pbu:defender.passBreakups,int:defender.defensiveInterceptions,intYds:defender.interceptionReturnYards,defTd:defender.defensiveReturnTouchdowns}, {tackles:6,tfl:1.5,tflYds:8,sacks:1,sackYds:5,qbh:2,pbu:3,int:1,intYds:33,defTd:1});
  assert.equal(runner.audit.kickReturnTouchdowns,1);
  assert.equal(defender.audit.puntReturnTouchdowns,1);
  assert.equal(defender.defensiveReturnTouchdowns,1);
  assert.equal(result.issues.filter(issue=>issue.code==='UNSUPPORTED_SIDEARM_FIELD').length,2);
});

test('duplicate jersey numbers resolve by team, jersey and compatible name',()=>{
  const result=resolveSidearmIdentity({Uni:'4',Name:'T. RETURN',PersonId:''},historicalStructure.Stats.HomeTeam,canonicalPlayers);
  assert.equal(result.status,'MATCHED');
  assert.equal(result.playerId,'PV-DB');
});

test('provider stat names with suffixes resolve to the roster identity',()=>{
  const team={Players:[{FirstName:'Mandel',LastName:'Eugene Jr.',UniformNumber:'42',PersonId:''}]};
  const canonical=[{playerId:'PV-42',name:'Mandel Eugene Jr.',team:'PVAMU',jersey:'42'}];
  const result=resolveSidearmIdentity({Uni:'42',Name:'M. EUGENE JR.',PersonId:''},team,canonical);
  assert.equal(result.status,'MATCHED');
  assert.equal(result.playerId,'PV-42');
});

test('identity ambiguity fails closed',()=>{
  const team={Players:[{FirstName:'Taylor',LastName:'Return',UniformNumber:'4',PersonId:''},{FirstName:'Tara',LastName:'Return',UniformNumber:'4',PersonId:''}]};
  assert.equal(resolveSidearmIdentity({Uni:'4',Name:'T. RETURN'},team,canonicalPlayers).status,'AMBIGUOUS_PROVIDER_PLAYER');
});

test('blank jersey never enables a name-only fallback',()=>{
  const team={Players:[{FirstName:'Same',LastName:'Name',UniformNumber:'',PersonId:''}]};
  const canonical=[{playerId:'ONE',name:'Same Name',jersey:''}];
  assert.equal(resolveSidearmIdentity({Uni:'',Name:'S. NAME',PersonId:''},team,canonical).status,'UNMATCHED_PROVIDER_PLAYER');
});

test('stable provider person ID outranks jersey and name fallback',()=>{
  const team={Players:[{FirstName:'Formal',LastName:'Name',UniformNumber:'7',PersonId:'stable-1'}]};
  const canonical=[{playerId:'ONE',name:'Different Display',jersey:'99',providerPersonId:'stable-1'}];
  const result=resolveSidearmIdentity({Uni:'7',Name:'F. NAME',PersonId:'stable-1'},team,canonical);
  assert.equal(result.status,'MATCHED');assert.equal(result.playerId,'ONE');assert.equal(result.method,'PERSON_ID+PERSON_ID');
});

test('provider date discrepancy is explicit and blocks identity validation',()=>{
  const result=validateSidearmGameIdentity({Game:{Date:'8/3/2026',NcaaGameId:'40550',HomeTeam:{Name:'Delaware State'},VisitingTeam:{Name:'Stony Brook'}}},{date:'8/27/2026',ncaaGameId:'40550',homeTeam:'Delaware State',visitingTeam:'Stony Brook'});
  assert.equal(result.valid,false);
  assert.deepEqual(result.findings,['PROVIDER_DATE_MISMATCH']);
});

test('applies only authoritative final-stat-book fumble touchdown attribution',()=>{
  const source='https://ua_ftp.sidearmsports.com/custompages/sports/m-footbl/stats/2014-2015/04ua-uf.html';
  const result=applyOfficialDefensiveStatbookFallback([{playerId:'UF-42',forcedFumbles:null,fumbleRecoveries:null,defensiveReturnTouchdowns:0,audit:{}}],[{playerId:'UF-42',forcedFumbles:1,fumbleRecoveries:1,defensiveReturnTouchdowns:1,officialFinal:true,sourceArtifact:source}]);
  assert.equal(result.issues.length,0);assert.deepEqual([result.rows[0].forcedFumbles,result.rows[0].fumbleRecoveries,result.rows[0].defensiveReturnTouchdowns],[1,1,1]);assert.equal(result.rows[0].audit.officialDefensiveFallback,source);
});

test('rejects unverified defensive fallback attribution',()=>{const result=applyOfficialDefensiveStatbookFallback([{playerId:'X',audit:{}}],[{playerId:'X',forcedFumbles:1,fumbleRecoveries:1,defensiveReturnTouchdowns:1,officialFinal:false,sourceArtifact:'play by play'}]);assert.equal(result.issues[0].code,'UNVERIFIED_DEFENSIVE_FALLBACK');});
