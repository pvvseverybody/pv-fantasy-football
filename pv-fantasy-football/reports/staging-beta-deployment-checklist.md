# PV Fantasy Football 1.0 — staging beta deployment checklist

Status as of 2026-08-19: **BLOCKED ON EXTERNAL CONFIGURATION**. No staging deployment has been created.

## Verified local readiness

- Application root: the directory containing `package.json`.
- Framework: Next.js 15, server runtime; Node.js 20 or newer.
- Install command: `pnpm install --frozen-lockfile`.
- Build command: `pnpm build`.
- Dedicated target project name: `pv-fantasy-football-staging`.
- Isolated workbook: `PV Fantasy Football 1.0 — STAGING`; its ID is recorded in the private operator preparation report and must be entered only as server configuration.
- Release classification must be `PV_FANTASY_ENV=staging` and `PV_FANTASY_RELEASE_MODE=BETA`.
- `.vercel/` and all `.env*` files except the empty example are ignored.

## Lionel actions required before deployment

1. Log into Vercel from this workstation and select the owning account/team.
2. Approve creation or selection of the dedicated `pv-fantasy-football-staging` project. Do not link this working directory to a production project.
3. Share only the sanitized staging workbook with the staging Google service account as Editor.
4. Add the server-only Preview variables listed in `reports/staging-deployment-readiness.md`. Use unique staging values for authentication, scoring, and admin secrets. Set the staging spreadsheet pin equal to the backend workbook and set the production marker to the production workbook ID so accidental equality fails closed.
5. Configure a verified Resend sender and staging-scoped API key before real email acceptance. Until then, authentication remains unavailable; no bypass is enabled.

## Preview deployment acceptance

1. Create a Preview deployment only; never use `--prod`, promote, or assign the public production domain.
2. Confirm `/api/health` says `staging`, `BETA`, and `SAFE`, with the expected commit and no identifiers or secrets.
3. Run `pnpm certify:staging` with the Preview URL and the same staging-only operator configuration.
4. Sign into `/admin` and inspect System Readiness, Season Launch Preflight, Beta Acceptance, Public Opening Gate, and W0 Game-Day Readiness.
5. Generate fixture structures locally if needed. Their generator has `write_enabled:false`; loading them into staging requires a separately reviewed/manual staging-only action.
6. Complete `reports/beta-acceptance-package.md` with 3–5 authorized testers and sanitized evidence.

## Staging workbook requirements

The application schema certification covers Games, Players, Participants, ParticipantSession, Lineup Submissions, SubmissionHistory, Picks, Lineups, ActiveLineups, GameStats, PlayerScores, WeeklyScores, Leaderboard, Reconciliation, and PublishControl. Operational reads additionally require FeedControl, RunnerState, FeedSnapshots, IngestionLog, IngestionQA, InvariantMonitor, WriterGate, ScoringGate, and ScoringE2E. W0 must be `2026-W0`, Tarleton State, and OPEN; future weeks remain PENDING. Schema mismatches block certification and are never silently repaired.

## Production cutover — later, separate authorization required

- Create or select the production Vercel project independently of staging.
- Change `PV_FANTASY_ENV` from `staging` to `production`.
- Use the production workbook and production marker; remove the staging marker.
- Use a production-only service account, participant-auth secret, scoring secret, and admin credentials.
- Use the verified production Resend key and sender.
- Keep release mode `BETA` until final roster approval, live-provider certification, defensive fallback certification, beta sign-off, and publication controls pass.
- Re-run the complete tests, optimized build, W0 dry run, protected preflight, workbook certification, and browser acceptance.
- Set `PUBLIC` only through a deliberate production environment change explicitly authorized by Lionel. A final game state alone can never authorize publication or public entry.
