# Pilot Status

## Saturday 1 - Foundation: product shell, database, workspace setup

Status: ready to implement and validate in hosted environments.

### Added

- `web/` Next.js app with home and workspace pages.
- Workspace form for org URL, project, default repo, Epic/Issue mapping, and default branch.
- Current workspace summary card.
- Live Azure DevOps repo dropdown test.
- Supabase Postgres migration for `workspace`, `recent_pr`, and `recent_prd`.
- Backend DB connection and Drizzle schema foundation.
- Backend `GET /workspace`, `PUT /workspace`, and `GET /repos` routes.

### Validation checklist

- Run migration `src/db/migrations/0001_workspace_foundation.sql` in Supabase SQL editor.
- Set Railway `DATABASE_URL`, `AZDO_PAT`, and `DEMO_MODE=false`.
- Set Railway `CORS_ORIGIN` to the Vercel app origin after deployment.
- Set Vercel `NEXT_PUBLIC_API_BASE_URL` to the Railway backend `/api` base URL.
- Save workspace from the browser.
- Refresh and confirm workspace persistence.
- Click Load live repos and confirm Azure DevOps repositories populate the dropdown.

### Open blockers

- Hosted validation still needs to be performed against the real Railway, Vercel, Supabase, and Azure DevOps environments.