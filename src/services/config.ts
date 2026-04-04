export function getAppConfig() {
  return {
    environment: process.env.APP_ENV || "sandbox",
    logLevel: process.env.LOG_LEVEL || "info",
    azdoOrgUrl: process.env.AZDO_ORG_URL || "",
    azdoProject: process.env.AZDO_PROJECT || "",
    executeApprovalToken: process.env.EXECUTE_APPROVAL_TOKEN || "",
    auditLogPath: process.env.AUDIT_LOG_PATH || "./data/audit.jsonl"
  };
}