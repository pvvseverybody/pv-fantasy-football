import test from 'node:test';
import assert from 'node:assert/strict';
import {LINEUP_SLOTS,centralKickoffEpoch,participantResults,participantStatusLabel,playerLabel,publicLeaderboard,publicPlayerDirectory,submissionOutcome,validateLineupDraft} from '../lib/participant-experience.mjs';

test('draft requires eight unique player selections',()=>{
  assert.equal(validateLineupDraft({}).code,'INCOMPLETE_LINEUP');
  const picks=Object.fromEntries(LINEUP_SLOTS.map((slot,index)=>[slot,`P${index}`]));
  assert.equal(validateLineupDraft(picks).valid,true);
  picks['Defensive Flex']=picks.RB;
  assert.equal(validateLineupDraft(picks).code,'DUPLICATE_PLAYER');
});

test('player labels omit unpublished jersey numbers',()=>{
  assert.equal(playerLabel({display_name:'PV Player',position:'LB',jersey:''}),'PV Player • LB');
  assert.equal(playerLabel({display_name:'PV Player',position:'LB',jersey:'4'}),'PV Player • LB • #4');
});

test('lineup countdown parses kickoff explicitly in America/Chicago',()=>{
  assert.equal(new Date(centralKickoffEpoch('8/29/2026 8:00 PM')).toISOString(),'2026-08-30T01:00:00.000Z');
  assert.equal(new Date(centralKickoffEpoch('11/7/2026 2:00 PM')).toISOString(),'2026-11-07T20:00:00.000Z');
  assert.equal(centralKickoffEpoch('TBA'),null);
});

test('submission outcomes distinguish all authoritative participant states',()=>{
  assert.equal(submissionOutcome({accepted:true,version:1},true).state,'success');
  assert.equal(submissionOutcome({accepted:true,version:2},true).state,'updated');
  assert.equal(submissionOutcome({accepted:true,duplicate:true},true).state,'duplicate');
  assert.equal(submissionOutcome({code:'PICKS_CLOSED'},false).state,'locked');
  assert.equal(submissionOutcome({code:'INVALID_IDENTITY'},false).state,'identity');
  assert.equal(submissionOutcome({code:'INVALID_LINEUP',message:'A player cannot be used twice.'},false).state,'duplicate-error');
  assert.equal(submissionOutcome({code:'INVALID_LINEUP',message:'Player is not eligible for RB.'},false).state,'ineligible');
  assert.equal(submissionOutcome({},false).state,'failure');
});

test('public leaderboard excludes demo data and ranks valid weekly scores once entry is locked',()=>{
  const result=publicLeaderboard({games:[{Week:'W1','Pick Status':'LOCKED'}],weekly:[{'Participant ID':'DEMO-1','Display Name':'Demo Participant',Week:'W1','Fantasy Score':99,Validation:'VALID'},{'Participant ID':'P1','Display Name':'Panther One',Week:'W1','Fantasy Score':18,Validation:'VALID'},{'Participant ID':'P2','Display Name':'Panther Two',Week:'W1','Fantasy Score':24,Validation:'VALID'}],leaderboard:[{Rank:1,'Participant ID':'P2','Display Name':'Panther Two',Total:24,Avg:24,'Best Week':24}]});
  assert.deepEqual(result.weekly.map(row=>row.participant),['Panther Two','Panther One']);
  assert.equal(result.cumulative.length,1);
});

test('public leaderboard hides the current open week before scoring begins',()=>{
  const result=publicLeaderboard({games:[{Week:'W0','Pick Status':'OPEN'}],weekly:[{'Participant ID':'P1','Display Name':'Panther One',Week:'W0','Fantasy Score':0,Validation:'VALID'}],leaderboard:[{Rank:1,'Participant ID':'P1','Display Name':'Panther One',Total:0,Avg:0,'Best Week':0}]});
  assert.deepEqual(result.weekly,[]);
  assert.deepEqual(result.cumulative,[]);
});

test('public leaderboard preserves prior season totals while a later week is open',()=>{
  const result=publicLeaderboard({games:[{Week:'W0','Pick Status':'LOCKED'},{Week:'W1','Pick Status':'OPEN'}],weekly:[{'Participant ID':'P1','Display Name':'Panther One',Week:'W0','Fantasy Score':18,Validation:'VALID'},{'Participant ID':'P1','Display Name':'Panther One',Week:'W1','Fantasy Score':0,Validation:'VALID'}],leaderboard:[{Rank:1,'Participant ID':'P1','Display Name':'Panther One',Total:18,Avg:18,'Best Week':18}]});
  assert.deepEqual(result.weekly,[]);
  assert.deepEqual(result.cumulative.map(row=>row.participant),['Panther One']);
});

