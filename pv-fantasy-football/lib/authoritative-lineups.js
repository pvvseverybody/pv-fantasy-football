import {
  batchUpdateSpreadsheet,
  getSpreadsheetMetadata,
  readSheetRange,
} from './google-sheets';
import {LINEUP_SLOTS} from './lineup-submissions';
import {dateToSheetsSerial} from './lineup-deadline.mjs';
export {dateToSheetsSerial} from './lineup-deadline.mjs';

const AUTHORITATIVE_SCHEMAS = {
  Participants: [
    'Participant ID', 'Display Name', 'Email', 'Active', 'Joined', 'Notes',
    'Normalized Email', 'Alternate Email(s)', 'Identity Status', 'Duplicate Flag',
    'Canonical Participant ID',
  ],
  Picks: [
    'Pick ID', 'Game ID', 'Week', 'Participant ID', 'Slot ID', 'Player ID',
    'Player Name', 'Submitted At', 'Locked?', 'Valid?', 'Fantasy Points',
    'Submission ID', 'Version', 'Scoring Version?', 'Submission State',
  ],
  Lineups: [
    'Lineup ID', 'Game ID', 'Week', 'Participant ID', 'Display Name',
    'Submitted At', 'Kickoff (CT)', 'Pick Rows', 'Valid Picks', 'Unique Slots',
    'Unique Players', 'Complete?', 'On Time?', 'Accepted?', 'Lock Status',
    'Fantasy Score', 'Validation Message', 'Commissioner Notes', 'Submission ID',
    'Version', 'Scoring Version?',
  ],
  SubmissionHistory: [
    'Submission ID', 'Game ID', 'Participant ID', 'Version', 'Submitted CT',
    'Status', 'Supersedes', 'Superseded By', 'Scoring Version?', 'Lineup ID',
    'Pick Count', 'Valid Picks', 'On Time?', 'Validation Message', 'Writer Result',
    'Notes',
  ],
  ActiveLineups: [
    'Game ID', 'Week', 'Participant ID', 'Display Name', 'Active Submission ID',
    'Version', 'Submitted CT', 'Kickoff CT', 'Accepted?', 'Scoring Version?',
    'Pick Count', 'Fantasy Score', 'State', 'Audit Note',
  ],
};

const SLOT_IDS = {
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  'Offensive Flex': 'OFF_FLEX',
  DL: 'DL',
  LB: 'LB',
  DB: 'DB',
  'Defensive Flex': 'DEF_FLEX',
};

const writerGates = new Map();

