import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindAuthenticatedLineup,createParticipantAuthService,permanentParticipantId,validateRegistration} from '../lib/participant-auth.mjs';
import {consumeAuthAttempt} from '../lib/public-auth-throttle.mjs';

const valid={first_name:'Avery',last_name:"O'Neal",email:'avery@example.test',display_name:'Purple Reign',accepted_terms:true};
function memoryRepository(seed=[]){
  const participants=seed.map(item=>({...item})),challenges=new Map(),sessions=new Map();let exclusive=Promise.resolve();
  return{participants,challenges,sessions,
    async runRegistrationExclusive(_email,work){const previous=exclusive;let release;exclusive=new Promise(resolve=>{release=resolve});await previous;try{return await work()}finally{release()}},
    async findParticipantByEmail(email){return participants.find(item=>item.email===email&&item.active!==false)||null;},
    async findParticipantRecordByEmail(email){return participants.find(item=>item.email===email)||null;},
    async findParticipantById(id){return participants.find(item=>item.id===id&&item.active!==false)||null;},
    async latestChallenge(id){return[...challenges.values()].filter(item=>item.participant.id===id&&item.status==='PENDING').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]||null;},
    async latestChallengeByEmail(email){return[...challenges.values()].filter(item=>item.participant.email===email&&item.status==='PENDING').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]||null;},
    async createChallenge(value){challenges.set(value.id,{...value,status:'PENDING'});},async findChallenge(id){return challenges.get(id)||null;},async updateChallenge(id,value){Object.assign(challenges.get(id),value);},
    async finalizeRegistration(registration,{makeParticipantId}){const returning=participants.find(item=>item.email===registration.email&&item.active!==false);if(returning)return returning;if(participants.some(item=>item.displayName.toLowerCase()===registration.displayName.toLowerCase())){const error=new Error('That Fantasy Team Name is unavailable.');error.code='DUPLICATE_TEAM_NAME';throw error;}let id;for(let i=0;i<8;i+=1){const candidate=makeParticipantId();if(!participants.some(item=>item.id===candidate)){id=candidate;break}}if(!id){const error=new Error('ID conflict');error.code='PARTICIPANT_ID_CONFLICT';throw error;}const participant={id,email:registration.email,displayName:registration.displayName,firstName:registration.firstName,lastName:registration.lastName,active:true};participants.push(participant);return participant;},
    async createSession(value){sessions.set(value.hash,{...value,participantId:value.participant.id,status:'ACTIVE'});},async findSessionByHash(hash){return sessions.get(hash)||null;},async revokeSession(){}
  };
}
function service(repository,{clock=Date.parse('2026-08-17T12:00:00Z'),ids=[]}={}){let now=clock,index=0,delivered=[];const auth=createParticipantAuthService({repository,secret:'registration-test-secret',now:()=>now,sendCode:async value=>delivered.push(value),makeToken:()=>ids[index++]||`TOKEN-${index}`,makeCode:()=> '123456',makeParticipantId:()=>ids[index++]||`PART-NEW-${index}`});return{auth,delivered,advance:value=>{now+=value}};}

test('successful registration activates only after verification and creates a session',async()=>{
  const repository=memoryRepository(),fixture=service(repository,{ids:['CHALLENGE','PART-NEW','SESSION-TOKEN','SESSION-ROW']});
  const requested=await fixture.auth.register(valid);assert.equal(repository.participants.length,0);assert.equal(fixture.delivered.length,1);
  const verified=await fixture.auth.verify(requested.challengeId,'123456');assert.equal(repository.participants.length,1);assert.equal(repository.participants[0].displayName,'Purple Reign');
  const authenticated=await fixture.auth.authenticate(verified.token);assert.equal(authenticated.email,valid.email);assert.equal(bindAuthenticatedLineup({email:'attacker@test',game_id:'G1',picks:{}},authenticated).email,valid.email);
});

