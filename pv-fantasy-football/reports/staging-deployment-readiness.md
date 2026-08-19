# PV Fantasy Football 1.0 — staging deployment readiness

## Vercel application

- Project root: `pv-fantasy-football/` (the directory containing `package.json`).
- Install: `pnpm install --frozen-lockfile`.
- Build: `pnpm build`.
- Output: standard Next.js 15 application output; do not configure a static export directory.
- Runtime: Node.js 20 or newer. API routes, middleware authentication, Google Auth, crypto, Sheets writes, Resend calls, and admin server rendering require server execution. No route intentionally persists state to the local filesystem.
- Health monitoring: `GET /api/health` is inexpensive and performs no workbook read. Full checks remain protected under `/api/admin/*`.

## Environment matrix

| Variable | Local development | Staging / beta | Production | Secret | Must differ staging/production |
|---|---|---|---|---|---|
| `PV_FANTASY_ENV` | Optional; defaults `development` | Required `staging` | Required `production` | No | Yes |
| `PV_FANTASY_RELEASE_MODE` | Optional `DEVELOPMENT` | Required `BETA` | `DEVELOPMENT`/`BETA` until explicitly authorized; then `PUBLIC` | No | Normally |
| `BACKEND_SPREADSHEET_ID` | Optional unless testing Sheets | Required isolated staging workbook | Required production workbook | Sensitive configuration | Yes |
| `PV_FANTASY_STAGING_SPREADSHEET_ID` | Optional | Required and equal to staging backend | Omit | Sensitive configuration | Yes |
| `PV_FANTASY_PRODUCTION_SPREADSHEET_ID` | Optional | Recommended to detect accidental equality | Recommended and equal to production backend | Sensitive configuration | Yes |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Optional unless testing Sheets | Required; staging access only preferred | Required | Sensitive | Prefer separate identity |
| `GOOGLE_PRIVATE_KEY` | Optional unless testing Sheets | Required staging secret | Required production secret | Yes | Yes |
| `SCORING_PIPELINE_SECRET` | Optional | Required | Required | Yes | Yes |
| `PV_ADMIN_USERNAME` | Optional | Required | Required | Sensitive | Yes |
| `PV_ADMIN_PASSWORD` | Optional | Required | Required | Yes | Yes |
| `PARTICIPANT_AUTH_SECRET` | Optional | Required | Required | Yes | Yes |
| `RESEND_API_KEY` | Optional | Required for real email beta | Required | Yes | Prefer scoped/separate |
| `PARTICIPANT_AUTH_FROM` | Optional | Required verified staging sender | Required verified production sender | No | Recommended |
| `BETA_ACCEPTANCE_JSON` | Optional | Optional read-only acceptance record | Optional after sign-off | Treat as sensitive operational data | Yes |
| `PV_LIVE_PROVIDER_CERTIFIED` | Optional `NO` | `NO` until evidence exists | `YES` only after certification | No | Evidence-based |
| `PV_DEFENSIVE_FALLBACK_CERTIFIED` | Optional `NO` | `NO` until evidence exists | `YES` only after certification | No | Evidence-based |

## Staging isolation procedure

1. Use the already certified isolated staging workbook; never duplicate participant personal data into it.
2. Give the staging deployment only the staging workbook ID and credentials authorized for staging.
3. Set both `PV_FANTASY_ENV=staging` and `PV_FANTASY_STAGING_SPREADSHEET_ID` to pin the expected backend. Optionally set the production marker so equality is rejected.
4. Set release mode to `BETA`. Never set staging to `PUBLIC`.
5. Run `/api/health`, protected system readiness, season preflight, schema certification, and public-opening gate.
6. Generate fixture structures only with `generateStagingFixtures`; it returns `write_enabled:false` and refuses non-staging configuration. Any future workbook loader must remain a separately reviewed/manual action.
7. Complete the beta checklist and record sanitized evidence references in `BETA_ACCEPTANCE_JSON`.

## Serverless and concurrency classification

| Mechanism | Class | Finding / mitigation |
|---|---|---|
| Google Sheets ledgers and authoritative rows | A — durable | Durable system of record; schema and post-write invariants fail closed. |
| Deterministic raw lineup submission IDs | A — durable | Identical retries reuse the same ID and do not append a second raw row. |
| Authentication challenge/session rows | A — durable | Hashes/status/expiry live in Sheets; sessions survive instance replacement. |
| In-process auth throttling | B — best effort | Per-instance only. Configure Vercel Firewall/WAF rate limits for public auth routes. |
| In-process participant/writer/scoring locks | B — best effort | Serialize only within one instance. Durable duplicate checks and post-write verification remain mandatory. |
| Concurrent different lineup replacements | C — cross-instance limitation | Google Sheets has no conditional transaction. Post-write invariants detect conflicting scoring versions and fail the request, but operator review may be needed. Monitor WriterGate/InvariantMonitor and avoid parallel retries. |
| Concurrent registration | B — fail-closed | Candidates are appended inactive and uniqueness is rechecked; conflicts remain inactive for review. |
| Concurrent scoring runs | B — guarded/idempotent | Deterministic target rows and verification reduce risk; only one authorized operator/runner should invoke a game at a time. |
| Local filesystem | Not used for runtime state | Certification evidence is build/operator tooling only; server routes do not rely on writable local files. |

No deployment should proceed until the staging environment guard is SAFE and the protected public-opening evaluation is at least `READY_FOR_STAGING`.
