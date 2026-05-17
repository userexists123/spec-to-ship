# Spec-to-Ship Pilot Plan

This branch follows the Saturday pilot build plan for converting the current MVP into a single-PM browser product.

## Pilot constraints

- Single-user PM workspace only.
- No auth, user accounts, roles, or admin console in this phase.
- Browser UI is the primary interface.
- Azure DevOps work item types are Epic and Issue.
- No fake or hardcoded pilot outputs.
- Retrieval-augmented generation only when RAG starts; no agent framework.
- Saved repo, project, and PR context is mandatory.
- Preview before Azure DevOps writes remains mandatory.

## Saturday 1 scope

- Add `web/` Next.js app foundation.
- Add Supabase Postgres persistence for workspace settings.
- Add `workspace`, `recent_pr`, and `recent_prd` schema foundation.
- Add `GET /workspace`, `PUT /workspace`, and `GET /repos`.
- Load live Azure DevOps repositories from saved workspace settings.