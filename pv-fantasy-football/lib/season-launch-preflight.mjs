const upper=value=>String(value??'').trim().toUpperCase();
const text=value=>String(value??'').trim();
const yes=value=>['YES','TRUE','1','ACTIVE','VERIFIED','CLEAR'].includes(upper(value));
const first=(row,names)=>{for(const name of names){const value=row?.[name];if(value!==undefined&&value!==null&&text(value)!=='')return text(value);}return '';};
const diagnostic=(code,severity,message,action,context={})=>({code,severity,message,recommended_action:action,...context});
const norm=value=>upper(value).replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const gameId=row=>first(row,['Game ID','GameID','game_id']);
const opponent=row=>first(row,['Opponent','Opponent Name','PV Opponent','Game Opponent']);
const week=row=>first(row,['Week','Game Week']);
const kickoff=row=>first(row,['Kickoff (CT)','Kickoff CT','Kickoff','Scheduled Kickoff']);
const providerEvent=row=>first(row,['Provider Event ID','Provider Game ID','Event ID','Provider ID']);
const pickStatus=row=>upper(first(row,['Pick Status','Entry Status','Lineup Status']));
const participantId=row=>first(row,['Participant ID','ParticipantID']);
const participantEmail=row=>upper(first(row,['Email','Email Address','Normalized Email']));
const participantName=row=>upper(first(row,['Display Name','Fantasy Team Name','Team Name']));
const playerId=row=>first(row,['Player ID','PV Player ID']);
const playerActive=row=>!['NO','FALSE','0','INACTIVE'].includes(upper(first(row,['Active?','Active','Eligible?'])));

export const PREFLIGHT_ACTIONS={
  DUPLICATE_GAME_ID:'Keep exactly one authoritative Games row per Game ID before opening entries.',
  ORPHAN_CONTROL_GAME_ID:'Correct or remove the control row so every referenced Game ID exists in Games.',
  GAME_IDENTITY_DRIFT:'Align Game ID, opponent, week, kickoff, and provider identity with the authoritative Games row before enabling ingestion.',
  DUPLICATE_PROVIDER_EVENT_ID:'Assign each provider event ID to only one PV Game ID.',
  MULTIPLE_ENTRY_WINDOWS_OPEN:'Confirm advance multi-week entry is intentional; otherwise leave only the intended game OPEN.',
  DEMO_PARTICIPANT_ACTIVE:'Deactivate or remove demo/test participants before production launch.',
  DUPLICATE_PARTICIPANT_EMAIL:'Resolve active participant email collisions before accepting lineups.',
  DUPLICATE_TEAM_NAME:'Resolve case-insensitive public Fantasy Team Name collisions before launch.',
  NO_ACTIVE_ELIGIBLE_PLAYERS:'Load and approve the eligible PV roster before participant entry opens.',
  DUPLICATE_PLAYER_ID:'Keep each permanent PV Player ID unique in the active roster.',
  ROSTER_PROVISIONAL:'Complete final-roster reconciliation and migration before the first live game.',
  OPEN_GAME_FEED_UNCONFIGURED:'Configure and verify the official provider/event identity before the open game reaches kickoff.'
};

