import test from 'node:test';
import assert from 'node:assert/strict';
import {dateToSheetsSerial,isBeforeKickoff} from '../lib/lineup-deadline.mjs';
import {centralKickoffEpoch} from '../lib/participant-experience.mjs';

test('server deadline rejects exactly kickoff and accepts immediately before',()=>{
  const kickoff=new Date('2026-08-30T01:00:00.000Z');const serial=dateToSheetsSerial(kickoff);
  assert.ok(dateToSheetsSerial(new Date(kickoff.getTime()-1000))<serial);
  assert.ok(dateToSheetsSerial(kickoff)>=serial);
  assert.equal(isBeforeKickoff(new Date(kickoff.getTime()-1000),serial),true);
  assert.equal(isBeforeKickoff(kickoff,serial),false);
});

test('America Chicago parsing observes daylight and standard offsets',()=>{
  assert.equal(centralKickoffEpoch('8/29/2026 8:00 PM'),Date.parse('2026-08-30T01:00:00Z'));
  assert.equal(centralKickoffEpoch('11/7/2026 8:00 PM'),Date.parse('2026-11-08T02:00:00Z'));
});