test('invalid, expired, and excessively attempted registration codes never activate',async()=>{
  const repository=memoryRepository(),fixture=service(repository);const request=await fixture.auth.register(valid);
  assert.equal(await fixture.auth.verify(request.challengeId,'000000'),null);fixture.advance(11*60*1000);assert.equal(await fixture.auth.verify(request.challengeId,'123456'),null);assert.equal(repository.participants.length,0);
  const secondRepository=memoryRepository(),second=service(secondRepository);const other=await second.auth.register({...valid,email:'other@example.test'});for(let i=0;i<5;i+=1)assert.equal(await second.auth.verify(other.challengeId,'000000'),null);assert.equal(await second.auth.verify(other.challengeId,'123456'),null);assert.equal(secondRepository.participants.length,0);
});

test('registration validation rejects malformed identity and terms input',()=>{
  assert.equal(validateRegistration({...valid,email:'bad'}).code,'INVALID_EMAIL');
  assert.equal(validateRegistration({...valid,first_name:'1'}).code,'INVALID_NAME');
  assert.equal(validateRegistration({...valid,display_name:'x'}).code,'INVALID_TEAM_NAME');
  assert.equal(validateRegistration({...valid,display_name:'Bad <script>'}).code,'INVALID_TEAM_NAME');
  assert.equal(validateRegistration({...valid,accepted_terms:false}).code,'TERMS_REQUIRED');
});

test('existing email transitions to returning authentication without creating a duplicate',async()=>{
  const existing={id:'PART-EXISTING',email:valid.email,displayName:'Existing Team',active:true};const repository=memoryRepository([existing]),fixture=service(repository);
  const request=await fixture.auth.register(valid);assert.ok(request.challengeId);assert.equal(repository.participants.length,1);assert.equal(fixture.delivered[0].displayName,'Existing Team');
});

test('duplicate Fantasy Team Name fails closed after email verification',async()=>{
  const repository=memoryRepository([{id:'PART-ONE',email:'one@example.test',displayName:'Purple Reign',active:true}]),fixture=service(repository);const request=await fixture.auth.register({...valid,email:'two@example.test'});
  await assert.rejects(()=>fixture.auth.verify(request.challengeId,'123456'),error=>error.code==='DUPLICATE_TEAM_NAME');assert.equal(repository.participants.length,1);assert.equal(repository.sessions.size,0);
});

test('participant ID allocation retries collisions and permanent IDs are opaque',async()=>{
  const repository=memoryRepository([{id:'PART-COLLISION',email:'one@example.test',displayName:'One',active:true}]);const fixture=service(repository,{ids:['CHALLENGE','PART-COLLISION','PART-UNIQUE','SESSION-TOKEN','SESSION-ROW']});const request=await fixture.auth.register({...valid,email:'new@example.test',display_name:'New Team'});await fixture.auth.verify(request.challengeId,'123456');assert.equal(repository.participants.at(-1).id,'PART-UNIQUE');assert.match(permanentParticipantId(),/^PART-[A-F0-9]{32}$/);
});

test('repeated and concurrent registration requests reuse one pending challenge',async()=>{
  const repository=memoryRepository(),fixture=service(repository);const [first,second]=await Promise.all([fixture.auth.register(valid),fixture.auth.register(valid)]);assert.equal(first.challengeId,second.challengeId);assert.equal(fixture.delivered.length,1);assert.equal(repository.challenges.size,1);
});

test('verification response does not expose canonical participant identity or session token',async()=>{
  const route=await readFile(new URL('../app/api/auth/verify/route.js',import.meta.url),'utf8');const body=route.match(/NextResponse\.json\(\{authenticated:true,([^}]*)\}/)?.[1]||'';assert.doesNotMatch(body,/participant|token|email/i);assert.match(body,/display_name/);assert.match(route,/cookies\.set\(AUTH_COOKIE,verified\.token/);
});

test('public auth throttle rejects bursts and recovers after its window',()=>{
  const key=`registration-test-${Date.now()}`;assert.equal(consumeAuthAttempt(key,{limit:2,windowMs:1000,now:100}),true);assert.equal(consumeAuthAttempt(key,{limit:2,windowMs:1000,now:200}),true);assert.equal(consumeAuthAttempt(key,{limit:2,windowMs:1000,now:300}),false);assert.equal(consumeAuthAttempt(key,{limit:2,windowMs:1000,now:1201}),true);
});
