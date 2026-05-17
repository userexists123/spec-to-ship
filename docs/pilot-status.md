# Pilot Status

## Current milestone

Saturday 3 complete: PRD upload and analyze.

## Current branch target

`pilot-03 prd upload and analyze`

## Completed

### Saturday 1

- Created the browser-first workspace foundation.
- Added workspace settings persistence.
- Added live Azure DevOps repository loading from saved workspace settings.
- Added frontend workspace form and repository test dropdown.
- Added pilot docs.

### Saturday 2

- Extended workspace persistence with selected repo and last selected PR.
- Added recent PR storage.
- Added backend pull request listing by repository.
- Added backend selection persistence.
- Added dashboard repo selector.
- Added dashboard PR selector.
- Added recent PR display.
- Confirmed repo and PR context can be selected from the browser and remembered after refresh.

### Saturday 3

- Added `prd_document`, `backlog_draft`, `backlog_item`, `acceptance_criterion`, and `risk_item` database tables.
- Added `POST /prds`.
- Added `POST /prds/{id}/analyze`.
- Added `GET /backlog/drafts/{id}`.
- Stored raw PRD text in Supabase PostgreSQL.
- Stored generated backlog draft JSON in Supabase PostgreSQL.
- Stored normalized generated requirements, epics, issues, acceptance criteria, and risks.
- Added `/prd` frontend page.
- Added PRD paste box.
- Added `.txt` and `.md` file upload support.
- Added Analyze button.
- Rendered generated requirements, epics, issues, acceptance criteria, and risks.
- Added draft header with title, created time, status, and draft ID.
- Added saved analyzed draft reload with `/prd?draftId=<draft-id>`.
- Added recent PRD display on dashboard.

## Validation checklist

### Saturday 1

- Save workspace from browser: complete.
- Reload browser and confirm persistence: complete.
- Fetch live Azure DevOps repos: complete.

### Saturday 2

- Select repo from UI: complete.
- List open/recent PRs for selected repo: complete.
- Select PR and verify persistence after refresh: complete.

### Saturday 3

- Analyze a real PRD from the UI: ready for hosted validation.
- Refresh the page and confirm draft persistence: ready for hosted validation using `/prd?draftId=<draft-id>`.
- Verify draft data is stored in the database: ready for Supabase validation.

## Hosted validation notes

- Frontend target: Vercel.
- Backend target: Railway.
- Database target: Supabase PostgreSQL.
- For Railway to Supabase connectivity, prefer the Supabase pooler connection string when IPv6 direct connection causes deployment/runtime connection failures.
- Run `src/db/migrations/0003_prd_backlog_drafts.sql` in Supabase before testing the hosted PRD page.

## Known gaps intentionally deferred

- Editable backlog drafts are deferred to Saturday 5.
- Azure DevOps backlog preview/create from saved draft is deferred to Saturday 5.
- Ambiguity detection, confidence labels, and explicit/inferred tagging are deferred to Saturday 4.
- RAG, pgvector, document ingestion, embeddings, and retrieval context are deferred to Saturday 6.
- PR review browser page is deferred to Saturday 7.
- Traceability page is deferred to Saturday 8.