function columnName(index) {
  let name = '';
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

function assertSchema(sheet, rows) {
  const expected = AUTHORITATIVE_SCHEMAS[sheet];
  const header = rows[0] || [];
  const mismatch = expected.findIndex((name, index) => header[index] !== name);
  if (mismatch !== -1) {
    throw new Error(
      `${sheet} schema mismatch at ${columnName(mismatch)}3: expected "${expected[mismatch]}".`
    );
  }
}

function firstBlankRow(rows, keyIndex = 0, count = 1) {
  const data = rows.slice(1);
  const index = data.findIndex((row, start) => {
    for (let offset = 0; offset < count; offset += 1) {
      if (String(data[start + offset]?.[keyIndex] || '').trim()) return false;
    }
    return true;
  });
  if (index === -1) throw new Error('Authoritative sheet has no available row.');
  return index + 4;
}

function valueData(value) {
  if (typeof value === 'number') return {userEnteredValue: {numberValue: value}};
  if (typeof value === 'boolean') return {userEnteredValue: {boolValue: value}};
  if (value === null || value === undefined || value === '') return {userEnteredValue: {stringValue: ''}};
  if (String(value).startsWith('=')) return {userEnteredValue: {formulaValue: String(value)}};
  return {userEnteredValue: {stringValue: String(value)}};
}

function updateRow(sheetId, rowNumber, values) {
  return {
    updateCells: {
      range: {
        sheetId,
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: 0,
        endColumnIndex: values.length,
      },
      rows: [{values: values.map(valueData)}],
      fields: 'userEnteredValue',
    },
  };
}

function updateCell(sheetId, rowNumber, columnIndex, value) {
  return {
    updateCells: {
      range: {
        sheetId,
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: columnIndex,
        endColumnIndex: columnIndex + 1,
      },
      rows: [{values: [valueData(value)]}],
      fields: 'userEnteredValue',
    },
  };
}

async function withWriterGate(key, work) {
  const previous = writerGates.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  writerGates.set(key, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (writerGates.get(key) === current) writerGates.delete(key);
  }
}

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveParticipant(rows, email) {
  const matches = rows.slice(1).filter(row => normalizedEmail(row[6]) === email);
  if (matches.length !== 1) {
    const error = new Error(matches.length ? 'Participant email is not unique.' : 'Participant is not registered.');
    error.code = matches.length ? 'IDENTITY_REVIEW_REQUIRED' : 'INVALID_IDENTITY';
    throw error;
  }
  const row = matches[0];
  const canonicalId = String(row[10] || row[0] || '').trim();
  if (!canonicalId || String(row[3] || '').toUpperCase() !== 'YES' || String(row[8] || '').toUpperCase() !== 'VERIFIED') {
    const error = new Error('Participant identity is not active and verified.');
    error.code = 'IDENTITY_REVIEW_REQUIRED';
    throw error;
  }
  return {id: canonicalId, displayName: String(row[1] || '').trim()};
}

function existingResult(historyRows, submissionId) {
  const row = historyRows.slice(1).find(item => String(item[0] || '') === submissionId);
  if (!row) return null;
  if (String(row[5] || '') !== 'ACCEPTED' || String(row[8] || '') !== 'YES') {
    const error = new Error('The submission exists but is not the active accepted version.');
    error.code = 'AUTHORITATIVE_STATE_CONFLICT';
    throw error;
  }
  return {participantId: String(row[2]), version: Number(row[3]), duplicate: true};
}

function findProjection(rows, gameId, participantId) {
  const index = rows.slice(1).findIndex(row => String(row[1]) === gameId && String(row[3]) === participantId);
  return index === -1 ? {rowNumber:firstBlankRow(rows), row:[]} : {rowNumber:index + 4, row:rows[index + 1]};
}

function findActiveRow(rows, gameId, participantId) {
  const index = rows.slice(1).findIndex(row => String(row[0]) === gameId && String(row[2]) === participantId);
  return index === -1 ? firstBlankRow(rows) : index + 4;
}

async function readAuthoritativeState() {
  const entries = await Promise.all(Object.entries(AUTHORITATIVE_SCHEMAS).map(async ([sheet, headers]) => {
    const rows = await readSheetRange(`'${sheet}'!A3:${columnName(headers.length - 1)}1000`);
    assertSchema(sheet, rows);
    return [sheet, rows];
  }));
  return Object.fromEntries(entries);
}

function sheetIds(metadata) {
  const ids = Object.fromEntries((metadata.sheets || []).map(sheet => [sheet.properties.title, sheet.properties.sheetId]));
  for (const name of Object.keys(AUTHORITATIVE_SCHEMAS)) {
    if (!Number.isInteger(ids[name])) throw new Error(`Missing authoritative sheet: ${name}.`);
  }
  return ids;
}

function pickFormulaRow(row, {gameId, week, participantId, slotId, playerId, submittedSerial, submissionId, version}) {
  return [
    `${submissionId}-${slotId}`, gameId, week, participantId, slotId, playerId,
    `=IF(F${row}="","",IFERROR(VLOOKUP(F${row},Players!$A$4:$B$1000,2,FALSE),""))`,
    submittedSerial,
    `=IF(OR(B${row}="",H${row}=""),"NO",IF(H${row}>=IFERROR(VLOOKUP(B${row},Games!$B$4:$C$1000,2,FALSE),9^9),"YES","NO"))`,
    `=IF(OR(B${row}="",D${row}="",E${row}="",F${row}="",L${row}=""),"NO",IF(AND(I${row}="NO",IFERROR(VLOOKUP(B${row},Games!$B$4:$J$1000,9,FALSE),"CLOSED")="OPEN",IFERROR(VLOOKUP(F${row},Players!$A$4:$E$1000,5,FALSE),"NO")="YES",IFERROR(VLOOKUP(D${row},Participants!$A$4:$D$1000,4,FALSE),"NO")="YES",COUNTIFS($L$4:$L$1000,L${row},$F$4:$F$1000,F${row})=1,COUNTIFS($L$4:$L$1000,L${row},$E$4:$E$1000,E${row})=1,IFERROR(REGEXMATCH(","&VLOOKUP(E${row},Categories!$A$4:$D$20,4,FALSE)&",",","&VLOOKUP(F${row},Players!$A$4:$C$1000,3,FALSE)&","),FALSE)),"YES","NO"))`,
    `=IF(OR(J${row}<>"YES",N${row}<>"YES"),0,IFERROR(SUMIFS(PlayerScores!$V$4:$V$1000,PlayerScores!$A$4:$A$1000,B${row},PlayerScores!$C$4:$C$1000,F${row}),0))`,
    submissionId, version, 'YES', 'ACCEPTED',
  ];
}

function lineupProjectionRow(row, data) {
  const {lineupId, gameId, week, participantId, displayName, submittedSerial, kickoffSerial, submissionId, version, commissionerNotes} = data;
  return [
    lineupId, gameId, week, participantId, displayName, submittedSerial, kickoffSerial,
    `=COUNTIF(Picks!$L$4:$L$1000,S${row})`,
    `=COUNTIFS(Picks!$L$4:$L$1000,S${row},Picks!$J$4:$J$1000,"YES")`,
    `=IF(S${row}="",0,COUNTUNIQUE(FILTER(Picks!$E$4:$E$1000,Picks!$L$4:$L$1000=S${row})))`,
    `=IF(S${row}="",0,COUNTUNIQUE(FILTER(Picks!$F$4:$F$1000,Picks!$L$4:$L$1000=S${row})))`,
    `=IF(AND(H${row}=8,I${row}=8,J${row}=8,K${row}=8),"YES","NO")`,
    `=IF(AND(F${row}<>"",G${row}<>"",F${row}<G${row}),"YES","NO")`,
    `=IF(AND(L${row}="YES",M${row}="YES",IFERROR(VLOOKUP(D${row},Participants!$A$4:$D$1000,4,FALSE),"NO")="YES"),"YES","NO")`,
    `=IF(N${row}="YES","LOCKED","REJECTED")`,
    `=IF(N${row}<>"YES",0,SUMIFS(Picks!$K$4:$K$1000,Picks!$L$4:$L$1000,S${row},Picks!$J$4:$J$1000,"YES"))`,
    `=IF(N${row}="YES","ACCEPTED — ACTIVE VERSION V"&T${row},IF(M${row}<>"YES","REJECTED — LATE SUBMISSION","REJECTED — LINEUP INCOMPLETE OR INVALID"))`,
    commissionerNotes, submissionId, version, 'YES',
  ];
}

async function verifyCommit({submissionId, gameId, participantId}) {
  const [history, picks, lineups, active] = await Promise.all([
    readSheetRange("'SubmissionHistory'!A3:P1000"),
    readSheetRange("'Picks'!A3:O1000"),
    readSheetRange("'Lineups'!A3:U1000"),
    readSheetRange("'ActiveLineups'!A3:N1000"),
  ]);
  const historyRows = history.slice(1).filter(row => row[0] === submissionId && row[5] === 'ACCEPTED' && row[8] === 'YES');
  const pickRows = picks.slice(1).filter(row => row[11] === submissionId && row[13] === 'YES' && row[14] === 'ACCEPTED');
  const projections = lineups.slice(1).filter(row => row[1] === gameId && row[3] === participantId && row[18] === submissionId && row[20] === 'YES');
  const activeRows = active.slice(1).filter(row => row[0] === gameId && row[2] === participantId && row[4] === submissionId && row[9] === 'YES');
  const scoringHistory = history.slice(1).filter(row => row[1] === gameId && row[2] === participantId && row[8] === 'YES');
  if (historyRows.length !== 1 || pickRows.length !== 8 || !pickRows.every(row => row[9] === 'YES') || new Set(pickRows.map(row => row[4])).size !== 8 || projections.length !== 1 || projections[0][13] !== 'YES' || activeRows.length !== 1 || activeRows[0][8] !== 'YES' || scoringHistory.length !== 1) {
    const error = new Error('Post-write authoritative invariant verification failed.');
    error.code = 'AUTHORITATIVE_VERIFY_FAILED';
    throw error;
  }
}

export async function promoteLineupSubmission({submissionId, email, gameId, week, kickoffSerial, picks, submittedAt}) {
  return withWriterGate(`${gameId}\n${email}`, async () => {
    const [state, metadata] = await Promise.all([readAuthoritativeState(), getSpreadsheetMetadata()]);
    const ids = sheetIds(metadata);
    const participant = resolveParticipant(state.Participants, email);
    const duplicate = existingResult(state.SubmissionHistory, submissionId);
    if (duplicate) {
      await verifyCommit({submissionId, gameId, participantId: participant.id});
      return duplicate;
    }

    const submittedSerial = dateToSheetsSerial(submittedAt);
    if (!Number.isFinite(kickoffSerial) || submittedSerial >= kickoffSerial) {
      const error = new Error('The submission cutoff has passed.');
      error.code = 'LATE_SUBMISSION';
      throw error;
    }

    const priorHistory = state.SubmissionHistory.slice(1)
      .map((row, index) => ({row, rowNumber: index + 4}))
      .filter(item => item.row[1] === gameId && item.row[2] === participant.id);
    const priorActive = priorHistory.find(item => item.row[8] === 'YES');
    if (priorHistory.filter(item => item.row[8] === 'YES').length > 1) {
      const error = new Error('Multiple active scoring versions already exist.');
      error.code = 'AUTHORITATIVE_STATE_CONFLICT';
      throw error;
    }
    const version = Math.max(0, ...priorHistory.map(item => Number(item.row[3]) || 0)) + 1;
    const lineupId = `${gameId}-${participant.id}`;
    const historyRow = firstBlankRow(state.SubmissionHistory);
    const firstPickRow = firstBlankRow(state.Picks, 0, LINEUP_SLOTS.length);
    const lineupProjection = findProjection(state.Lineups, gameId, participant.id);
    const lineupRow = lineupProjection.rowNumber;
    const activeRow = findActiveRow(state.ActiveLineups, gameId, participant.id);
    if (firstPickRow + LINEUP_SLOTS.length - 1 > 1000) throw new Error('Picks sheet has insufficient capacity.');

    const requests = [];
    if (priorActive) {
      requests.push(updateCell(ids.SubmissionHistory, priorActive.rowNumber, 5, 'SUPERSEDED'));
      requests.push(updateCell(ids.SubmissionHistory, priorActive.rowNumber, 7, submissionId));
      requests.push(updateCell(ids.SubmissionHistory, priorActive.rowNumber, 8, 'NO'));
      state.Picks.slice(1).forEach((row, index) => {
        if (row[11] === priorActive.row[0] && row[13] === 'YES') {
          requests.push(updateCell(ids.Picks, index + 4, 13, 'NO'));
          requests.push(updateCell(ids.Picks, index + 4, 14, 'SUPERSEDED'));
        }
      });
    }

    requests.push(updateRow(ids.SubmissionHistory, historyRow, [
      submissionId, gameId, participant.id, version, submittedSerial, 'ACCEPTED',
      priorActive?.row[0] || '', '', 'YES', lineupId, 8, 8, 'YES',
      `ACCEPTED — active scoring version V${version}`, 'ACCEPTED',
      'Promoted from Lineup Submissions raw ledger.',
    ]));

    LINEUP_SLOTS.forEach((slot, index) => {
      const row = firstPickRow + index;
      requests.push(updateRow(ids.Picks, row, pickFormulaRow(row, {
        gameId, week, participantId: participant.id, slotId: SLOT_IDS[slot],
        playerId: picks[slot], submittedSerial, submissionId, version,
      })));
    });

    const projection = {lineupId, gameId, week, participantId: participant.id, displayName: participant.displayName, submittedSerial, kickoffSerial, submissionId, version, commissionerNotes:lineupProjection.row[17] || ''};
    requests.push(updateRow(ids.Lineups, lineupRow, lineupProjectionRow(lineupRow, projection)));
    requests.push(updateRow(ids.ActiveLineups, activeRow, [
      gameId, week, participant.id, participant.displayName, submissionId, version,
      submittedSerial, kickoffSerial, 'YES', 'YES', 8,
      `=SUMIFS(Picks!$K$4:$K$1000,Picks!$L$4:$L$1000,E${activeRow},Picks!$J$4:$J$1000,"YES")`,
      'LOCKED FOR SCORING', `Active version V${version}; source ledger ${submissionId}.`,
    ]));

    await batchUpdateSpreadsheet(requests);
    await verifyCommit({submissionId, gameId, participantId: participant.id});
    return {participantId: participant.id, version, duplicate: false};
  });
}
