# Pilot Decisions

## Product direction

- Build Spec-to-Ship as a single-PM browser-first pilot product.
- The browser UI is the primary interface.
- The custom GPT flow is secondary and optional.
- Do not add authentication, users, teams, or role management in the pilot branch.

## Hosting direction

- Frontend is hosted on Vercel.
- Backend is hosted on Railway.
- Persistent database is Supabase PostgreSQL.
- Railway backend connects to Supabase PostgreSQL through `DATABASE_URL`.
- Use the Supabase pooler/IPv4-compatible connection string for Railway when direct IPv6 connectivity is unreliable.

## Azure DevOps direction

- Azure DevOps REST APIs remain the only external ALM integration for this pilot.
- Pilot work item types are:
  - Epic
  - Issue
- Workspace settings store the Azure DevOps organization URL, project, default repo, selected repo, selected PR, work item mapping, and default branch.
- Preview before write remains mandatory for workflows that create or update Azure DevOps data.

## Saturday 1 decisions

- Added Supabase/Postgres persistence for the single workspace record.
- Added live Azure DevOps repository loading from saved workspace settings.
- Kept the existing Azure Functions backend structure instead of introducing a new backend framework.
- Kept fake/demo behavior out of the pilot workspace and repo-loading flow.

## Saturday 2 decisions

- Extended workspace persistence with selected repository and last selected pull request.
- Added recent pull request history.
- Added live Azure DevOps pull request loading by repository.
- Added dashboard-level repo and PR selectors.
- Kept PR selection as an explicit save action so the PM can inspect the selection before persisting it.

## Saturday 3 decisions

- Added persisted PRD documents using the `prd_document` table.
- Added persisted generated backlog drafts using the `backlog_draft` table.
- Added normalized draft support tables:
  - `backlog_item`
  - `acceptance_criterion`
  - `risk_item`
- Kept the generated draft source as the current deterministic parser.
- Did not add LLM orchestration, agent frameworks, embeddings, RAG, or editable draft behavior in Saturday 3.
- Added `/prd` as the browser-first PRD paste/upload and analysis page.
- Added saved draft reload using `/prd?draftId=<draft-id>`.