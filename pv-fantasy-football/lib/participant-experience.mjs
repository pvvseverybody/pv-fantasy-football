export const LINEUP_SLOTS = ['RB','WR','TE','Offensive Flex','DL','LB','DB','Defensive Flex'];

export function centralKickoffEpoch(value) {
  const match=String(value||'').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if(!match)return null;
  const [,month,day,year,hour,minute,meridiem]=match;let hours=Number(hour)%12;if(meridiem.toUpperCase()==='PM')hours+=12;
  const wallClockUtc=Date.UTC(Number(year),Number(month)-1,Number(day),hours,Number(minute));
  try{
    const zoneName=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',timeZoneName:'shortOffset'}).formatToParts(new Date(wallClockUtc)).find(part=>part.type==='timeZoneName')?.value||'';
    const offset=zoneName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);if(!offset)return null;
    const minutes=(Number(offset[2])*60+Number(offset[3]||0))*(offset[1]==='-'?-1:1);
    return wallClockUtc-minutes*60000;
  }catch{return null;}
}

export function playerLabel(player) {
  return [player.display_name, player.position, player.jersey ? `#${player.jersey}` : ''].filter(Boolean).join(' • ');
}

export function validateLineupDraft(picks) {
  const missing = LINEUP_SLOTS.filter(slot => !picks?.[slot]);
  if (missing.length) return {valid:false, code:'INCOMPLETE_LINEUP', message:`Choose a player for ${missing.join(', ')}.`};
  if (new Set(LINEUP_SLOTS.map(slot => picks[slot])).size !== 8) return {valid:false, code:'DUPLICATE_PLAYER', message:'A player can only appear once in your lineup.'};
  return {valid:true};
}

export function submissionOutcome(response, httpOk=true) {
  if (httpOk && response?.accepted && response?.duplicate) return {state:'duplicate', title:'Lineup already saved', message:'This identical lineup is already your accepted scoring version.'};
  if (httpOk && response?.accepted && Number(response?.version) > 1) return {state:'updated', title:'Lineup updated', message:'Your new lineup is saved and replaces your previous version for this game.'};
  if (httpOk && response?.accepted) return {state:'success', title:'Lineup saved', message:'Your lineup is accepted for this game.'};
  const code = response?.code;
  if (code === 'PICKS_CLOSED' || code === 'LATE_SUBMISSION') return {state:'locked', title:'Lineup locked', message:response?.message || 'The lineup deadline has passed.'};
  if (code === 'UNAUTHENTICATED') return {state:'identity', title:'Secure sign-in required', message:'Sign in again before submitting your lineup.'};
  if (code === 'INVALID_IDENTITY' || code === 'IDENTITY_REVIEW_REQUIRED') return {state:'identity', title:'Participant not recognized', message:response?.message || 'This participant cannot submit a lineup.'};
  if (code === 'INVALID_LINEUP') {
    const duplicate = /cannot be used twice/i.test(response?.message || '');
    const ineligible = /not eligible/i.test(response?.message || '');
    return {state:duplicate?'duplicate-error':ineligible?'ineligible':'incomplete', title:duplicate?'Player selected twice':ineligible?'Player is not eligible':'Lineup incomplete', message:response?.message || 'Review all eight selections.'};
  }
  return {state:'failure', title:'Lineup not accepted', message:'We could not confirm authoritative acceptance. Your lineup has not been presented as saved; please retry.'};
}

export const isDemoRecord = row => /^DEMO-|^TEST-|^UNIT-/i.test(String(row?.['Participant ID'] || row?.['Game ID'] || '')) || /demo participant/i.test(String(row?.['Display Name'] || ''));

export function rowsToRecords(rows=[]) {
  if (!rows.length) return [];
  const [headers,...data] = rows;
  return data.filter(row => row.some(value => value !== '')).map(row => Object.fromEntries(headers.map((header,index)=>[header,row[index]??''])));
}

