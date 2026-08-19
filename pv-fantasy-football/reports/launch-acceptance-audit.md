# PV Fantasy Football 1.0 — Pre-deployment acceptance audit

Audit date: 2026-08-19 (America/Chicago)
Scope: participant application, protected operations surface, scoring pipeline, repository security, and production workbook.  
Production workbook access during this audit was read-only.

## Executive decision

The application compiles and the certified lineup/scoring invariants remain intact. The public navigation and every declared route resolve. Passwordless authentication, secure self-registration, session-bound lineup writes, and session-bound personal results are implemented. The production game/control identity correction has been completed: W0 is the sole OPEN entry window, W1–W11 and postseason are PENDING, and the production control associations now follow the authoritative `Games` IDs. The new protected season-launch preflight fails closed on schedule/control drift, active demo identities, participant/player collisions, missing eligible players, and other launch-integrity conditions.

The official 2026 schedule confirms W0 is Prairie View at Tarleton State on August 29 at 8:00 PM CT. `Games` remains the authoritative schedule reference. Source: https://pvpanthers.com/sports/football/schedule/2026

## Critical workflow trace

### Participant

1. `/` loads public game information from `GET /api/game-hub` and offers secure registration or returning-participant sign-in. Participant identity is not stored in client-accessible session storage.
2. `/lineup` loads active eligible players from `GET /api/players`, loads games, and moves through Identify → Game → Lineup → Review.
3. The UI prevents duplicate choices and shows only slot-eligible players. The server independently repeats completeness, uniqueness, eligibility, active-player, open-game, and kickoff checks.
4. `POST /api/lineup` is the only public production write. It saves the raw ledger record, promotes through the authoritative versioned model, then reports success only after authoritative acceptance.
5. `/results` uses authenticated read-only `POST /api/results`; participant identity comes exclusively from the verified server session. It does not return emails or participant IDs and hides picks while entries remain open.
6. `/leaderboard` uses `GET /api/leaderboard`; demo/test records are filtered and public status is reduced to participant-safe labels.

Result: route and data flow are coherent. Registered email alone no longer authorizes writes; the participant must verify a short-lived code delivered to the registered inbox.

### PV Fantasy administrator

1. `/admin`, `/api/admin/readiness`, and `/api/admin/preflight` are protected by server middleware and HTTP Basic authentication.
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
| `/api/lineup` | Authenticated write | PASS | Session identity only; integrity checks remain authoritative |
| `/api/results` | Authenticated read via POST | PASS | Session identity only; email/Participant ID not accepted or returned; open-game picks hidden |
| `/api/leaderboard` | Public read | PASS | Demo/test participants excluded |
| `/api/admin/readiness` | Protected read | PASS | Fails closed |
| `/api/admin/preflight` | Protected read | PASS | Season-wide schedule, identity, roster, and entry-window checks; fails closed |
| `/api/scoring` | Protected write | PASS | Bearer secret required |

No dead public navigation targets were found. No public link points to the admin surface.

## Defects and findings

1. **Participant write authentication — resolved.** A generic, enumeration-resistant login request sends a six-digit code to a registered inbox. The code is HMAC-hashed, expires after ten minutes, and is limited to five attempts. Successful verification creates an opaque seven-day session whose hash and status are stored in the existing `ParticipantSession` ledger; the browser receives only a Secure, HttpOnly, SameSite=Strict cookie. Lineup/results identity is derived from the active verified session.
2. **Participant provisioning — resolved in code; production configuration remains.** Verified public self-registration creates permanent participant identities only after successful email-code verification and uniqueness checks. Active demo/test identities remain a preflight blocker and must not be present at launch.
3. **Game/control identity drift — corrected.** Production associations were reconciled to `Games`: Tarleton is `2026-W0`, subsequent regular-season opponents map through `2026-W11`, and `CERT-AUG27` remains isolated. The season preflight now detects regression.
4. **Countdown timezone — fixed.** The client previously interpreted Central Time text in the device timezone. It now converts explicit `America/Chicago` wall time and has daylight/standard-time tests.
5. **Entry-window policy — resolved.** `2026-W0` is OPEN; W1–W11 and postseason are PENDING. Multiple simultaneous OPEN games now produce a season-preflight HOLD.
6. **Roster remains provisional — expected.** `Players` is populated from the official roster but remains `PROVISIONAL_FALL_CAMP`; blank jerseys are intentionally omitted. Final-roster reconciliation and manual migration are still required before the first live game.
7. **Live provider certification incomplete — expected pre-live condition.** Current control rows are armed/not running. Actual PV live behavior, final verification, and defensive FF/FR/fumble-return fallback remain live-window dependencies.
8. **Home schedule failure feedback — resolved.** A failed authoritative schedule request now produces an explicit fail-safe message instead of leaving a perpetual loading card.
9. **Personal-results enumeration — resolved.** `/api/results` requires a valid participant session and derives identity server-side. Modified email or Participant ID request data cannot select another participant.

