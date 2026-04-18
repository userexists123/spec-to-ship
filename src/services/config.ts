import { resolve } from "node:path";

function readFirstDefinedEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function resolveAuditLogPath(): string {
  const explicitPath = readFirstDefinedEnv("AUDIT_LOG_PATH", "STS_AUDIT_LOG_PATH");

  if (explicitPath) {
    return explicitPath;
  }

  const isHosted = Boolean(readFirstDefinedEnv("RAILWAY_ENVIRONMENT", "RAILWAY_PROJECT_ID"));

  if (isHosted) {
    return "/tmp/spec-to-ship/audit.jsonl";
  }

  return "./data/audit.jsonl";
}

function resolveDemoFixtureDir(): string {
  const explicitPath = readFirstDefinedEnv("DEMO_FIXTURE_DIR", "STS_DEMO_FIXTURE_DIR");

  if (explicitPath) {
    return explicitPath;
  }

  return resolve(process.cwd(), "samples", "demo");
}

export function getAppConfig() {
  const demoModeValue = readFirstDefinedEnv("DEMO_MODE", "STS_DEMO_MODE");

  return {
    environment: readFirstDefinedEnv("APP_ENV", "NODE_ENV", "RAILWAY_ENVIRONMENT") || "sandbox",
    logLevel: readFirstDefinedEnv("LOG_LEVEL", "STS_LOG_LEVEL") || "info",
    azdoOrgUrl:
      readFirstDefinedEnv("AZDO_ORG_URL", "AZURE_DEVOPS_ORG_URL", "ADO_ORG_URL") ||
      "https://dev.azure.com/agentic-booth",
    azdoProject:
      readFirstDefinedEnv("AZDO_PROJECT", "AZURE_DEVOPS_PROJECT", "ADO_PROJECT") ||
      "Spec to Ship Sandbox",
    azdoPat: readFirstDefinedEnv("AZDO_PAT", "AZURE_DEVOPS_PAT", "ADO_PAT"),
    executeApprovalToken:
      readFirstDefinedEnv(
        "EXECUTE_APPROVAL_TOKEN",
        "APPROVAL_TOKEN",
        "STS_EXECUTE_APPROVAL_TOKEN"
      ) || "",
    auditLogPath: resolveAuditLogPath(),
    defaultPrdPath:
      readFirstDefinedEnv("DEFAULT_PRD_PATH", "STS_DEFAULT_PRD_PATH") ||
      resolve(process.cwd(), "samples", "prd-golden.md"),
    defaultBacklogPath:
      readFirstDefinedEnv("DEFAULT_BACKLOG_PATH", "STS_DEFAULT_BACKLOG_PATH") ||
      resolve(process.cwd(), "samples", "backlog-reference.json"),
    backlogMappingPath:
      readFirstDefinedEnv("BACKLOG_MAPPING_PATH", "STS_BACKLOG_MAPPING_PATH") ||
      resolve(process.cwd(), "data", "backlog-mappings.json"),
    epicWorkItemType:
      readFirstDefinedEnv(
        "AZDO_EPIC_WORK_ITEM_TYPE",
        "AZURE_DEVOPS_EPIC_WORK_ITEM_TYPE",
        "ADO_EPIC_WORK_ITEM_TYPE"
      ) || "Epic",
    storyWorkItemType:
      readFirstDefinedEnv(
        "AZDO_STORY_WORK_ITEM_TYPE",
        "AZURE_DEVOPS_STORY_WORK_ITEM_TYPE",
        "ADO_STORY_WORK_ITEM_TYPE"
      ) || "Issue",
    demoMode: demoModeValue ? parseBoolean(demoModeValue) : false,
    demoFixtureDir: resolveDemoFixtureDir()
  };
}