test('participant score labels honor final publication without exposing gates',()=>{
  assert.equal(participantStatusLabel({'Pick Status':'OPEN','Stats Final?':'NO'},'HOLD'),'PREGAME');
  assert.equal(participantStatusLabel({'Pick Status':'LOCKED','Stats Final?':'NO'},'HOLD'),'LIVE • PROVISIONAL');
  assert.equal(participantStatusLabel({'Stats Final?':'YES'},'HOLD'),'FINAL • PUBLICATION HOLD');
  assert.equal(participantStatusLabel({'Stats Final?':'YES'},''),'FINAL • CERTIFICATION PENDING');
  assert.equal(participantStatusLabel({'Stats Final?':'YES'},'PUBLISH'),'FINAL • OFFICIAL');
});

test('participant results expose only accepted scoring-version picks',()=>{
  const base={participants:[{'Participant ID':'PART-1','Display Name':'Panther One',Email:'one@example.com','Normalized Email':'one@example.com',Active:'YES','Identity Status':'VERIFIED'}],active:[{'Game ID':'G1',Week:'W1','Participant ID':'PART-1','Active Submission ID':'SUB2','Accepted?':'YES','Scoring Version?':'YES','Fantasy Score':12}],picks:[{'Game ID':'G1','Submission ID':'SUB1','Player ID':'OLD','Slot ID':'RB','Valid?':'YES','Scoring Version?':'NO','Submission State':'SUPERSEDED'},{'Game ID':'G1','Submission ID':'SUB2','Player ID':'P1','Slot ID':'RB','Valid?':'YES','Scoring Version?':'YES','Submission State':'ACCEPTED','Fantasy Points':12}],scores:[{'Game ID':'G1','Player ID':'P1',TOTAL:12}],weekly:[{'Game ID':'G1','Participant ID':'PART-1','Fantasy Score':12,Validation:'VALID'}],games:[{'Game ID':'G1',Opponent:'Opponent','Kickoff (CT)':'date'}],players:[{'Player ID':'P1','Player Name':'Current Player',Position:'RB',Jersey:''}]};
  const result=participantResults(base,'ONE@example.com');
  assert.equal(result.display_name,'Panther One');
  assert.deepEqual(result.lineups[0].players.map(player=>player.name),['Current Player']);
  assert.equal(participantResults(base,'unknown@example.com'),null);
});

test('participant results do not reveal picks while entry remains open',()=>{
  const fixture={participants:[{'Participant ID':'PART-1','Display Name':'Panther One',Email:'one@example.com',Active:'YES','Identity Status':'VERIFIED'}],active:[{'Game ID':'G1','Participant ID':'PART-1','Accepted?':'YES','Scoring Version?':'YES'}],games:[{'Game ID':'G1','Pick Status':'OPEN'}]};
  assert.deepEqual(participantResults(fixture,'one@example.com').lineups,[]);
});

test('public player directory hides fantasy production before the current week locks',()=>{
  const result=publicPlayerDirectory({
    games:[{'Game ID':'G0',Week:'W0','Pick Status':'OPEN'}],
    scores:[{'Game ID':'G0',Week:'W0','Player ID':'P1',TOTAL:18.7}],
    players:[{player_key:'P1',display_name:'Panther Runner',position:'RB',side:'OFF',eligible_slots:['RB','Offensive Flex']}]
  });
  assert.equal(result.week,'W0');
  assert.equal(result.players[0].week_points,null);
  assert.equal(result.players[0].season_points,null);
});

test('public player directory exposes authoritative player points after lineup lock',()=>{
  const result=publicPlayerDirectory({
    games:[{'Game ID':'G0',Week:'W0','Pick Status':'LOCKED'}],
    scores:[{'Game ID':'G0',Week:'W0','Player ID':'P1',TOTAL:18.7}],
    players:[{player_key:'P1',display_name:'Panther Runner',position:'RB',side:'OFF',eligible_slots:['RB','Offensive Flex']}]
  });
  assert.equal(result.players[0].week_points,18.7);
  assert.equal(result.players[0].season_points,18.7);
});

