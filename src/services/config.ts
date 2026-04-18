export function getAppConfig() {
  return {
    environment: process.env.APP_ENV || "sandbox",
    logLevel: process.env.LOG_LEVEL || "info",
    azdoOrgUrl: process.env.AZDO_ORG_URL || "",
    azdoProject: process.env.AZDO_PROJECT || "",
    azdoPat: process.env.AZDO_PAT || "",
    executeApprovalToken: process.env.EXECUTE_APPROVAL_TOKEN || "",
    auditLogPath: process.env.AUDIT_LOG_PATH || "./data/audit.jsonl",
    defaultPrdPath: process.env.DEFAULT_PRD_PATH || "./samples/prd-golden.md",
    defaultBacklogPath: process.env.DEFAULT_BACKLOG_PATH || "./samples/backlog-reference.json",
    backlogMappingPath: process.env.BACKLOG_MAPPING_PATH || "./data/backlog-mappings.json",
    epicWorkItemType: process.env.AZDO_EPIC_WORK_ITEM_TYPE || "Epic",
    storyWorkItemType: process.env.AZDO_STORY_WORK_ITEM_TYPE || "Issue"
  };
}