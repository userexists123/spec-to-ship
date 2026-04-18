# Session 10 demo script and fallback mode

This runbook is for the hosted Railway deployment and the custom GPT action flow.

## Goal

Demonstrate the full prototype in 8 to 10 minutes:
1. PRD parsing
2. backlog dry run
3. backlog execute
4. PR context and changes
5. review draft
6. PR comment preview and execute
7. release notes and traceability

## Environment checklist

Set these on Railway before the live run:

- `APP_ENV=production`
- `AZDO_ORG_URL=...`
- `AZDO_PROJECT=...`
- `AZDO_PAT=...`
- `EXECUTE_APPROVAL_TOKEN=...`
- `DEMO_MODE=false`

Optional aliases now supported if your Railway names differ:
http://localhost:7071
- `AZURE_DEVOPS_ORG_URL`
- `AZURE_DEVOPS_PROJECT`
- `AZURE_DEVOPS_PAT`
- `APPROVAL_TOKEN`
- `STS_DEMO_MODE`

For fallback mode, switch only this value:

- `DEMO_MODE=true`

## Hosted smoke checks

Replace the base URL first:

```bash
BASE_URL="https://your-service.up.railway.app/api"