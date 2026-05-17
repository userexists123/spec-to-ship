# Pilot Decisions

## 2026-04-25 - Saturday 1 foundation

- Frontend is a separate `web/` Next.js app intended for Vercel deployment.
- Backend remains the existing Azure Functions-style Node/TypeScript app already containerized for Railway.
- Database is Supabase Postgres, configured in Railway with `DATABASE_URL`.
- The Azure DevOps PAT remains server-side in Railway; the browser saves only org/project/default workspace preferences.
- Workspace persistence uses a singleton row because the pilot is explicitly single-user and has no auth.
- `GET /repos` uses the saved workspace org URL and project, then calls Azure DevOps REST live. It fails if `DEMO_MODE=true`.
- Epic/Issue mappings are saved in workspace settings now and can be reused by later backlog execution work.