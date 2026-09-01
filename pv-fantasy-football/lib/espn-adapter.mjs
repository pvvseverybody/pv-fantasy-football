const ESPN_SUMMARY_BASE='https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary';
const PV_TEAM_ID='2504';
const OFFENSE=new Set(['QB','RB','WR','TE']);
const DEFENSE=new Set(['DL','LB','DB']);
const DUAL_ROLE_NAMES=new Set(['TONY TERRY']);
const BUILT_IN_ALIASES=new Map([['CHANEY FITZGERALED','Chaney Fitzgerald']]);

const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;};
const normalizedName=value=>String(value||'').toUpperCase().replace(/\b(JR|SR|II|III|IV)\b\.?/g,'').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const categorySide=name=>['passing','rushing','receiving'].includes(name)?'OFF':
  ['defensive','interceptions'].includes(name)?'DEF':null;
const compatible=(player,side)=>!side||(side==='OFF'?OFFENSE:DEFENSE).has(String(player.Position||'').toUpperCase())||DUAL_ROLE_NAMES.has(normalizedName(player['Player Name']));

function issue(code,message,context={}){return{code,message,...context};}

function resolveAthlete(athlete,category,players,aliases){
  const side=categorySide(category);
  const sourceName=normalizedName(athlete.displayName);
  const aliased=normalizedName(aliases.get(sourceName)||BUILT_IN_ALIASES.get(sourceName)||sourceName);
  const exactAny=players.filter(player=>normalizedName(player['Player Name'])===aliased);
  const exact=exactAny.filter(player=>compatible(player,side));
  if(exact.length===1)return exact[0];
  const jersey=String(athlete.jersey||'').trim();
  const byJersey=jersey?players.filter(player=>String(player.Jersey||'').trim()===jersey&&compatible(player,side)):[];
  if(byJersey.length===1)return byJersey[0];
  if(exactAny.length===1)return exactAny[0];
  return null;
}

function emptyStats(player){return{
  playerId:player['Player ID'],playerName:player['Player Name'],rushYards:0,rushTouchdowns:0,
  receptions:0,receivingYards:0,receivingTouchdowns:0,passingInterceptions:0,
  fumblesLost:0,tackles:0,tacklesForLoss:0,tackleForLossYards:0,sacks:0,
  sackYards:0,quarterbackHurries:0,passBreakups:0,defensiveInterceptions:0,
  interceptionReturnYards:0,forcedFumbles:0,fumbleRecoveries:0,defensiveReturnTouchdowns:0,
};}

const FIELD_MAP={
  passing:{interceptions:'passingInterceptions'},
  rushing:{rushingYards:'rushYards',rushingTouchdowns:'rushTouchdowns'},
  receiving:{receptions:'receptions',receivingYards:'receivingYards',receivingTouchdowns:'receivingTouchdowns'},
  fumbles:{fumblesLost:'fumblesLost'},
  defensive:{totalTackles:'tackles',sacks:'sacks',tacklesForLoss:'tacklesForLoss',passesDefended:'passBreakups',hurries:'quarterbackHurries',defensiveTouchdowns:'defensiveReturnTouchdowns'},
  interceptions:{interceptions:'defensiveInterceptions',interceptionYards:'interceptionReturnYards',interceptionTouchdowns:'defensiveReturnTouchdowns'},
};

export function inspectEspnGame(payload,{eventId,homeTeamId=PV_TEAM_ID,awayTeamId='2640'}={}){
  const competition=payload?.header?.competitions?.[0];
  const teams=competition?.competitors||[];
  const ids=new Set(teams.map(item=>String(item.team?.id||item.id||'')));
  const findings=[];
  if(!competition)findings.push(issue('MISSING_COMPETITION','ESPN summary is missing the competition.'));
  if(eventId&&String(payload?.header?.id)!==String(eventId))findings.push(issue('EVENT_ID_MISMATCH','ESPN event ID does not match FeedControl.',{actual:payload?.header?.id,expected:eventId}));
  if(!ids.has(String(homeTeamId))||!ids.has(String(awayTeamId)))findings.push(issue('TEAM_IDENTITY_MISMATCH','ESPN teams do not match Prairie View and Texas Southern.'));
  return{valid:findings.length===0,findings,state:competition?.status?.type?.state||'unknown',completed:Boolean(competition?.status?.type?.completed),date:competition?.date||null};
}

export function normalizeEspnPvStats(payload,{players,aliases=new Map(),gameId,week,sourceUrl,importedAt=new Date().toISOString()}={}){
  const active=(players||[]).filter(player=>String(player.Active||'YES').toUpperCase()==='YES'&&player['Player ID']);
  const stats=new Map(active.map(player=>[player['Player ID'],emptyStats(player)]));
  const pv=payload?.boxscore?.players?.find(item=>String(item.team?.id)===PV_TEAM_ID);
  const findings=[];
  if(!pv)return{valid:false,findings:[issue('PV_BOXSCORE_UNAVAILABLE','ESPN has not published Prairie View player statistics yet.')],rows:[]};
  for(const category of pv.statistics||[]){
    const map=FIELD_MAP[category.name];if(!map)continue;
    for(const entry of category.athletes||[]){
      const player=resolveAthlete(entry.athlete||{},category.name,active,aliases);
      if(!player){findings.push(issue('NON_POOL_PLAYER_IGNORED','An ESPN stat row belongs to a player outside the approved fantasy pool.',{category:category.name,name:entry.athlete?.displayName||'',jersey:entry.athlete?.jersey||''}));continue;}
      const target=stats.get(player['Player ID']);
      category.keys.forEach((key,index)=>{const field=map[key];if(field)target[field]+=number(entry.stats?.[index]);});
    }
  }
  const rows=[...stats.values()].map(row=>[
    gameId,week,row.playerId,row.playerName,row.rushYards,row.rushTouchdowns,row.receptions,
    row.receivingYards,row.receivingTouchdowns,row.passingInterceptions,row.fumblesLost,row.tackles,
    row.tacklesForLoss,row.tackleForLossYards,row.sacks,row.sackYards,row.quarterbackHurries,
    row.passBreakups,row.defensiveInterceptions,row.interceptionReturnYards,row.forcedFumbles,
    row.fumbleRecoveries,row.defensiveReturnTouchdowns,sourceUrl,importedAt,'NO',
  ]);
  return{valid:true,findings,rows};
}

export async function fetchEspnSummary(eventId,{fetchImpl=fetch,timeoutMs=12000}={}){
  if(!/^\d+$/.test(String(eventId||'')))throw new Error('ESPN event ID must be numeric.');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  const sourceUrl=`${ESPN_SUMMARY_BASE}?event=${encodeURIComponent(eventId)}`;
  try{
    const response=await fetchImpl(sourceUrl,{headers:{accept:'application/json'},signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error(`ESPN transport returned HTTP ${response.status}.`);
    return{payload:await response.json(),sourceUrl,fetchedAt:new Date().toISOString()};
  }finally{clearTimeout(timeout);}
}

export {ESPN_SUMMARY_BASE,PV_TEAM_ID,normalizedName};