## Authoritative production environment variables

| Variable | Classification | Purpose | Exposure rule |
|---|---|---|---|
| `BACKEND_SPREADSHEET_ID` | Required for public app, lineup writes, scoring, admin | Selects authoritative workbook | Server only |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Required for public app, lineup writes, scoring, admin | Google service identity | Server only |
| `GOOGLE_PRIVATE_KEY` | Required for public app, lineup writes, scoring, admin | Signs Google API access | Encrypted server secret; preserve escaped newlines |
| `SCORING_PIPELINE_SECRET` | Required for scoring | Authorizes `/api/scoring` | Long random server secret |
| `PV_ADMIN_USERNAME` | Required for admin | Admin Basic-auth identity | Server only |
| `PV_ADMIN_PASSWORD` | Required for admin | Admin Basic-auth credential | Long unique encrypted server secret |
| `PARTICIPANT_AUTH_SECRET` | Required for participant login, lineup writes, personal results | HMAC secret for verification codes | Long random encrypted server secret |
| `RESEND_API_KEY` | Required for participant login | Sends verification email through Resend | Encrypted server secret |
| `PARTICIPANT_AUTH_FROM` | Required for participant login | Verified sender identity | Server configuration; domain must be verified |
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

## Current launch readiness by dependency

### A. CODE COMPLETE

- Passwordless registration/login, opaque sessions, session-bound lineup writes, and session-bound personal results.
- Certified lineup persistence, authoritative version promotion, scoring, reconciliation, and publication safeguards.
- Protected game readiness, Season Launch Preflight, and System Readiness APIs/dashboard.
- Server-controlled DEVELOPMENT/BETA/PUBLIC release mode that defaults to DEVELOPMENT and requires explicit deployment authorization for PUBLIC.
- Read-only beta acceptance ledger covering registration, login, lineup/version/lock, results, leaderboard, responsive devices, accessibility, and backend failures.
- Isolated W0 Tarleton launch simulation proving pre-lock replacement, duplicate idempotency, kickoff rejection, provisional/final scoring, publication HOLD, fallback, reconciliation, and final release.
- Session-bound accepted-lineup recovery without exposing Participant IDs or Submission IDs.
- Sanitized server failure logging and regression coverage preventing upstream messages, stacks, workbook IDs, credentials, emails, and tokens from entering logs.
- Vercel staging readiness, safe health/version reporting, explicit environment/workbook isolation guards, and a public-opening gate that never changes release mode.
- Master `certify:w0-dry-run` command covering tests, optimized build, W0 simulation, failure/cutoff/schema checks, and repository secret scanning.
- Fail-closed production configuration status that never returns configuration values.
- Read-only critical-tab connectivity and schema-drift validation, including strict write-table order and duplicate-header detection.
- Participant failure states, explicit schedule/player-pool failures, and full eight-player accepted-lineup confirmation.

### B. REQUIRES PRODUCTION CONFIGURATION

- Configure all nine required server variables, HTTPS, verified Resend sender, and service-account workbook access.
- Run protected System Readiness against production and resolve configuration, connectivity, schema, preflight, demo/test identity, or publication-control findings.
- Confirm production `PublishControl` begins on HOLD. No code result substitutes for operator approval.

### C. REQUIRES OFFICIAL FINAL ROSTER

- Run roster reconciliation, approve the migration manually, and verify provider mappings while preserving permanent PV Player IDs.
- Supply or approve any still-missing official visual assets; no unofficial replacement is permitted.

### D. REQUIRES LIVE GAME WINDOW

- Complete the scheduled live transport observations and W0 SIDEARM certification.
- Verify official final statistics and the authoritative FF/FR/fumble-return-TD fallback; publication remains blocked when required evidence is unavailable.

### E. REQUIRES HUMAN/BETA ACCEPTANCE

- Complete the browser/device checklist in isolated staging with approved testers, including registration email delivery, replacement, identical retry, lock, results, leaderboard, and admin review.
- Record beta sign-off. System Readiness intentionally caps at READY FOR BETA until human approval is supplied to the evaluator; deployment/public opening still requires explicit authorization.
