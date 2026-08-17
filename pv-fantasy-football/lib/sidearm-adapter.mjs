const ZERO = 0;

export const SIDEARM_FIELD_MAP = [
  ['Rushing.RushingAttempts','audit.rushingAttempts','VERIFIED'],
  ['Rushing.RushingNetYards','rushYards','VERIFIED'],
  ['Rushing.RushingTouchdowns','rushTouchdowns','VERIFIED'],
  ['Receiving.ReceivingReceptions','receptions','VERIFIED'],
  ['Receiving.ReceivingYards','receivingYards','VERIFIED'],
  ['Receiving.ReceivingTouchdowns','receivingTouchdowns','VERIFIED'],
  ['Passing.PassIntercepted','passingInterceptions','VERIFIED'],
  ['Fumbles.FumblesLost','fumblesLost','VERIFIED'],
  ['Tackling.TotalTackles','tackles','VERIFIED'],
  ['Tackling.UnassistedTacklesForLoss + 0.5 × AssistedTacklesForLoss','tacklesForLoss','VERIFIED_DERIVED'],
  ['Tackling.TacklesForLossYards','tackleForLossYards','VERIFIED'],
  ['Sacks.TotalSacks','sacks','VERIFIED'],
  ['Sacks.SackYardsForLossYards','sackYards','VERIFIED'],
  ['Sacks.HurriedQb','quarterbackHurries','VERIFIED'],
  ['PassDefense.BrokenPass','passBreakups','VERIFIED'],
  ['Interceptions.InterceptionReturnReturns','defensiveInterceptions','VERIFIED'],
  ['Interceptions.InterceptionReturnYards','interceptionReturnYards','VERIFIED'],
  [null,'forcedFumbles','UNSUPPORTED'],
  [null,'fumbleRecoveries','UNSUPPORTED'],
  ['Interceptions.InterceptionReturnTouchdowns','defensiveReturnTouchdowns','VERIFIED_INT_TD_ONLY'],
  ['KickReturns.KickoffReturnTouchdowns','audit.kickReturnTouchdowns','VERIFIED_EXCLUDED'],
  ['PuntReturns.PuntReturnTouchdowns','audit.puntReturnTouchdowns','VERIFIED_EXCLUDED'],
];

export function normalizeName(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
}

function groupNameParts(value) {
  const parts = String(value || '').replaceAll(',',' ').trim().split(/\s+/).filter(Boolean);
  const normalized = parts.map(normalizeName).filter(Boolean);
  return {first:normalized[0] || '',last:normalized.at(-1) || ''};
}

function groupMatchesPlayer(groupRow, player) {
  const group = groupNameParts(groupRow.Name);
  const first = normalizeName(player.FirstName);
  const last = normalizeName(player.LastName);
  return group.last === last && (!group.first || first.startsWith(group.first));
}

export function resolveSidearmIdentity(groupRow, team, canonicalPlayers = []) {
  const providerId = String(groupRow.PersonId || '').trim();
  const roster = team?.Players || [];
  let candidates = providerId ? roster.filter(player => String(player.PersonId || '') === providerId) : [];
  let method = 'PERSON_ID';
  if (!candidates.length) {
    method = 'TEAM_JERSEY_NAME';
    candidates = roster.filter(player => String(player.UniformNumber || '') === String(groupRow.Uni || '') && groupMatchesPlayer(groupRow, player));
  }
  if (candidates.length !== 1) {
    return {status:candidates.length ? 'AMBIGUOUS_PROVIDER_PLAYER' : 'UNMATCHED_PROVIDER_PLAYER', method, candidates:candidates.length};
  }
  const player = candidates[0];
  const canonicalByProvider = providerId ? canonicalPlayers.filter(item => String(item.providerPersonId || '') === providerId) : [];
  let canonicalCandidates = canonicalByProvider;
  let canonicalMethod = 'PERSON_ID';
  if (!canonicalCandidates.length) {
    canonicalMethod = 'FULL_NAME_JERSEY';
    const fullName = normalizeName(`${player.FirstName} ${player.LastName}`);
    canonicalCandidates = canonicalPlayers.filter(item =>
      normalizeName(item.name) === fullName && String(item.jersey || '') === String(player.UniformNumber || '')
    );
  }
  if (canonicalCandidates.length !== 1) {
    return {
      status:canonicalCandidates.length ? 'AMBIGUOUS_CANONICAL_PLAYER' : 'UNMATCHED_CANONICAL_PLAYER',
      method:`${method}+${canonicalMethod}`, providerPlayer:player, candidates:canonicalCandidates.length,
    };
  }
  return {status:'MATCHED',method:`${method}+${canonicalMethod}`,providerPlayer:player,playerId:canonicalCandidates[0].playerId};
}

function number(value, field, issues) {
  if (value === undefined || value === null || value === '') return ZERO;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) issues.push({code:'INVALID_SIDEARM_NUMBER',field,value});
  return parsed;
}

function add(target, field, value) {
  target[field] = (target[field] || 0) + value;
}

