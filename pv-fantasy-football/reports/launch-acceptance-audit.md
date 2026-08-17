# PV Fantasy Football 1.0 — Pre-deployment acceptance audit

Audit date: 2026-08-17 (America/Chicago)  
Scope: participant application, protected operations surface, scoring pipeline, repository security, and production workbook.  
Production workbook access during this audit was read-only.

## Executive decision

The application compiles and the certified lineup/scoring invariants remain intact. The public navigation and every declared route resolve. Three launch decisions/data corrections remain: participant write authentication, replacement of demo-only participant data with approved real participants, and correction of game identity drift across production control tables.

The official 2026 schedule confirms W0 is Prairie View at Tarleton State on August 29 at 8:00 PM CT. The `Games` table matches the official schedule for the sampled rows. The current `FeedControl` and `Reconciliation` rows do not consistently match those `Game ID`/opponent pairs. Source: https://pvpanthers.com/sports/football/schedule/2026

## Critical workflow trace

### Participant

1. `/` loads public game information from `GET /api/game-hub` and stores the entered normalized email in browser session storage.
2. `/lineup` loads active eligible players from `GET /api/players`, loads games, and moves through Identify → Game → Lineup → Review.
3. The UI prevents duplicate choices and shows only slot-eligible players. The server independently repeats completeness, uniqueness, eligibility, active-player, open-game, and kickoff checks.
4. `POST /api/lineup` is the only public production write. It saves the raw ledger record, promotes through the authoritative versioned model, then reports success only after authoritative acceptance.
5. `/results` uses read-only `POST /api/results`; it does not return emails or participant IDs and hides picks while entries remain open.
6. `/leaderboard` uses `GET /api/leaderboard`; demo/test records are filtered and public status is reduced to participant-safe labels.

Result: route and data flow are coherent. Launch risk: knowledge of a participant email is currently sufficient to submit or replace that participant's lineup.

### PV Fantasy administrator

1. `/admin` and `/api/admin/readiness` are protected by server middleware and HTTP Basic authentication.
2. Missing admin configuration fails closed with HTTP 503; invalid credentials return HTTP 401.
3. The page is read-only and derives status from the existing workbook controls. It has no score, publish, lineup, or data mutation action.
4. `READY` requires official final, passing reconciliation, `READY_TO_LOCK`, valid scoring/lineup invariants, and explicit publication release.

Result: protected read-only operations workflow is coherent. Production HTTPS and strong credentials are mandatory. Add host-level brute-force/rate protection before broad operator access.

### Automated scoring pipeline

1. `POST /api/scoring` requires a server-side bearer secret.
2. It reads normalized `GameStats`; it does not accept client-supplied statistics.
3. Missing/invalid/provenance-free or duplicate statistics fail closed.
4. Auditable `PlayerScores` are calculated and propagated only through valid accepted scoring-version picks.
5. Verification reconciles eight unique picks to `Lineups`, `ActiveLineups`, and `WeeklyScores`.
6. Final publication remains separate and controlled by reconciliation and `PublishControl`.

Result: certified path remains intact. The application pipeline cannot safely run a live game until provider/game identity rows are corrected and the defensive final fallback is available where required.

## Route and link audit

| Route | Access | State | Notes |
|---|---|---|---|
| `/` | Public | PASS | Home and participant identification |
| `/lineup` | Public | PASS | Sole participant write flow through `/api/lineup` |
| `/results` | Public | PASS | Read-only participant results; pre-lock picks withheld |
| `/leaderboard` | Public | PASS | Weekly and cumulative standings |
| `/players` | Public | PASS | Active eligible player directory |
| `/admin` | Protected | PASS | Read-only operations surface |
| `/api/game-hub` | Public read | PASS | No provider/internal fields returned |
| `/api/players` | Public read | PASS | No private identity fields returned |
| `/api/lineup` | Public write | CONDITIONAL | Integrity checks pass; participant authentication unresolved |
| `/api/results` | Public read via POST | PASS | Email not echoed; open-game picks hidden |
| `/api/leaderboard` | Public read | PASS | Demo/test participants excluded |
| `/api/admin/readiness` | Protected read | PASS | Fails closed |
| `/api/scoring` | Protected write | PASS | Bearer secret required |

No dead public navigation targets were found. No public link points to the admin surface.

## Defects and findings

1. **Participant write authentication — unresolved launch blocker.** Normalized email identifies the participant but does not prove control of the identity. A person who knows another participant's email could replace that lineup before kickoff. Resolve with an approved authenticated participant session (for example magic-link/OTP or another verified sign-in); do not put a shared secret in client JavaScript.
2. **Production participants — unresolved launch blocker.** The sampled production `Participants` table contains only `DEMO-001`, explicitly marked for deletion/replacement before launch. Public APIs correctly suppress it, leaving no real participant able to submit.
3. **Game/control identity drift — unresolved launch blocker.** `Games` correctly starts with W0 Tarleton State, W1 Texas Southern, W2 Baylor, W3 SFA, W4 Grambling State. Sampled control rows include `2026-W2` paired with Texas Southern, `2026-W4` paired with SFA, and `Reconciliation 2026-W1` paired with Tarleton State. Correct and revalidate all IDs, opponents, provider event IDs, and kickoff times before enabling runners or scoring.
4. **Countdown timezone — fixed.** The client previously interpreted Central Time text in the device timezone. It now converts explicit `America/Chicago` wall time and has daylight/standard-time tests.
5. **Entry-window policy — requires launch decision.** Sampled `Games` rows W0–W4 are all `OPEN`. Confirm whether advance entry for multiple weeks is intended. Close every game that should not accept submissions.
6. **Roster remains provisional — expected.** `Players` is populated from the official roster but remains `PROVISIONAL_FALL_CAMP`; blank jerseys are intentionally omitted. Final-roster reconciliation and manual migration are still required before the first live game.
7. **Live provider certification incomplete — expected pre-live condition.** Current control rows are armed/not running. Actual PV live behavior, final verification, and defensive FF/FR/fumble-return fallback remain live-window dependencies.
8. **Home offline feedback is minimal.** The lineup page provides an explicit backend-load error; the home game card can be absent without a visible error. This is non-blocking because entry continues to a fail-safe lineup load error.
9. **Email lookup can be enumerated.** `/api/results` distinguishes unknown participants. It exposes no email/participant ID and hides pre-lock picks, but rate limiting and authenticated participant sessions should be added with the write-auth resolution.

