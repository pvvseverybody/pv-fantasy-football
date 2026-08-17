import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchSidearmSnapshot} from '../lib/sidearm-transport.mjs';

export const L2_ENDPOINT = 'https://sidearmstats.com/delawarestate/football/game.json?detail=full';

function check(label, pass, detail) {
  return {label, pass:Boolean(pass), detail};
}

export async function runL2TransportCertification({endpoint=L2_ENDPOINT, fetchImpl=fetch} = {}) {
  const snapshot = await fetchSidearmSnapshot(endpoint, {fetchImpl});
  const game = snapshot.inspection;
  const checks = [
    check('Official structured endpoint responds with JSON', true, snapshot.contentType),
    check('Cross-origin server reads are supported', snapshot.cors === '*', snapshot.cors || 'header missing'),
    check('Snapshot supplies a cache validator', Boolean(snapshot.etag), snapshot.etag || 'ETag missing'),
    check('Payload is a football game', game.type === 'FootballGame', game.type),
    check('L2 opponent identity matches', game.homeTeam === 'Delaware State' && game.visitingTeam === 'Stony Brook', `${game.visitingTeam} at ${game.homeTeam}`),
    check('Required football stat groups are present', game.missingGroups.length === 0, game.missingGroups.length ? game.missingGroups.join(', ') : `${game.requiredGroups}/${game.requiredGroups}`),
    check('Pregame state is not treated as final', !game.hasStarted && !game.isComplete, `started=${game.hasStarted}; complete=${game.isComplete}`),
  ];
  const preflightPass = checks.every(item => item.pass);
  return {
    level:'L2',
    phase:'PREFLIGHT',
    status:preflightPass ? 'READY FOR LIVE WINDOW' : 'BLOCKED',
    preflightPass,
    fullL2Pass:false,
    snapshot:{...snapshot, payload:undefined},
    checks,
    pending:[
      'Changing live snapshots at the 15-second cadence',
      'Correction/replacement behavior',
      'Final-state detection',
      'Official final-stat reconciliation',
      'Polling shutdown after final',
    ],
  };
}

export function renderL2Report(result) {
  const s = result.snapshot;
  return [
    '# PV Fantasy Football — L2 Live-provider Transport Certification', '',
    `Generated: ${s.fetchedAt}`, '',
    `Status: **${result.status}**`, '',
    'Full L2 result: **PENDING LIVE EVENT**', '',
    'This is a read-only preflight against the official public provider. It did not write to Google Sheets, GameStats, or any authoritative production table.', '',
    '## Discovered transport', '',
    `- Endpoint: ${s.endpoint}`,
    `- Content type: ${s.contentType}`,
    `- CORS: ${s.cors || 'missing'}`,
    `- ETag: ${s.etag || 'missing'}`,
    `- SHA-256 snapshot hash: ${s.hash}`,
    `- Event: ${s.inspection.visitingTeam} at ${s.inspection.homeTeam}`,
    `- Provider source: ${s.inspection.source}`,
    `- NCAA game ID: ${s.inspection.ncaaGameId}`,
    `- State: started=${s.inspection.hasStarted}; complete=${s.inspection.isComplete}`,
    `- Players/plays currently populated: ${s.inspection.playerCount}/${s.inspection.playCount}`, '',
    '## Preflight checks', '',
    '| Check | Result | Evidence |', '|---|---|---|',
    ...result.checks.map(item => `| ${item.label} | ${item.pass ? 'PASS' : 'FAIL'} | ${String(item.detail).replaceAll('|','\\|')} |`), '',
    '## Required during the live window', '',
    ...result.pending.map(item => `- ${item}`), '',
    'A preflight PASS must not be promoted to full L2 PASS until every live-window item above has direct evidence.', '',
  ].join('\n');
}

async function main() {
  const result = await runL2TransportCertification();
  const reportPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'l2-transport-certification.md');
  await mkdir(dirname(reportPath), {recursive:true});
  await writeFile(reportPath, renderL2Report(result), 'utf8');
  process.stdout.write(`L2 transport preflight: ${result.status}\nReport: ${reportPath}\n`);
  if (!result.preflightPass) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