export function normalizeSidearmTeam(team, canonicalPlayers) {
  const rows = new Map();
  const issues = [];
  const identityMethods = new Set();
  function record(groupName, source, apply) {
    for (const sourceRow of source || []) {
      const identity = resolveSidearmIdentity(sourceRow, team, canonicalPlayers);
      if (identity.status !== 'MATCHED') {
        issues.push({code:identity.status,group:groupName,uni:sourceRow.Uni,name:sourceRow.Name,candidates:identity.candidates});
        continue;
      }
      identityMethods.add(identity.method);
      const player = identity.providerPlayer;
      const current = rows.get(identity.playerId) || {
        playerId:identity.playerId, playerName:`${player.FirstName} ${player.LastName}`,
        rushYards:0,rushTouchdowns:0,receptions:0,receivingYards:0,receivingTouchdowns:0,
        passingInterceptions:0,fumblesLost:0,tackles:0,tacklesForLoss:0,tackleForLossYards:0,
        sacks:0,sackYards:0,quarterbackHurries:0,passBreakups:0,defensiveInterceptions:0,
        interceptionReturnYards:0,forcedFumbles:null,fumbleRecoveries:null,defensiveReturnTouchdowns:0,
        audit:{rushingAttempts:0,kickReturnTouchdowns:0,puntReturnTouchdowns:0,providerPersonId:player.PersonId || null,jersey:player.UniformNumber},
      };
      apply(current, sourceRow);
      rows.set(identity.playerId,current);
    }
  }
  const groups = team?.PlayerGroups || {};
  record('Rushing',groups.Rushing?.Values,(row,v)=>{add(row.audit,'rushingAttempts',number(v.RushingAttempts,'RushingAttempts',issues));add(row,'rushYards',number(v.RushingNetYards,'RushingNetYards',issues));add(row,'rushTouchdowns',number(v.RushingTouchdowns,'RushingTouchdowns',issues));});
  record('Receiving',groups.Receiving?.Values,(row,v)=>{add(row,'receptions',number(v.ReceivingReceptions,'ReceivingReceptions',issues));add(row,'receivingYards',number(v.ReceivingYards,'ReceivingYards',issues));add(row,'receivingTouchdowns',number(v.ReceivingTouchdowns,'ReceivingTouchdowns',issues));});
  record('Passing',groups.Passing?.Values,(row,v)=>add(row,'passingInterceptions',number(v.PassIntercepted,'PassIntercepted',issues)));
  record('Fumbles',groups.Fumbles?.Values,(row,v)=>add(row,'fumblesLost',number(v.FumblesLost,'FumblesLost',issues)));
  record('Tackling',groups.Tackling?.Values,(row,v)=>{add(row,'tackles',number(v.TotalTackles,'TotalTackles',issues));add(row,'tacklesForLoss',number(v.UnassistedTacklesForLoss,'UnassistedTacklesForLoss',issues)+0.5*number(v.AssistedTacklesForLoss,'AssistedTacklesForLoss',issues));add(row,'tackleForLossYards',number(v.TacklesForLossYards,'TacklesForLossYards',issues));});
  record('Sacks',groups.Sacks?.Values,(row,v)=>{add(row,'sacks',number(v.TotalSacks,'TotalSacks',issues));add(row,'sackYards',number(v.SackYardsForLossYards,'SackYardsForLossYards',issues));add(row,'quarterbackHurries',number(v.HurriedQb,'HurriedQb',issues));});
  record('PassDefense',groups.PassDefense?.Values,(row,v)=>add(row,'passBreakups',number(v.BrokenPass,'BrokenPass',issues)));
  record('Interceptions',groups.Interceptions?.Values,(row,v)=>{add(row,'defensiveInterceptions',number(v.InterceptionReturnReturns,'InterceptionReturnReturns',issues));add(row,'interceptionReturnYards',number(v.InterceptionReturnYards,'InterceptionReturnYards',issues));add(row,'defensiveReturnTouchdowns',number(v.InterceptionReturnTouchdowns,'InterceptionReturnTouchdowns',issues));});
  record('KickReturns',groups.KickReturns?.Values,(row,v)=>add(row.audit,'kickReturnTouchdowns',number(v.KickoffReturnTouchdowns,'KickoffReturnTouchdowns',issues)));
  record('PuntReturns',groups.PuntReturns?.Values,(row,v)=>add(row.audit,'puntReturnTouchdowns',number(v.PuntReturnTouchdowns,'PuntReturnTouchdowns',issues)));
  issues.push({code:'UNSUPPORTED_SIDEARM_FIELD',field:'forcedFumbles'});
  issues.push({code:'UNSUPPORTED_SIDEARM_FIELD',field:'fumbleRecoveries'});
  return {rows:[...rows.values()],issues,identityMethods:[...identityMethods]};
}

export function validateSidearmGameIdentity(payload, expected) {
  const game = payload?.Game || {};
  const findings = [];
  if (game.HomeTeam?.Name !== expected.homeTeam || game.VisitingTeam?.Name !== expected.visitingTeam) findings.push('TEAM_MISMATCH');
  if (expected.ncaaGameId && String(game.NcaaGameId || '') !== String(expected.ncaaGameId)) findings.push('NCAA_GAME_ID_MISMATCH');
  if (expected.date && String(game.Date || '') !== String(expected.date)) findings.push('PROVIDER_DATE_MISMATCH');
  return {valid:findings.length === 0,findings,providerDate:game.Date || null,scheduledDate:expected.date || null};
}
