# PV Fantasy Football 1.0 — Browser acceptance checklist

Use this checklist against a preview/staging deployment connected to an isolated workbook copy, or with an approved real launch tester. Do not add a fake participant to the production workbook. Record tester, date, deployment URL, workbook, device/browser, and evidence link for every run.

## Preconditions

- [ ] Deployment uses HTTPS and the intended production-equivalent environment configuration.
- [ ] Test game identity, kickoff, and entry status are explicitly approved.
- [ ] Tester is an approved verified participant; no shared or invented production identity is used.
- [ ] The test lineup contains eight active eligible players.
- [ ] Admin has confirmed the raw ledger and authoritative tables are safe to exercise.
- [ ] Browser network and console panels are available for desktop diagnostics.

## Device matrix

- [ ] Mobile: iPhone Safari at approximately 390×844.
- [ ] Mobile: Android Chrome at approximately 412×915.
- [ ] Tablet: Safari or Chrome at approximately 768×1024, portrait and landscape.
- [ ] Desktop: Chrome at 1440×900.
- [ ] Desktop: Edge or Safari at 1280×800.
- [ ] At 200% browser zoom, primary flow remains usable with no clipped submission controls.
- [ ] Keyboard-only navigation reaches every form field, game, lineup selector, review, and submission control.

## Public navigation and identification

- [ ] `/` loads without console errors and shows PV branding, next game, kickoff, and entry status.
- [ ] Every public navigation link resolves: Lineup, My Results, Leaderboard, Players.
- [ ] No public page links to `/admin` or exposes provider/gate/workbook details.
- [ ] Malformed email is rejected by browser validation.
- [ ] Registered and unregistered well-formed emails receive the same generic request response and equivalent challenge cookie behavior.
- [ ] The registered inbox receives a six-digit code; an unregistered address receives nothing.
- [ ] Invalid/expired code is rejected without identifying whether the address is registered.
- [ ] Valid code establishes the secure session and advances to game selection.
- [ ] Refreshing preserves the HttpOnly session without placing email or token in the URL or browser storage.

## Game selection and lock display

- [ ] Games show correct week, opponent, site, CT kickoff, and OPEN/LOCKED state.
- [ ] Countdown matches America/Chicago time on a device configured outside Central Time.
- [ ] Only intentionally open games permit “Build this lineup.”
- [ ] Locked games remain visible but cannot enter the builder.
- [ ] TBA/unparseable kickoff fails safe to workbook entry status; server still enforces the authoritative deadline.

## Lineup construction

- [ ] Eight required slots appear under the correct offense/defense groups.
- [ ] Each slot lists only eligible active players.
- [ ] Formal name and position are visible.
- [ ] Official jersey appears when present; blank jersey produces no error, placeholder, or invented value.
- [ ] Selecting a player marks that player unavailable in every other slot while preserving the current selection.
- [ ] An incomplete lineup cannot proceed and names missing slots.
- [ ] Duplicate selection is rejected client-side and server-side.
- [ ] Ineligible position submitted through a modified request is rejected by the server.

## Review and submission

- [ ] Review shows all eight slots, names, positions, available jerseys, opponent, kickoff, and lock countdown.
- [ ] Edit returns to the builder without losing selections.
- [ ] First legitimate submission receives “Lineup saved” only after HTTP authoritative acceptance.
- [ ] Raw ledger contains one legitimate row and authoritative tables contain exactly one accepted scoring version with eight unique picks.
- [ ] Repeating the identical request returns “Lineup already saved” and creates no duplicate authoritative version.
- [ ] Changing one or more picks before kickoff returns “Lineup updated”; the previous version is superseded and only the newest accepted version scores.
- [ ] Unknown participant receives “Participant not recognized” and no authoritative lineup is created.
- [ ] At/after kickoff, submission returns locked/late and does not replace the accepted scoring version.
- [ ] Network interruption or HTTP 5xx never displays an accepted/saved confirmation.

## Leaderboard and personal results

- [ ] Leaderboard renders an empty state when no real scores exist; it never displays demo/test rows.
- [ ] Weekly standings sort descending and ranks match `WeeklyScores` for the selected week.
- [ ] Season standings match `Leaderboard` totals and ordering.
- [ ] Public status is only PREGAME, LIVE • PROVISIONAL, FINAL • VERIFYING STATS, or FINAL • OFFICIAL.
- [ ] Personal results reject an unknown email without echoing the address.
- [ ] While entry is OPEN, personal results do not reveal accepted picks.
- [ ] After lock, personal results show only the accepted scoring-version eight, with player and lineup totals matching authoritative scores.
- [ ] Superseded, rejected, incomplete, and late versions never appear.
- [ ] Previous weeks render independently when data exists.

## Admin acceptance

- [ ] `/admin` without credentials returns an authentication challenge.
- [ ] Invalid credentials receive 401 and no page content.
- [ ] Missing server auth configuration fails closed with 503.
- [ ] Valid credentials load the selected-game status surface over HTTPS.
- [ ] Admin contains no score, publish, lineup, or data mutation button.
- [ ] `/api/admin/readiness?game_id=<valid>` returns READY, HOLD, or BLOCKED with reasons.
- [ ] Final game state alone remains HOLD/BLOCKED until all required reconciliation/publication conditions pass.

## Error and offline acceptance

- [ ] Block Google Sheets access: public data APIs return controlled errors without stack traces or credentials.
- [ ] Load `/lineup` offline: a clear player/schedule load failure appears and submission is unavailable.
- [ ] Go offline during submission: no success confirmation appears; retrying after recovery is idempotent.
- [ ] Block `/api/leaderboard`: a standings-unavailable message appears.
- [ ] Block `/api/results`: a results-unavailable message appears.
- [ ] Slow 3G simulation does not permit double submission while the submit button is busy.
- [ ] Browser console/network responses contain no service-account key, admin credential, scoring secret, email echo, participant ID, or internal gate diagnostics.

## Sign-off

- [ ] Participant-flow owner: PASS / FAIL, name, date, evidence.
- [ ] Operations owner: PASS / FAIL, name, date, evidence.
- [ ] Scoring owner: PASS / FAIL, name, date, evidence.
- [ ] Any FAIL has an owner, severity, remediation, and retest date.
