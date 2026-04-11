# Session 5 demo flow: PRD to Boards

This is the repeatable end-to-end chat-layer flow for Session 5.

## Goal

From one chat conversation, you should be able to:
1. ingest a PRD,
2. turn it into a stable backlog,
3. preview Azure DevOps work item creation,
4. get explicit approval,
5. create the sandbox items.

## Preconditions

- `GET /api/health` works on Railway.
- `POST /api/prd/parse` returns a valid backlog bundle.
- `POST /api/backlog/execute?mode=dry_run` returns exact Epic and Story payload previews.
- `POST /api/backlog/execute?mode=execute` already works manually with the approval header.
- `openapi/gateway.yaml` is loaded into the action-capable GPT.
- The action config injects the approval header at execution time rather than asking for it in chat.

## Happy path

### 1. User provides a PRD
The user pastes a PRD or asks to use the default golden PRD.

Expected assistant behavior:
- briefly summarize the PRD,
- state that it will parse the PRD into a backlog bundle,
- call `/prd/parse`.

### 2. Assistant summarizes the parsed backlog
Expected summary shape:
- PRD title
- requirement count
- epic count
- story count
- risk count

This is still read-only reasoning.

### 3. Assistant previews work item creation
The assistant calls `/backlog/execute?mode=dry_run` using the parsed backlog.

Expected preview summary:
- target Azure DevOps project
- exact Epic and Story counts
- representative Epic titles
- representative Story titles
- clear statement that no items have been created yet

### 4. Assistant asks for approval
Use one explicit question only. Example:

> The dry run is ready and no writes have happened yet. Confirm when you want me to create these sandbox items.

### 5. Assistant executes the write after approval
The assistant calls `/backlog/execute?mode=execute`.

Expected result summary:
- number of created Epics
- number of created Stories
- created work item ids or URLs
- mapping file location

## Manual fallback

If the action layer is flaky, use the same architecture manually.

### Step A: generate backlog JSON in chat
Have ChatGPT produce the backlog bundle JSON.

### Step B: preview manually
Send the JSON to the gateway:

```bash
curl -X POST "https://spec-to-ship-production.up.railway.app/api/backlog/execute?mode=dry_run&run_id=demo-20260411-s5" \
  -H "Content-Type: application/json" \
  -d @samples/backlog-reference.json