## Authoritative production environment variables

| Variable | Classification | Purpose | Exposure rule |
|---|---|---|---|
| `BACKEND_SPREADSHEET_ID` | Required for public app, lineup writes, scoring, admin | Selects authoritative workbook | Server only |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Required for public app, lineup writes, scoring, admin | Google service identity | Server only |
| `GOOGLE_PRIVATE_KEY` | Required for public app, lineup writes, scoring, admin | Signs Google API access | Encrypted server secret; preserve escaped newlines |
| `SCORING_PIPELINE_SECRET` | Required for scoring | Authorizes `/api/scoring` | Long random server secret |
| `PV_ADMIN_USERNAME` | Required for admin | Admin Basic-auth identity | Server only |
| `PV_ADMIN_PASSWORD` | Required for admin | Admin Basic-auth credential | Long unique encrypted server secret |
| `LINEUP_SUBMISSIONS_SHEET` | Optional | Overrides `Lineup Submissions` tab name | Defaults to `Lineup Submissions` |

There are no required `NEXT_PUBLIC_*` variables. Repository scans found no committed private key, API key, admin password, scoring secret, personal consumer email address, `.env` file, credential JSON, or PEM file. Test-only literal passwords are non-production fixtures. Server error logging does not intentionally log request bodies or credentials.

The repository now includes a pinned pnpm version, lockfile, and patched `sharp`/`postcss` transitive overrides. The high-severity production dependency audit is clear. One moderate `uuid` advisory remains through `google-auth-library`; the vulnerable buffer-supplying v3/v5/v6 API path is not called by this application. Reassess when upgrading Google Auth rather than forcing an unverified incompatible major transitive override.

## Production data launch checklist

- **Games:** Official schedule, CT kickoff, opponent, site, location, intended `Pick Status`, provider, event ID, and source agree. Exactly the intended entry windows are `OPEN`.
- **Players:** Final approved active roster has permanent PV Player IDs, canonical positions, side, provenance, and provider mapping candidates. Blank jerseys remain acceptable until officially published.
- **Participants:** Real approved participants exist with unique normalized emails, `Active=YES`, `Identity Status=VERIFIED`, clear duplicate flags, and an approved authentication method. Demo participant is removed or inactive before launch.
- **Lineup Submissions:** Exact A3:L3 schema remains intact, service account can append, and ledger is empty or contains only legitimate submissions.
- **Authoritative lineup tables:** `SubmissionHistory`, `Picks`, `Lineups`, and `ActiveLineups` schemas/formulas are intact; no stale demo row can be selected as a real scoring version.
- **Provider mappings:** Every production `Game ID` agrees across `Games`, `FeedControl`, `RunnerState`, `Reconciliation`, and provider event identity. Player mappings use permanent PV IDs and verified provider IDs where available.
- **Scoring tables:** Production `GameStats` contains no unit fixtures for production game IDs; `PlayerScores` formulas/schema match certified rules; missing required defensive fields block final publication.
- **Leaderboard:** `WeeklyScores` validates exactly eight picks; `Leaderboard` excludes demo/test identities from launch data; public API remains empty rather than inventing results.
- **Publication controls:** writer/scoring/invariant checks pass, reconciliation waits before final, and official release stays HOLD until the operator completes the final checklist.

## Launch classification

### BLOCKS LAUNCH

- Approve and implement participant authentication for lineup writes; registered email alone is not sufficient proof of identity.
- Provision approved real participants and remove/deactivate the demo participant before opening public entry.
- Correct and certify every production game identity across `Games`, `FeedControl`, `RunnerState`, and `Reconciliation`; confirm which games should actually be `OPEN`.

### MUST VERIFY BEFORE FIRST LIVE GAME

- Run final-roster reconciliation, approve the migration, and verify provider-to-PV mappings without reusing permanent PV IDs.
- Complete W0 live-provider mapping/certification, including retry/final behavior and official final-stat evidence.
- Prove or supply the authoritative FF/FR/fumble-return-TD fallback and keep publication blocked if any required field is unavailable.
- Exercise the complete browser checklist with an approved real tester or an isolated staging workbook copy.
- Verify production environment variables, HTTPS, service-account workbook access, scoring secret, and admin credentials.
- Confirm `PublishControl` begins on HOLD and the admin readiness endpoint is not `READY` before final reconciliation.

### CAN WAIT UNTIL AFTER 1.0

- Richer home-page offline messaging beyond the current fail-safe lineup error.
- Participant self-service account management and profile editing.
- Enhanced admin alert delivery, dashboards, and host-level observability.
- Additional visual polish, photos, animations, and nonessential analytics.
