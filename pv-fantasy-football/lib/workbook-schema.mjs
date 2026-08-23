export const WORKBOOK_SCHEMAS=Object.freeze({
  Games:['Week','Game ID','Kickoff (CT)','Opponent','Site','Location','Pick Status','Stats Final?'],
  Players:['Player ID','Player Name','Position','Jersey','Active'],
  Participants:['Participant ID','Display Name','Email','Active','Joined','Notes','Normalized Email','Alternate Email(s)','Identity Status','Duplicate Flag','Canonical Participant ID'],
  ParticipantSession:['Session ID','Participant ID','Display Name','Normalized Email','Created At','Last Seen At','Device Token Hash','Status','Current Game','Lineup State','Notes'],
  'Lineup Submissions':['Submission ID','Submitted At','Email','Game ID','RB','WR','TE','Offensive Flex','DL','LB','DB','Defensive Flex'],
  SubmissionHistory:['Submission ID','Game ID','Participant ID','Version','Submitted CT','Status','Supersedes','Superseded By','Scoring Version?','Lineup ID','Pick Count','Valid Picks','On Time?','Validation Message','Writer Result','Notes'],
  Picks:['Pick ID','Game ID','Week','Participant ID','Slot ID','Player ID','Player Name','Submitted At','Locked?','Valid?','Fantasy Points','Submission ID','Version','Scoring Version?','Submission State'],
  Lineups:['Lineup ID','Game ID','Week','Participant ID','Display Name','Submitted At','Kickoff (CT)','Pick Rows','Valid Picks','Unique Slots','Unique Players','Complete?','On Time?','Accepted?','Lock Status','Fantasy Score','Validation Message','Commissioner Notes','Submission ID','Version','Scoring Version?'],
  ActiveLineups:['Game ID','Week','Participant ID','Display Name','Active Submission ID','Version','Submitted CT','Kickoff CT','Accepted?','Scoring Version?','Pick Count','Fantasy Score','State','Audit Note'],
  GameStats:['Game ID','Week','Player ID','Player Name','Rush Yds','Rush TD','Receptions','Rec Yds','Rec TD','Pass INT','Fumbles Lost','Tackles','TFL','TFL Yds','Sacks','Sack Yds','QBH','PBU','Def INT','INT Return Yds','Forced Fumble','Fumble Recovery','Def Return TD','Source URL','Imported At','Final?'],
  PlayerScores:['Game ID','Week','Player ID','Player Name','Rush Pts','Rush TD Pts','Rec Pts','Rec Yd Pts','Rec TD Pts','Pass INT Pts','Fum Lost Pts','Tackle Pts','TFL Pts','Sack Pts','QBH Pts','PBU Pts','Def INT Pts','FF Pts','FR Pts','Def Return TD Pts','Neg/Return Yd Pts','TOTAL'],
  WeeklyScores:['Game ID','Week','Participant ID','Display Name','Fantasy Score','Weekly Rank','Pick Count','Validation'],
  Leaderboard:['Rank','Participant ID','Display Name','Total','Avg','Best Week'],
  Reconciliation:['Game ID','Feed Final?','Official Final?','Stat Differences','Unmatched Names','QA Open Critical','Reconciliation Status','Lock Status'],
  PublishControl:['Control','Status'],
});

export const STRICT_ORDER_SHEETS=new Set(['Participants','ParticipantSession','Lineup Submissions','SubmissionHistory','Picks','Lineups','ActiveLineups','GameStats','PlayerScores']);

export function validateSheetHeaders(sheet,actual=[]){
  const expected=WORKBOOK_SCHEMAS[sheet];
  if(!expected)return{sheet,status:'INVALID_CONFIGURATION',issues:[{code:'UNKNOWN_SCHEMA',message:`No expected schema is defined for ${sheet}.`}]};
  const headers=actual.map(value=>String(value??'').trim());
  const nonblank=headers.filter(Boolean);const duplicates=[...new Set(nonblank.filter((value,index)=>nonblank.indexOf(value)!==index))];
  const missing=expected.filter(header=>!headers.includes(header));
  const renamedOrMoved=STRICT_ORDER_SHEETS.has(sheet)?expected.filter((header,index)=>headers[index]!==header):[];
  const issues=[];
  if(!nonblank.length)issues.push({code:'MISSING_HEADER_ROW',message:`${sheet} row 3 is empty or unavailable.`});
  if(duplicates.length)issues.push({code:'DUPLICATE_HEADERS',message:`${sheet} contains duplicate header names.`,headers:duplicates});
  if(missing.length)issues.push({code:'MISSING_HEADERS',message:`${sheet} is missing required headers.`,headers:missing});
  if(renamedOrMoved.length)issues.push({code:'INCOMPATIBLE_HEADER_ORDER',message:`${sheet} write columns do not match the certified order.`,headers:renamedOrMoved});
  return{sheet,status:issues.length?'INCOMPATIBLE':'COMPATIBLE',issues};
}

export function validateWorkbookSchemas(headersBySheet={}){
  const sheets=Object.keys(WORKBOOK_SCHEMAS).map(sheet=>validateSheetHeaders(sheet,headersBySheet[sheet]||[]));
  return{status:sheets.every(sheet=>sheet.status==='COMPATIBLE')?'COMPATIBLE':'INCOMPATIBLE',sheets};
}
