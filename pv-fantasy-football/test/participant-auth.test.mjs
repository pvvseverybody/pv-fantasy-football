import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticatedParticipantEmail,bindAuthenticatedLineup,cookieOptions,createParticipantAuthService,requiredAuthConfig} from '../lib/participant-auth.mjs';

function memoryRepository(participants){
  const challenges=new Map(),sessions=new Map();
  return{challenges,sessions,
    async findParticipantByEmail(email){return participants.find(item=>item.email===email)||null;},async findParticipantById(id){return participants.find(item=>item.id===id)||null;},
    async latestChallenge(id){return[...challenges.values()].filter(item=>item.participant.id===id&&item.status==='PENDING').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]||null;},
    async createChallenge(value){challenges.set(value.id,{...value,status:'PENDING'});},async findChallenge(id){return challenges.get(id)||null;},async updateChallenge(id,value){Object.assign(challenges.get(id),value);},
    async createSession(value){sessions.set(value.hash,{...value,participantId:value.participant.id,status:'ACTIVE'});},async findSessionByHash(hash){return sessions.get(hash)||null;},async revokeSession(id){for(const session of sessions.values())if(session.id===id)session.status='REVOKED';}
  };
}

const participantA={id:'PART-A',displayName:'Participant A',email:'a@registered.test'};
const participantB={id:'PART-B',displayName:'Participant B',email:'b@registered.test'};

test('missing production auth configuration fails closed',()=>{
  assert.throws(()=>requiredAuthConfig({}),error=>error.code==='AUTH_NOT_CONFIGURED');
  assert.throws(()=>requiredAuthConfig({PARTICIPANT_AUTH_SECRET:'short',RESEND_API_KEY:'key',PARTICIPANT_AUTH_FROM:'from@example.test'}),error=>error.code==='AUTH_NOT_CONFIGURED');
});

test('login request response does not enumerate registered emails',async()=>{
  const repository=memoryRepository([participantA]);const delivered=[];const service=createParticipantAuthService({repository,secret:'test-secret',sendCode:async value=>delivered.push(value),makeToken:(()=>{const values=['challenge'];return()=>values.shift()||'session';})(),makeCode:()=> '123456'});
  const known=await service.request(participantA.email);const unknown=await service.request('unknown@registered.test');
  assert.equal(known.message,unknown.message);assert.equal(delivered.length,1);assert.equal(unknown.challengeId,undefined);
});

test('authenticated session binds lineup to its owner and ignores modified client identity',async()=>{
  const repository=memoryRepository([participantA,participantB]);let delivered;const tokens=['challenge-a','session-token','session-row'];const service=createParticipantAuthService({repository,secret:'test-secret',sendCode:async value=>{delivered=value},makeToken:()=>tokens.shift(),makeCode:()=> '123456'});
  const requested=await service.request(participantA.email);assert.equal(delivered.to,participantA.email);
  const verified=await service.verify(requested.challengeId,'123456');const authenticated=await service.authenticate(verified.token);assert.equal(authenticated.id,participantA.id);
  const bound=bindAuthenticatedLineup({email:participantB.email,game_id:'G1',picks:{RB:'P1'}},authenticated);
  assert.equal(bound.email,participantA.email);assert.equal(bound.gameId,'G1');assert.notEqual(bound.email,participantB.email);
  assert.equal(authenticatedParticipantEmail(authenticated),participantA.email);
});

test('unauthenticated lineup binding and personal results identity are rejected',()=>{
  assert.throws(()=>bindAuthenticatedLineup({email:participantB.email},null),error=>error.code==='UNAUTHENTICATED');
  assert.throws(()=>authenticatedParticipantEmail(null),error=>error.code==='UNAUTHENTICATED');
});

test('invalid code and expired or invalid session are rejected',async()=>{
  let clock=Date.parse('2026-08-17T12:00:00Z');const repository=memoryRepository([participantA]);const tokens=['challenge-a','session-token','session-row'];const service=createParticipantAuthService({repository,secret:'test-secret',now:()=>clock,sendCode:async()=>{},makeToken:()=>tokens.shift(),makeCode:()=> '123456'});
  const requested=await service.request(participantA.email);assert.equal(await service.verify(requested.challengeId,'000000'),null);
  const verified=await service.verify(requested.challengeId,'123456');assert.equal(await service.authenticate('modified-token'),null);assert.equal((await service.authenticate(verified.token)).id,participantA.id);
  clock+=8*24*60*60*1000;assert.equal(await service.authenticate(verified.token),null);
});

test('session cookie policy is HttpOnly and SameSite strict',()=>{
  const options=cookieOptions(60);assert.equal(options.httpOnly,true);assert.equal(options.sameSite,'strict');assert.equal(options.path,'/');
});
