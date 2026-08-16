function zeroStats(overrides = {}) {
  return {
    rushYards:0, rushTouchdowns:0, receptions:0, receivingYards:0,
    receivingTouchdowns:0, passingInterceptions:0, fumblesLost:0,
    tackles:0, tacklesForLoss:0, tackleForLossYards:0, sacks:0,
    sackYards:0, quarterbackHurries:0, passBreakups:0,
    defensiveInterceptions:0, interceptionReturnYards:0, forcedFumbles:0,
    fumbleRecoveries:0, defensiveReturnTouchdowns:0,
    ...overrides,
  };
}

function stat(gameId, playerId, playerName, overrides = {}) {
  return {
    gameId, week:gameId === 'CERT-W1' ? 'W1' : 'W2', playerId, playerName,
    sourceUrl:`fixture://preseason/${gameId}/${playerId}`,
    importedAt:'2026-08-16T12:00:00-05:00', final:true,
    ...zeroStats(overrides),
  };
}

const names = Object.fromEntries(Array.from({length:15}, (_, index) => [`P${index + 1}`, `Fixture Player ${index + 1}`]));

export const participants = [
  {id:'CERT-A', displayName:'Certification Alpha'},
  {id:'CERT-B', displayName:'Certification Bravo'},
];

export const games = [
  {id:'CERT-W1', week:'W1', kickoff:'2026-08-29T20:00:00-05:00'},
  {id:'CERT-W2', week:'W2', kickoff:'2026-09-05T20:00:00-05:00'},
];

export const normalizedStats = [
  stat('CERT-W1','P1',names.P1,{rushYards:50,rushTouchdowns:1,receptions:4,receivingYards:30,receivingTouchdowns:1}),
  stat('CERT-W1','P2',names.P2,{rushYards:20,passingInterceptions:2,fumblesLost:1}),
  stat('CERT-W1','P3',names.P3,{receptions:6,receivingYards:90,receivingTouchdowns:1}),
  stat('CERT-W1','P4',names.P4,{rushYards:30,fumblesLost:1}),
  stat('CERT-W1','P5',names.P5,{tackles:8,tacklesForLoss:2,tackleForLossYards:12,sacks:1,sackYards:7,quarterbackHurries:2,passBreakups:1}),
  stat('CERT-W1','P6',names.P6,{tackles:4,defensiveInterceptions:1,interceptionReturnYards:35,defensiveReturnTouchdowns:1}),
  stat('CERT-W1','P7',names.P7,{kickReturnTouchdowns:1,puntReturnTouchdowns:1}),
  stat('CERT-W1','P8',names.P8,{tackles:6,forcedFumbles:1,fumbleRecoveries:1}),
  stat('CERT-W1','P9',names.P9,{receptions:2,receivingYards:20}),
  stat('CERT-W1','P10',names.P10,{rushYards:100,rushTouchdowns:1}),
  stat('CERT-W1','P11',names.P11,{receptions:5,receivingYards:50}),
  stat('CERT-W1','P12',names.P12,{tackles:10,tacklesForLoss:1,tackleForLossYards:4}),
  stat('CERT-W1','P13',names.P13,{tackles:5,tacklesForLoss:2,tackleForLossYards:15,sacks:2,sackYards:11,quarterbackHurries:1}),
  stat('CERT-W1','P14',names.P14,{defensiveInterceptions:1,interceptionReturnYards:10}),
  stat('CERT-W1','P15',names.P15,{rushYards:10,receptions:1,receivingYards:5}),
  stat('CERT-W2','P1',names.P1,{rushYards:100}),
  stat('CERT-W2','P2',names.P2,{rushYards:60,rushTouchdowns:1}),
  stat('CERT-W2','P3',names.P3,{receptions:4,receivingYards:40,receivingTouchdowns:1}),
  stat('CERT-W2','P4',names.P4,{rushYards:40}),
  stat('CERT-W2','P5',names.P5,{tackles:10,tacklesForLoss:1,tackleForLossYards:5}),
  stat('CERT-W2','P6',names.P6,{defensiveInterceptions:1,interceptionReturnYards:20}),
  stat('CERT-W2','P7',names.P7,{defensiveReturnTouchdowns:1}),
  stat('CERT-W2','P8',names.P8,{tackles:2}),
  stat('CERT-W2','P9',names.P9,{receptions:2,receivingYards:10}),
  stat('CERT-W2','P10',names.P10,{rushYards:10}),
  stat('CERT-W2','P11',names.P11,{receptions:1}),
  stat('CERT-W2','P12',names.P12,{tackles:2}),
  stat('CERT-W2','P13',names.P13,{tackles:1}),
  stat('CERT-W2','P14',names.P14),
  stat('CERT-W2','P15',names.P15),
];

const alphaV1 = ['P1','P2','P3','P4','P5','P6','P7','P8'];
const alphaV2 = ['P1','P2','P3','P4','P5','P6','P7','P9'];
const bravo = ['P1','P10','P11','P12','P13','P14','P15','P8'];

function submission(id, gameId, participantId, version, playerIds, submittedAt, overrides = {}) {
  return {id, gameId, participantId, version, playerIds, submittedAt, ...overrides};
}

export const submissions = [
  submission('SUB-A-W1-V1','CERT-W1','CERT-A',1,alphaV1,'2026-08-29T17:00:00-05:00'),
  submission('SUB-A-W1-V2','CERT-W1','CERT-A',2,alphaV2,'2026-08-29T18:00:00-05:00'),
  submission('SUB-B-W1-V1','CERT-W1','CERT-B',1,bravo,'2026-08-29T18:30:00-05:00'),
  submission('SUB-B-W1-LATE','CERT-W1','CERT-B',2,alphaV1,'2026-08-29T20:00:00-05:00',{expectedState:'REJECTED_LATE'}),
  submission('SUB-A-W2-V1','CERT-W2','CERT-A',1,alphaV2,'2026-09-05T18:00:00-05:00'),
  submission('SUB-B-W2-V1','CERT-W2','CERT-B',1,bravo,'2026-09-05T18:15:00-05:00'),
];

export const expectedPlayerScores = {
  'CERT-W1':{P1:22,P2:-4,P3:18,P4:1,P5:12.2,P6:13.5,P7:0,P8:5,P9:3,P10:16,P11:7.5,P12:6.4,P13:11,P14:3,P15:2},
  'CERT-W2':{P1:10,P2:12,P3:12,P4:4,P5:6.5,P6:4,P7:6,P8:1,P9:2,P10:1,P11:0.5,P12:1,P13:0.5,P14:0,P15:0},
};

export const expectedWeeklyScores = {
  'CERT-W1':{'CERT-A':65.7,'CERT-B':72.9},
  'CERT-W2':{'CERT-A':56.5,'CERT-B':14},
};

export const expectedLeaderboard = [
  {participantId:'CERT-A', total:122.2},
  {participantId:'CERT-B', total:86.9},
];

export const fixturePlayerNames = names;
