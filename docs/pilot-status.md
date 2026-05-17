# Pilot Status

## Current milestone

Saturday 4 ready for deployment/test: trust layer v1 for generated backlog drafts.

## Current branch target

`pilot-04 trustworthy generation metadata`

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

### Saturday 4

- Added deterministic ambiguity detection for vague wording, mixed scope, unclear ownership, non-testable outcomes, and missing non-functional details.
- Added explicit vs inferred evidence labels to requirements, epics, issues, acceptance criteria, and risks.
- Added High, Medium, and Low confidence scoring.
- Added rationale/basis text under each generated item.
- Persisted trust metadata inside `draft_json`.
- Added normalized trust metadata columns to `backlog_item`, `acceptance_criterion`, and `risk_item`.
- Added `ambiguity_warnings` persistence to `backlog_draft`.
- Added PRD page ambiguity panel.
- Added explicit/inferred badges and confidence badges.
- Visually highlighted low-confidence or ambiguous generated items.

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

- Analyze PRD from UI: complete.
- Refresh page and confirm draft persistence: complete.
- Verify draft data is stored in Supabase PostgreSQL: complete.

### Completed Saturday 4:
- Added ambiguity detection for vague wording, mixed scope, unclear ownership, non-testable outcomes, and missing non-functional details.
- Added explicit/inferred labels.
- Added High/Medium/Low confidence scoring.
- Added rationale/basis lines under generated items.
- Persisted trust metadata in Supabase.
- Added ambiguity panel on /prd.
- Added trust metadata badges and visual highlighting.
- Verified the ambiguity panel appears after analyzing a new PRD.

### What is working:
- PRD analysis from browser.
- Saved backlog draft reload.
- Ambiguity warnings.
- Explicit/Inferred badges.
- Confidence badges.
- Rationale lines.
- Trust metadata persistence.

### Next target:
Saturday 5 - Editable backlog draft plus preview/create Azure DevOps items from UI.

## Hosted validation notes

- Frontend target: Vercel.
- Backend target: Railway.
- Database target: Supabase PostgreSQL.
- For Railway to Supabase connectivity, prefer the Supabase pooler connection string when IPv6 direct connection causes deployment/runtime connection failures.
- Run `src/db/migrations/0004_trust_metadata.sql` in Supabase before testing new Saturday 4 analyses.
- Existing Saturday 3 drafts can still load only if their stored `draft_json` already has trust metadata. Re-analyze a PRD after running the Saturday 4 migration to generate fully trusted metadata.

## Known gaps intentionally deferred

- Editable backlog drafts are deferred to Saturday 5.
- Azure DevOps backlog preview/create from saved draft is deferred to Saturday 5.
- RAG, pgvector, document ingestion, embeddings, and retrieval context are deferred to Saturday 6.
- PR review browser page is deferred to Saturday 7.
- Traceability page is deferred to Saturday 8.