const number = value => Number(value || 0);
export function participantStatusLabel(game={}, releaseStatus='') {
  if (String(game['Stats Final?']).toUpperCase() === 'YES') return String(releaseStatus).toUpperCase() === 'PUBLISH' ? 'FINAL • OFFICIAL' : String(releaseStatus).toUpperCase()==='HOLD' ? 'FINAL • PUBLICATION HOLD' : 'FINAL • CERTIFICATION PENDING';
  return String(game['Pick Status']).toUpperCase() === 'OPEN' ? 'PREGAME' : 'LIVE • PROVISIONAL';
}

export function publicLeaderboard({weekly=[],leaderboard=[],games=[],releaseStatus=''}, week='') {
  const safeWeekly = weekly.filter(row => !isDemoRecord(row) && String(row.Validation || '').toUpperCase() === 'VALID');
  const selectedWeek = week || games.find(game => String(game['Pick Status']).toUpperCase() === 'OPEN')?.Week || games[0]?.Week || '';
  const selectedGame=games.find(game=>game.Week===selectedWeek)||{};
  const isPregame=String(selectedGame['Pick Status']).toUpperCase()==='OPEN';
  const hasCompletedHistory=games.some(game=>game.Week!==selectedWeek&&(String(game['Pick Status']).toUpperCase()==='LOCKED'||String(game['Stats Final?']).toUpperCase()==='YES'));
  const weeklyLeaders=isPregame?[]:safeWeekly.filter(row => !selectedWeek || row.Week === selectedWeek).sort((a,b)=>number(b['Fantasy Score'])-number(a['Fantasy Score'])).map((row,index)=>({rank:index+1, participant:row['Display Name'], points:number(row['Fantasy Score'])}));
  const cumulativeLeaders=leaderboard.filter(row=>!isDemoRecord(row)).sort((a,b)=>number(a.Rank)-number(b.Rank)).map(row=>({rank:number(row.Rank),participant:row['Display Name'],season_points:number(row.Total),average:number(row.Avg),best_week:String(row['Best Week']||'')}));
  const cumulative=isPregame&&!hasCompletedHistory?[]:cumulativeLeaders;
  return {week:selectedWeek,status_label:participantStatusLabel(selectedGame,releaseStatus),weekly:weeklyLeaders,cumulative};
}

