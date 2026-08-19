export const OFFICIAL_ASSET_PATHS = Object.freeze({
  pvFantasy: '/assets/official/pv-fantasy-football-logo.png',
  pvamu: '/assets/official/prairie-view-am-logo.png',
  opponents: Object.freeze({
    'Tarleton State': '/assets/official/opponents/tarleton-state.png',
    'Texas Southern': '/assets/official/opponents/texas-southern.png',
    Baylor: '/assets/official/opponents/baylor.png',
    'Stephen F. Austin': '/assets/official/opponents/stephen-f-austin.png',
    'Grambling State': '/assets/official/opponents/grambling-state.png',
    'Mississippi Valley State': '/assets/official/opponents/mississippi-valley-state.png',
    Southern: '/assets/official/opponents/southern.png',
    'Alcorn State': '/assets/official/opponents/alcorn-state.png',
    'East Texas A&M': '/assets/official/opponents/east-texas-am.png',
    'Alabama A&M': '/assets/official/opponents/alabama-am.png',
    'Arkansas-Pine Bluff': '/assets/official/opponents/arkansas-pine-bluff.png',
    'Alabama State': '/assets/official/opponents/alabama-state.png',
    'SWAC Championship': '/assets/official/opponents/swac-championship.png',
    'Celebration Bowl': '/assets/official/opponents/celebration-bowl.png',
  }),
});

// Add a key only after Lionel approves the exact local file. An expected path
// alone never authorizes a logo for display.
export const APPROVED_OFFICIAL_ASSET_KEYS = Object.freeze([]);

const OPPONENT_ALIASES = Object.freeze({
  SFA: 'Stephen F. Austin',
  'Stephen F Austin': 'Stephen F. Austin',
  UAPB: 'Arkansas-Pine Bluff',
  'Arkansas Pine Bluff': 'Arkansas-Pine Bluff',
});

export function canonicalOpponent(value = '') {
  const name = String(value).trim();
  return OPPONENT_ALIASES[name] || name;
}

export function officialAsset(kind, opponent = '') {
  if (kind === 'pv-fantasy') return {key:'pv-fantasy', label:'PV Fantasy Football', src:OFFICIAL_ASSET_PATHS.pvFantasy,approved:APPROVED_OFFICIAL_ASSET_KEYS.includes('pv-fantasy')};
  if (kind === 'pvamu') return {key:'pvamu', label:'Prairie View A&M', src:OFFICIAL_ASSET_PATHS.pvamu,approved:APPROVED_OFFICIAL_ASSET_KEYS.includes('pvamu')};
  const canonical = canonicalOpponent(opponent);
  const key=canonical?`opponent:${canonical}`:'opponent:unknown';
  return {key,label:canonical||'Opponent',src:OFFICIAL_ASSET_PATHS.opponents[canonical]||'',approved:APPROVED_OFFICIAL_ASSET_KEYS.includes(key)};
}
