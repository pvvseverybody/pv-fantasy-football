import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublicationSnapshots} from '../lib/publication-snapshot.mjs';

const game = (id, week) => ({'Game ID':id, Week:week});

const weekly = (gameId, week, participantId, name, score, rank=1, validation='VALID') => ({
  'Game ID':gameId,
  Week:week,
  'Participant ID':participantId,
  'Display Name':name,
  'Fantasy Score':score,
  'Weekly Rank':rank,
  Validation:validation,
});

test('W0 publication creates official weekly and cumulative standings', () => {
  const rows = buildPublicationSnapshots({
    games:[game('2026-W0','W0')],
    weekly:[weekly('2026-W0','W0','P1','Panther One',78.1)],
    publicationGameIds:['2026-W0'],
    publishedAtByGame:{'2026-W0':'2026-08-30T05:00:00.000Z'},
  });

  assert.deepEqual(rows, [{
    'Game ID':'2026-W0',
    Week:'W0',
    'Weekly Rank':1,
    'Season Rank':1,
    Participant:'Panther One',
    'Week Points':78.1,
    'Season Points':78.1,
    Average:78.1,
    'Best Week':'W0',
    Status:'FINAL • OFFICIAL',
    'Published At':'2026-08-30T05:00:00.000Z',
  }]);
});

test('W1 snapshot calculates cumulative standings across published games', () => {
  const rows = buildPublicationSnapshots({
    games:[game('2026-W0','W0'),game('2026-W1','W1')],
    weekly:[
      weekly('2026-W0','W0','P1','Panther One',20,1),
      weekly('2026-W0','W0','P2','Panther Two',10,2),
      weekly('2026-W1','W1','P1','Panther One',5,2),
      weekly('2026-W1','W1','P2','Panther Two',30,1),
    ],
    publicationGameIds:['2026-W0','2026-W1'],
  });

  const w1 = rows.filter(row => row.Week === 'W1');
  assert.deepEqual(w1.map(row => [row.Participant,row['Season Points'],row['Season Rank']]), [
    ['Panther Two',40,1],
    ['Panther One',25,2],
  ]);
});

test('legitimate zero-point published game counts in average and can be best week', () => {
  const rows = buildPublicationSnapshots({
    games:[game('2026-W0','W0')],
    weekly:[weekly('2026-W0','W0','P1','Panther One',0)],
    publicationGameIds:['2026-W0'],
  });

  assert.equal(rows[0]['Season Points'],0);
  assert.equal(rows[0].Average,0);
  assert.equal(rows[0]['Best Week'],'W0');
});

test('future games do not count toward average', () => {
  const rows = buildPublicationSnapshots({
    games:[game('2026-W0','W0'),game('2026-W1','W1'),game('2026-W2','W2')],
    weekly:[
      weekly('2026-W0','W0','P1','Panther One',10),
      weekly('2026-W1','W1','P1','Panther One',0),
    ],
    publicationGameIds:['2026-W0','2026-W1'],
  });

  const w1 = rows.find(row => row.Week === 'W1');
  assert.equal(w1['Season Points'],10);
  assert.equal(w1.Average,5);
  assert.equal(w1['Best Week'],'W0');
});

test('postseason games follow W11 then P1 then P2 regardless of input order', () => {
  const rows = buildPublicationSnapshots({
    games:[
      game('2026-P2','P2'),
      game('2026-W11','W11'),
      game('2026-P1','P1'),
    ],
    weekly:[
      weekly('2026-W11','W11','P1','Panther One',10),
      weekly('2026-P1','P1','P1','Panther One',20),
      weekly('2026-P2','P2','P1','Panther One',30),
    ],
    publicationGameIds:['2026-P2','2026-W11','2026-P1'],
  });

  assert.deepEqual([...new Set(rows.map(row => row.Week))],['W11','P1','P2']);
  assert.equal(rows.find(row => row.Week === 'P2')['Season Points'],60);
});

test('demo records are excluded from every public snapshot', () => {
  const rows = buildPublicationSnapshots({
    games:[game('2026-W0','W0')],
    weekly:[
      weekly('2026-W0','W0','P1','Panther One',20,2),
      weekly('2026-W0','W0','DEMO-1','Demo Participant',999,1),
    ],
    publicationGameIds:['2026-W0'],
  });

  assert.deepEqual(rows.map(row => row.Participant),['Panther One']);
});

test('retroactive W0 correction recalculates an already-published W1 cumulative snapshot', () => {
  const games = [game('2026-W0','W0'),game('2026-W1','W1')];
  const publicationGameIds = ['2026-W0','2026-W1'];

  const before = buildPublicationSnapshots({
    games,
    weekly:[
      weekly('2026-W0','W0','P1','Panther One',10),
      weekly('2026-W1','W1','P1','Panther One',20),
    ],
    publicationGameIds,
  });

  const after = buildPublicationSnapshots({
    games,
    weekly:[
      weekly('2026-W0','W0','P1','Panther One',15),
      weekly('2026-W1','W1','P1','Panther One',20),
    ],
    publicationGameIds,
  });

  assert.equal(before.find(row => row.Week === 'W1')['Season Points'],30);
  assert.equal(after.find(row => row.Week === 'W1')['Season Points'],35);
});

test('duplicate valid weekly rows fail closed', () => {
  assert.throws(
    () => buildPublicationSnapshots({
      games:[game('2026-W0','W0')],
      weekly:[
        weekly('2026-W0','W0','P1','Panther One',10),
        weekly('2026-W0','W0','P1','Panther One',10),
      ],
      publicationGameIds:['2026-W0'],
    }),
    error => error.code === 'DUPLICATE_WEEKLY_SCORE'
  );
});