test('public player directory preserves prior season totals while a later week remains open',()=>{
  const result=publicPlayerDirectory({
    games:[
      {'Game ID':'G0',Week:'W0','Pick Status':'LOCKED'},
      {'Game ID':'G1',Week:'W1','Pick Status':'OPEN'}
    ],
    scores:[
      {'Game ID':'G0',Week:'W0','Player ID':'P1',TOTAL:18.7},
      {'Game ID':'G1',Week:'W1','Player ID':'P1',TOTAL:99}
    ],
    players:[{player_key:'P1',display_name:'Panther Runner',position:'RB',side:'OFF',eligible_slots:['RB','Offensive Flex']}]
  });
  assert.equal(result.week,'W1');
  assert.equal(result.players[0].week_points,null);
  assert.equal(result.players[0].season_points,18.7);
});
test('public player directory keeps the prior scored week until 48 hours before the next kickoff',()=>{
  const games=[
    {'Game ID':'G0',Week:'W0','Pick Status':'LOCKED','Kickoff (CT)':'8/29/2026 8:00 PM'},
    {'Game ID':'G1',Week:'W1','Pick Status':'OPEN','Kickoff (CT)':'9/5/2026 8:00 PM'}
  ];
  const scores=[
    {'Game ID':'G0',Week:'W0','Player ID':'P1',TOTAL:18.7}
  ];
  const players=[
    {player_key:'P1',display_name:'Panther Runner',position:'RB',side:'OFF',eligible_slots:['RB','Offensive Flex']}
  ];

  const beforeSwitch=centralKickoffEpoch('9/3/2026 7:59 PM');
  const result=publicPlayerDirectory({games,scores,players},'',beforeSwitch);

  assert.equal(result.week,'W0');
  assert.equal(result.players[0].week_points,18.7);
  assert.equal(result.players[0].season_points,18.7);
});

test('public player directory switches to the upcoming week 48 hours before kickoff',()=>{
  const games=[
    {'Game ID':'G0',Week:'W0','Pick Status':'LOCKED','Kickoff (CT)':'8/29/2026 8:00 PM'},
    {'Game ID':'G1',Week:'W1','Pick Status':'OPEN','Kickoff (CT)':'9/5/2026 8:00 PM'}
  ];
  const scores=[
    {'Game ID':'G0',Week:'W0','Player ID':'P1',TOTAL:18.7}
  ];
  const players=[
    {player_key:'P1',display_name:'Panther Runner',position:'RB',side:'OFF',eligible_slots:['RB','Offensive Flex']}
  ];

  const atSwitch=centralKickoffEpoch('9/3/2026 8:00 PM');
  const result=publicPlayerDirectory({games,scores,players},'',atSwitch);

  assert.equal(result.week,'W1');
  assert.equal(result.players[0].week_points,null);
  assert.equal(result.players[0].season_points,18.7);
});
test('public player directory history contains completed weeks only and does not expose future scores',()=>{
  const result=publicPlayerDirectory({
    games:[
      {'Game ID':'G0',Week:'W0','Pick Status':'LOCKED'},
      {'Game ID':'G1',Week:'W1','Pick Status':'OPEN'},
      {'Game ID':'G2',Week:'W2','Pick Status':'PENDING'}
    ],
    scores:[
      {'Game ID':'G0',Week:'W0','Player ID':'P1',TOTAL:18.7},
      {'Game ID':'G1',Week:'W1','Player ID':'P1',TOTAL:99}
    ],
    players:[
      {player_key:'P1',display_name:'Panther Runner',position:'RB',side:'OFF',eligible_slots:['RB','Offensive Flex']}
    ]
  });

  assert.deepEqual(result.players[0].history,[
    {week:'W0',points:18.7}
  ]);
});

test('public player directory preserves a legitimate zero-point game in player history',()=>{
  const result=publicPlayerDirectory({
    games:[
      {'Game ID':'G0',Week:'W0','Pick Status':'LOCKED'}
    ],
    scores:[
      {'Game ID':'G0',Week:'W0','Player ID':'P1',TOTAL:0}
    ],
    players:[
      {player_key:'P1',display_name:'Panther Runner',position:'RB',side:'OFF',eligible_slots:['RB','Offensive Flex']}
    ]
  });

  assert.deepEqual(result.players[0].history,[
    {week:'W0',points:0}
  ]);
});