export function publicPlayerDirectory({players=[],scores=[],games=[],releaseStatus=''}, week='', nowEpoch=Date.now()) {
  const timedGames=games
    .map(game=>({...game,kickoff_epoch:centralKickoffEpoch(game['Kickoff (CT)'])}))
    .filter(game=>game.kickoff_epoch!==null)
    .sort((a,b)=>a.kickoff_epoch-b.kickoff_epoch);

  const featuredByTime=timedGames.length
    ? [...timedGames].reverse().find(game=>nowEpoch>=game.kickoff_epoch-(48*60*60*1000))||timedGames[0]
    : null;

  const selectedWeek=week||featuredByTime?.Week||games.find(game=>String(game['Pick Status']).toUpperCase()==='OPEN')?.Week||games[0]?.Week||'';
  const selectedGame=games.find(game=>game.Week===selectedWeek)||{};
  const selectedGameId=selectedGame['Game ID']||'';
  const isPregame=String(selectedGame['Pick Status']).toUpperCase()==='OPEN';

  const completedGameIds=new Set(
    games
      .filter(game=>String(game['Pick Status']).toUpperCase()==='LOCKED'||String(game['Stats Final?']).toUpperCase()==='YES')
      .map(game=>game['Game ID'])
      .filter(Boolean)
  );

  const currentScores=new Map(
    scores
      .filter(row=>row['Game ID']===selectedGameId&&row['Player ID'])
      .map(row=>[row['Player ID'],number(row.TOTAL)])
  );

  const seasonTotals=new Map();
  const seasonPlayers=new Set();
  const scoreLookup=new Map();

  for(const row of scores){
    const playerId=row['Player ID'];
    const gameId=row['Game ID'];
    if(!playerId||!gameId)continue;

    scoreLookup.set(`${gameId}::${playerId}`,number(row.TOTAL));

    if(!completedGameIds.has(gameId))continue;
    seasonPlayers.add(playerId);
    seasonTotals.set(playerId,(seasonTotals.get(playerId)||0)+number(row.TOTAL));
  }

  return {
    week:selectedWeek,
    status_label:participantStatusLabel(selectedGame,releaseStatus),
    players:players.map(player=>{
      const playerId=player.player_key||player['Player ID']||'';
      const history=games
        .filter(game=>completedGameIds.has(game['Game ID']))
        .map(game=>{
          const gameId=game['Game ID']||'';
          const key=`${gameId}::${playerId}`;
          return {
            week:game.Week||'',
            points:scoreLookup.has(key)?scoreLookup.get(key):null
          };
        });

      return {
        ...player,
        week_points:isPregame||!currentScores.has(playerId)?null:currentScores.get(playerId),
        season_points:seasonPlayers.has(playerId)?seasonTotals.get(playerId):null,
        history
      };
    })
  };
}
export function participantResults({participants=[],active=[],picks=[],scores=[],weekly=[],games=[],players=[],publicSnapshots=[],releaseStatus=''}, email) {
  const normalized=String(email||'').trim().toLowerCase();
  const participant=participants.find(row=>!isDemoRecord(row)&&String(row.Active).toUpperCase()==='YES'&&String(row['Identity Status']).toUpperCase()==='VERIFIED'&&[row['Normalized Email'],row.Email].some(value=>String(value||'').trim().toLowerCase()===normalized));
  if(!participant)return null;
  const playerMap=new Map(players.map(row=>[row['Player ID'],row]));
  const scoreMap=new Map(scores.map(row=>[`${row['Game ID']}|${row['Player ID']}`,number(row.TOTAL)]));
  const gameMap=new Map(games.map(row=>[row['Game ID'],row]));
  const weekMap=new Map(weekly.filter(row=>row['Participant ID']===participant['Participant ID']&&String(row.Validation).toUpperCase()==='VALID').map(row=>[row['Game ID'],row]));
  const publishedMap=new Map(publicSnapshots.filter(row=>String(row.Participant||'').trim().toLowerCase()===String(participant['Display Name']||'').trim().toLowerCase()&&String(row.Status||'').trim().toUpperCase()==='FINAL • OFFICIAL').map(row=>[row['Game ID'],row]));
  const lineups=active.filter(row=>row['Participant ID']===participant['Participant ID']&&String(row['Accepted?']).toUpperCase()==='YES'&&String(row['Scoring Version?']).toUpperCase()==='YES'&&String(gameMap.get(row['Game ID'])?.['Pick Status']||'LOCKED').toUpperCase()!=='OPEN').map(lineup=>{
    const game=gameMap.get(lineup['Game ID'])||{};const submission=lineup['Active Submission ID'];
    const selected=picks.filter(row=>row['Submission ID']===submission&&String(row['Scoring Version?']).toUpperCase()==='YES'&&String(row['Submission State']).toUpperCase()==='ACCEPTED').map(row=>{const player=playerMap.get(row['Player ID'])||{};return{slot:row['Slot ID'],player_key:row['Player ID'],name:player['Player Name']||row['Player Name']||'',position:player.Position||'',jersey:player.Jersey||'',points:scoreMap.get(`${lineup['Game ID']}|${row['Player ID']}`)??number(row['Fantasy Points'])};});
    const published=publishedMap.get(lineup['Game ID']);
    return{game_id:lineup['Game ID'],week:lineup.Week,opponent:game.Opponent||'',kickoff_ct:game['Kickoff (CT)']||'',status_label:published?.Status||participantStatusLabel(game,releaseStatus),score:number(published?.['Week Points']??weekMap.get(lineup['Game ID'])?.['Fantasy Score']??lineup['Fantasy Score']),players:selected};
  }).sort((a,b)=>String(b.week).localeCompare(String(a.week),undefined,{numeric:true}));
  return{display_name:participant['Display Name'],lineups};
}
