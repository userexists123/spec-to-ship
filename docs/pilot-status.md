## Saturday 1 - Foundation: product shell, database, workspace setup

Status: complete.

### Validated

- Workspace settings save successfully from the Vercel browser UI.
- Workspace settings persist in Supabase Postgres after refresh.
- Railway backend connects to Supabase using the Supabase pooler connection string.
- Vercel frontend calls Railway backend using `NEXT_PUBLIC_API_BASE_URL`.
- Railway CORS is locked to the production Vercel origin.
- Azure DevOps live repositories load from saved workspace settings.
- Azure DevOps PAT was refreshed and validated for the `agentic-booth` organization.

### Saturday 1 stop condition

Complete: from the browser, workspace settings can be saved and live Azure DevOps repos can be loaded from saved workspace settings.

## Saturday 2 - Saved project and PR context, home dashboard, PR selection

Status: implementation ready for hosted validation.

### Added

- Workspace persistence now stores selected repo ID/name and last used PR ID/title.
- Recent PR selections are stored in `recent_pr` whenever a selected PR is saved.
- `GET /repos/{repoId}/pull-requests` returns compact Azure DevOps PR summaries for UI selection.
- Home dashboard now shows workspace summary, last used PR, last used PRD placeholder, quick actions, repo selector, PR selector, PR list, and recent PR history.

### Validation needed in hosted pilot

- Apply migration `src/db/migrations/0002_repo_pr_selection.sql` to Supabase.
- Deploy Railway backend with the new route.
- Deploy Vercel frontend with `NEXT_PUBLIC_API_BASE_URL` pointing to the Railway API base URL.
- From the browser, select a repo, load PRs, select a PR, save it, refresh, and confirm the saved repo/PR remain selected.

### Saturday 2 stop condition

Pending hosted validation: repo and PR are selectable from the UI and remembered after refresh.