export function evaluateSeasonLaunchPreflight(tables={}){
  const diagnostics=[];
  const add=(code,severity,message,context={})=>diagnostics.push(diagnostic(code,severity,message,PREFLIGHT_ACTIONS[code],context));
  const games=(tables.Games||[]).filter(row=>gameId(row));
  const gameById=new Map();
  for(const game of games){
    const id=gameId(game);
    if(gameById.has(id))add('DUPLICATE_GAME_ID','BLOCKED',`Games contains duplicate rows for ${id}.`,{game_id:id});
    else gameById.set(id,game);
  }

  const controlTables=['FeedControl','RunnerState','Reconciliation'];
  const providerOwners=new Map();
  for(const tableName of controlTables){
    for(const row of tables[tableName]||[]){
      const id=gameId(row);if(!id)continue;
      const game=gameById.get(id);
      if(!game){add('ORPHAN_CONTROL_GAME_ID','BLOCKED',`${tableName} references ${id}, which is absent from Games.`,{table:tableName,game_id:id});continue;}
      const comparisons=[['opponent',opponent(row),opponent(game)],['week',week(row),week(game)],['kickoff',kickoff(row),kickoff(game)]];
      for(const [field,actual,expected] of comparisons){
        if(actual&&expected&&norm(actual)!==norm(expected))add('GAME_IDENTITY_DRIFT','BLOCKED',`${tableName} ${id} has ${field} “${actual}” but Games has “${expected}”.`,{table:tableName,game_id:id,field});
      }
      const event=providerEvent(row);
      if(event){
        const owner=providerOwners.get(norm(event));
        if(owner&&owner.game_id!==id)add('DUPLICATE_PROVIDER_EVENT_ID','BLOCKED',`Provider event ${event} is assigned to both ${owner.game_id} and ${id}.`,{table:tableName,game_id:id,provider_event_id:event});
        else providerOwners.set(norm(event),{game_id:id,table:tableName});
      }
    }
  }

  const openGames=games.filter(game=>pickStatus(game)==='OPEN');
  if(openGames.length>1)add('MULTIPLE_ENTRY_WINDOWS_OPEN','HOLD',`${openGames.length} games are OPEN for lineup entry: ${openGames.map(gameId).join(', ')}.`,{game_ids:openGames.map(gameId)});
  const feedsByGame=new Set((tables.FeedControl||[]).map(gameId).filter(Boolean));
  for(const game of openGames){const id=gameId(game);if(!feedsByGame.has(id))add('OPEN_GAME_FEED_UNCONFIGURED','HOLD',`${id} is OPEN but has no FeedControl row.`,{game_id:id});}

  const participants=(tables.Participants||[]).filter(row=>participantId(row));
  const activeParticipants=participants.filter(row=>!['NO','FALSE','0','INACTIVE'].includes(upper(first(row,['Active?','Active']))));
  const demo=activeParticipants.filter(row=>/^(DEMO|TEST|SAMPLE)(-|_|\b)/.test(upper(participantId(row)))||/(DEMO|TEST|SAMPLE)/.test(upper(first(row,['Notes']))));
  if(demo.length)add('DEMO_PARTICIPANT_ACTIVE','BLOCKED',`${demo.length} active demo/test participant record(s) remain in production.`,{participant_ids:demo.map(participantId)});
  for(const [field,getter,code] of [['email',participantEmail,'DUPLICATE_PARTICIPANT_EMAIL'],['team name',participantName,'DUPLICATE_TEAM_NAME']]){
    const seen=new Map();
    for(const row of activeParticipants){const value=getter(row);if(!value)continue;const prior=seen.get(value);if(prior)add(code,'BLOCKED',`Active participants ${participantId(prior)} and ${participantId(row)} share the same ${field}.`,{participant_ids:[participantId(prior),participantId(row)]});else seen.set(value,row);}
  }

  const players=(tables.Players||[]).filter(row=>playerId(row));
  const activePlayers=players.filter(playerActive);
  if(!activePlayers.length)add('NO_ACTIVE_ELIGIBLE_PLAYERS','BLOCKED','No active eligible PV players are available for lineup selection.');
  const seenPlayers=new Map();
  for(const row of activePlayers){const id=playerId(row);if(seenPlayers.has(id))add('DUPLICATE_PLAYER_ID','BLOCKED',`Active roster contains duplicate Player ID ${id}.`,{player_id:id});else seenPlayers.set(id,row);}
  const provisional=activePlayers.filter(row=>/PROVISIONAL|FALL_CAMP|PRESEASON/.test(upper(first(row,['Source Status','Roster Status','Provenance','Notes']))));
  if(activePlayers.length&&provisional.length===activePlayers.length)add('ROSTER_PROVISIONAL','HOLD','All active eligible players are still marked provisional/preseason.',{player_count:activePlayers.length});

  const blockers=diagnostics.filter(item=>item.severity==='BLOCKED');
  const holds=diagnostics.filter(item=>item.severity==='HOLD');
  return {
    status:blockers.length?'BLOCKED':holds.length?'HOLD':'READY',
    summary:{games:games.length,open_games:openGames.length,active_participants:activeParticipants.length,active_players:activePlayers.length,blockers:blockers.length,holds:holds.length},
    active_blockers:blockers.map(item=>item.code),
    diagnostics
  };
}
