# Pilot Decisions

## 2026-04-25 - Saturday 1 foundation

- Frontend is a separate `web/` Next.js app intended for Vercel deployment.
- Backend remains the existing Azure Functions-style Node/TypeScript app already containerized for Railway.
- Database is Supabase Postgres, configured in Railway with `DATABASE_URL`.
- The Azure DevOps PAT remains server-side in Railway; the browser saves only org/project/default workspace preferences.
- Workspace persistence uses a singleton row because the pilot is explicitly single-user and has no auth.
- `GET /repos` uses the saved workspace org URL and project, then calls Azure DevOps REST live. It fails if `DEMO_MODE=true`.
- Epic/Issue mappings are saved in workspace settings now and can be reused by later backlog execution work.

## 2026-05-02 - Saturday 2 repo and PR selectors

- The home page is now the PM dashboard for saved workspace context and PR selection.
- Repo and PR selection remain part of the singleton workspace record because the pilot is still single-user and has no auth.
- Recent PR history is append-only for now; deduplication and cleanup are deferred unless the pilot needs it.
- `GET /repos/{repoId}/pull-requests` uses live Azure DevOps REST and does not provide demo/fake PR fallback behavior.
- Last used PRD remains a dashboard placeholder until Saturday 3 adds persisted PRD/draft records.