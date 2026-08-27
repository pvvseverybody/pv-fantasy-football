import {appendFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  inspectSidearmPayload,
  fetchSidearmSnapshot,
} from '../lib/sidearm-transport.mjs';

import {
  monitorLiveTransport,
} from '../lib/live-transport-monitor.mjs';

export const SIDEARM_ENDPOINT =
  'https://sidearmstats.com/delawarestate/football/game.json?detail=full';

export const SIDEARM_KICKOFF = '2026-08-27T22:00:00.000Z';
export const LIVE_INTERVAL_MS = 15000;
export const LIVE_LEAD_MS = 30 * 60 * 1000;
export const LIVE_MAX_DURATION_MS = 9 * 60 * 60 * 1000;

const EXPECTED_HOME = 'Delaware State';
const EXPECTED_VISITOR = 'Stony Brook';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchLiveSidearm() {
  const result = await fetchSidearmSnapshot(SIDEARM_ENDPOINT);
  return result.payload;
}

export function inspectSidearmLiveState(payload) {
  const game = inspectSidearmPayload(payload);

  if (
    game.homeTeam !== EXPECTED_HOME ||
    game.visitingTeam !== EXPECTED_VISITOR
  ) {
    throw new Error(
      `SIDEARM game identity mismatch: ${game.visitingTeam} at ${game.homeTeam}`
    );
  }

  return {
    eventId: game.ncaaGameId || game.clientId || '',
    state: game.isComplete
      ? 'post'
      : game.hasStarted
        ? 'in'
        : 'pre',
    completed: game.isComplete,
    detail: game.isComplete
      ? 'FINAL'
      : game.hasStarted
        ? 'LIVE'
        : 'PREGAME',
    period: game.period,
    clockSeconds: game.clockSeconds,
    playerCount: game.playerCount,
    playCount: game.playCount,
  };
}

async function lastJsonLine(path) {
  try {
    const lines = (await readFile(path, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    return lines.length ? JSON.parse(lines.at(-1)) : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function waitForStart(
  startAt,
  {
    nowMs = () => Date.now(),
    wait = sleep,
    onTick = () => {},
  } = {}
) {
  while (nowMs() < startAt) {
    const remaining = startAt - nowMs();
    onTick(remaining);
    await wait(Math.min(remaining, 60000));
  }
}

function renderReport(result) {
  const events = result.evidence || [];

  const changed = events.filter(
    item => item.type === 'CHANGED_SNAPSHOT'
  ).length;

  const corrections = events.filter(
    item => item.type === 'NUMERIC_REDUCTION'
  ).length;

  const failures = events.filter(
    item => item.type === 'REQUEST_FAILURE'
  ).length;

  const recoveries = events.filter(
    item => item.type === 'RECOVERED'
  ).length;

  const finals = events.filter(
    item => item.type === 'FINAL_VERIFICATION'
  ).length;

  return [
    '# PV Fantasy Football — SIDEARM Live Window Certification',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Endpoint: ${result.endpoint}`,
    `Event: ${EXPECTED_VISITOR} at ${EXPECTED_HOME}`,
    `Kickoff: ${SIDEARM_KICKOFF}`,
    `Polling interval: ${LIVE_INTERVAL_MS / 1000} seconds`,
    '',
    `Runner stopped: **${result.stopped}**`,
    '',
    '## Evidence summary',
    '',
    `- Changed snapshots preserved: ${changed}`,
    `- Numeric reductions/corrections observed: ${corrections}`,
    `- Request failures: ${failures}`,
    `- Recoveries: ${recoveries}`,
    `- Final verification observations: ${finals}`,
    '',
    `- Raw snapshot evidence: ${result.rawPath}`,
    `- Event evidence: ${result.evidencePath}`,
    '',
    result.stopped === 'FINAL_VERIFIED'
      ? '**LIVE WINDOW RESULT: PASS — repeated final state verified.**'
      : '**LIVE WINDOW RESULT: INCOMPLETE — review evidence before certification.**',
    '',
    'This runner is read-only. It does not write GameStats or any production workbook table.',
    '',
  ].join('\n');
}

export async function runSidearmLiveWindow({
  nowMs = () => Date.now(),
  wait = sleep,
} = {}) {
  const root = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..'
  );

  const evidenceDir = resolve(root, 'reports', 'evidence');
  await mkdir(evidenceDir, {recursive: true});

  const prefix = 'sidearm-delawarestate-stonybrook-20260827-live';

  const rawPath = resolve(
    evidenceDir,
    `${prefix}-raw.jsonl`
  );

  const evidencePath = resolve(
    evidenceDir,
    `${prefix}-events.jsonl`
  );

  const reportPath = resolve(
    root,
    'reports',
    'sidearm-live-window-certification.md'
  );

  const startAt =
    Date.parse(SIDEARM_KICKOFF) - LIVE_LEAD_MS;

  await waitForStart(startAt, {
    nowMs,
    wait,
    onTick: remaining =>
      process.stdout.write(
        `Waiting for SIDEARM live-window start: ${Math.ceil(
          remaining / 60000
        )} minutes remaining.\n`
      ),
  });

  const previousRaw = await lastJsonLine(rawPath);
  const initialSnapshot = previousRaw?.payload || null;

  let result;

  try {
    result = await monitorLiveTransport({
      fetchSnapshot: fetchLiveSidearm,
      inspectState: inspectSidearmLiveState,
      intervalMs: LIVE_INTERVAL_MS,
      maxSamples: 2160,
      finalVerificationSamples: 3,
      retryDelaysMs: [1000, 2000, 5000, 10000],
      maxConsecutiveFailedSamples: 20,
      maxDurationMs: LIVE_MAX_DURATION_MS,
      initialSnapshot,

      onEvidence: item =>
        appendFile(
          evidencePath,
          JSON.stringify(item) + '\n',
          'utf8'
        ),

      onRawSnapshot: item =>
        appendFile(
          rawPath,
          JSON.stringify(item) + '\n',
          'utf8'
        ),
    });
  } catch (error) {
    const failed = {
      timestamp: new Date().toISOString(),
      type: 'RUNNER_FATAL',
      message: error.message,
    };

    await appendFile(
      evidencePath,
      JSON.stringify(failed) + '\n',
      'utf8'
    );

    result = {
      evidence: [failed],
      stopped: 'RUNNER_FATAL',
      rawSnapshotCount: 0,
    };
  }

  const historicalEvidence = [];

  try {
    for (
      const line of (await readFile(evidencePath, 'utf8'))
        .split(/\r?\n/)
        .filter(Boolean)
    ) {
      historicalEvidence.push(JSON.parse(line));
    }
  } catch {}

  const complete = {
    ...result,
    evidence: historicalEvidence,
    endpoint: SIDEARM_ENDPOINT,
    rawPath,
    evidencePath,
    kickoff: SIDEARM_KICKOFF,
    intervalMs: LIVE_INTERVAL_MS,
  };

  await writeFile(
    reportPath,
    renderReport(complete),
    'utf8'
  );

  return {
    ...complete,
    reportPath,
  };
}

async function main() {
  const result = await runSidearmLiveWindow();

  process.stdout.write(
    `SIDEARM live-window runner stopped: ${result.stopped}\n`
  );

  process.stdout.write(
    `Report: ${result.reportPath}\n`
  );

  process.exitCode =
    result.stopped === 'FINAL_VERIFIED' ? 0 : 2;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
