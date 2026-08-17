import {createHash} from 'node:crypto';

const REQUIRED_GROUPS = [
  'Rushing', 'Receiving', 'Passing', 'Fumbles', 'Tackling', 'Sacks',
  'PassDefense', 'Interceptions', 'KickReturns', 'PuntReturns',
];

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function snapshotHash(payload) {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function validateSidearmEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.hostname !== 'sidearmstats.com') {
    throw new Error('L2 endpoint must use HTTPS on sidearmstats.com.');
  }
  if (!url.pathname.endsWith('/game.json')) {
    throw new Error('L2 endpoint must target SIDEARM game.json.');
  }
  return url;
}

export function inspectSidearmPayload(payload) {
  const game = payload?.Game;
  if (!game || game.Type !== 'FootballGame') throw new Error('Payload is not a SIDEARM football game.');
  const teams = [payload?.Stats?.HomeTeam, payload?.Stats?.VisitingTeam];
  const missingGroups = [];
  teams.forEach((team, teamIndex) => {
    for (const group of REQUIRED_GROUPS) {
      if (!team?.PlayerGroups?.[group]) missingGroups.push(`${teamIndex === 0 ? 'home' : 'visitor'}.${group}`);
    }
  });
  return {
    type:game.Type,
    source:game.Source || null,
    clientId:String(game.ClientId || ''),
    ncaaGameId:String(game.NcaaGameId || ''),
    homeTeam:game.HomeTeam?.Name || null,
    visitingTeam:game.VisitingTeam?.Name || null,
    hasStarted:Boolean(game.HasStarted),
    isComplete:Boolean(game.IsComplete),
    period:Number(game.Period || 0),
    clockSeconds:Number(game.ClockSeconds || 0),
    playerCount:teams.reduce((total, team) => total + (team?.Players?.length || 0), 0),
    playCount:payload?.Plays?.length || 0,
    requiredGroups:REQUIRED_GROUPS.length * 2,
    missingGroups,
  };
}

export function compareSnapshots(previous, current) {
  const previousInspection = inspectSidearmPayload(previous);
  const currentInspection = inspectSidearmPayload(current);
  return {
    changed:snapshotHash(previous) !== snapshotHash(current),
    finalTransition:!previousInspection.isComplete && currentInspection.isComplete,
    startedTransition:!previousInspection.hasStarted && currentInspection.hasStarted,
    playerCountDecreased:currentInspection.playerCount < previousInspection.playerCount,
    playCountDecreased:currentInspection.playCount < previousInspection.playCount,
  };
}

export async function fetchSidearmSnapshot(endpoint, {fetchImpl=fetch, timeoutMs=15000} = {}) {
  validateSidearmEndpoint(endpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      headers:{accept:'application/json'},
      redirect:'follow',
      signal:controller.signal,
    });
    if (!response.ok) throw new Error(`SIDEARM transport returned HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error(`SIDEARM transport returned unexpected content type: ${contentType || 'missing'}.`);
    }
    const payload = await response.json();
    const inspection = inspectSidearmPayload(payload);
    return {
      endpoint,
      fetchedAt:new Date().toISOString(),
      etag:response.headers.get('etag'),
      cors:response.headers.get('access-control-allow-origin'),
      contentType,
      hash:snapshotHash(payload),
      payload,
      inspection,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export {REQUIRED_GROUPS};
