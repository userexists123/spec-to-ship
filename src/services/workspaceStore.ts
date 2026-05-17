import { getPgPool } from "./database";

export interface WorkspaceSettings {
  id?: string;
  orgUrl: string;
  project: string;
  defaultRepo: string;
  epicWorkItemType: string;
  issueWorkItemType: string;
  defaultBranch: string;
  createdAt?: string;
  updatedAt?: string;
}

const WORKSPACE_KEY = "single-pm-pilot";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrgUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function mapRow(row: Record<string, unknown>): WorkspaceSettings {
  return {
    id: asString(row.id),
    orgUrl: asString(row.org_url),
    project: asString(row.project),
    defaultRepo: asString(row.default_repo),
    epicWorkItemType: asString(row.epic_work_item_type) || "Epic",
    issueWorkItemType: asString(row.issue_work_item_type) || "Issue",
    defaultBranch: asString(row.default_branch) || "main",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : asString(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : asString(row.updated_at)
  };
}

export function parseWorkspaceSettings(body: Record<string, unknown>): WorkspaceSettings {
  const orgUrl = normalizeOrgUrl(asString(body.orgUrl));
  const project = asString(body.project);

  if (!orgUrl) {
    throw new Error("orgUrl is required.");
  }

  if (!project) {
    throw new Error("project is required.");
  }

  return {
    orgUrl,
    project,
    defaultRepo: asString(body.defaultRepo),
    epicWorkItemType: asString(body.epicWorkItemType) || "Epic",
    issueWorkItemType: asString(body.issueWorkItemType) || "Issue",
    defaultBranch: asString(body.defaultBranch) || "main"
  };
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const result = await getPgPool().query(
    `select id, org_url, project, default_repo, epic_work_item_type, issue_work_item_type, default_branch, created_at, updated_at
     from workspace
     where singleton_key = $1
     limit 1`,
    [WORKSPACE_KEY]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapRow(result.rows[0]);
}

export async function upsertWorkspaceSettings(
  settings: WorkspaceSettings
): Promise<WorkspaceSettings> {
  const result = await getPgPool().query(
    `insert into workspace (
       singleton_key,
       org_url,
       project,
       default_repo,
       epic_work_item_type,
       issue_work_item_type,
       default_branch
     ) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (singleton_key) do update set
       org_url = excluded.org_url,
       project = excluded.project,
       default_repo = excluded.default_repo,
       epic_work_item_type = excluded.epic_work_item_type,
       issue_work_item_type = excluded.issue_work_item_type,
       default_branch = excluded.default_branch,
       updated_at = now()
     returning id, org_url, project, default_repo, epic_work_item_type, issue_work_item_type, default_branch, created_at, updated_at`,
    [
      WORKSPACE_KEY,
      settings.orgUrl,
      settings.project,
      settings.defaultRepo,
      settings.epicWorkItemType,
      settings.issueWorkItemType,
      settings.defaultBranch
    ]
  );

  return mapRow(result.rows[0]);
}