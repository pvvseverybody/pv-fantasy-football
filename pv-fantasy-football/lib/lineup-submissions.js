import {createHash} from 'node:crypto';
import {appendSheetRow, readSheetRange} from './google-sheets';

export const LINEUP_SLOTS = [
  'RB',
  'WR',
  'TE',
  'Offensive Flex',
  'DL',
  'LB',
  'DB',
  'Defensive Flex',
];

export const SUBMISSION_HEADERS = [
  'Submission ID',
  'Submitted At',
  'Email',
  'Game ID',
  ...LINEUP_SLOTS,
];

const DEFAULT_SHEET = 'Lineup Submissions';
const writerGates = new Map();

function sheetName() {
  return String(process.env.LINEUP_SUBMISSIONS_SHEET || DEFAULT_SHEET).trim();
}

function quoteSheet(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

function submissionId(email, gameId, picks) {
  const canonical = [email, gameId, ...LINEUP_SLOTS.map(slot => picks[slot])].join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}

function assertSchema(rows) {
  if (!rows.length) {
    throw new Error(
      `Missing lineup submission headers. Add the required headers to ${sheetName()} row 3.`
    );
  }

  const header = rows[0];
  const mismatch = SUBMISSION_HEADERS.findIndex((name, index) => header[index] !== name);
  if (mismatch !== -1) {
    throw new Error(
      `Invalid lineup submission schema at column ${mismatch + 1}: expected "${SUBMISSION_HEADERS[mismatch]}".`
    );
  }
}

async function withWriterGate(key, work) {
  const previous = writerGates.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => {
    release = resolve;
  });
  writerGates.set(key, current);

  await previous;
  try {
    return await work();
  } finally {
    release();
    if (writerGates.get(key) === current) writerGates.delete(key);
  }
}

export async function saveLineupSubmission({email, gameId, picks, submittedAt = new Date()}) {
  const id = submissionId(email, gameId, picks);

  return withWriterGate(id, async () => {
    const sheet = quoteSheet(sheetName());
    const rows = await readSheetRange(`${sheet}!A3:L`);
    assertSchema(rows);

    const existing = rows.slice(1).find(row => String(row[0] || '').trim() === id);
    if (existing) return {submissionId: id, duplicate: true, submittedAt: String(existing[1] || '')};

    const row = [
      id,
      submittedAt.toISOString(),
      email,
      gameId,
      ...LINEUP_SLOTS.map(slot => picks[slot]),
    ];
    const result = await appendSheetRow(`${sheet}!A:L`, row);

    return {
      submissionId: id,
      duplicate: false,
      submittedAt: submittedAt.toISOString(),
      updatedRange: result.updates?.updatedRange || null,
    };
  });
}
