import { getPgPool } from "./database";

export interface WorkspaceSettings {
  id?: string;
  orgUrl: string;
  project: string;
  defaultRepo: string;
  selectedRepoId: string;
  selectedRepoName: string;
  lastPrId: number | null;
  lastPrTitle: string;
  epicWorkItemType: string;
  issueWorkItemType: string;
  defaultBranch: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecentPrSummary {
  id: string;
  repoId: string;
  repoName: string;
  prId: number;
  prTitle: string;
  createdAt: string;
}

export interface RecentPrdSummary {
  id: string;
  prdId: string;
  title: string;
  createdAt: string;
}

const WORKSPACE_KEY = "single-pm-pilot";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return asString(value);
}

function normalizeOrgUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function mapWorkspaceRow(row: Record<string, unknown>): WorkspaceSettings {
  return {
    id: asString(row.id),
    orgUrl: asString(row.org_url),
    project: asString(row.project),
    defaultRepo: asString(row.default_repo),
    selectedRepoId: asString(row.selected_repo_id),
    selectedRepoName: asString(row.selected_repo_name),
    lastPrId: asOptionalNumber(row.last_pr_id),
    lastPrTitle: asString(row.last_pr_title),
    epicWorkItemType: asString(row.epic_work_item_type) || "Epic",
    issueWorkItemType: asString(row.issue_work_item_type) || "Issue",
    defaultBranch: asString(row.default_branch) || "main",
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at)
  };
}

function mapRecentPrRow(row: Record<string, unknown>): RecentPrSummary {
  return {
    id: asString(row.id),
    repoId: asString(row.repo_id),
    repoName: asString(row.repo_name),
    prId: asOptionalNumber(row.pr_id) || 0,
    prTitle: asString(row.pr_title),
    createdAt: asIsoString(row.created_at)
  };
}

function mapRecentPrdRow(row: Record<string, unknown>): RecentPrdSummary {
  return {
    id: asString(row.id),
    prdId: asString(row.prd_id),
    title: asString(row.title),
    createdAt: asIsoString(row.created_at)
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
    selectedRepoId: asString(body.selectedRepoId),
    selectedRepoName: asString(body.selectedRepoName),
    lastPrId: asOptionalNumber(body.lastPrId),
    lastPrTitle: asString(body.lastPrTitle),
    epicWorkItemType: asString(body.epicWorkItemType) || "Epic",
    issueWorkItemType: asString(body.issueWorkItemType) || "Issue",
    defaultBranch: asString(body.defaultBranch) || "main"
  };
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const result = await getPgPool().query(
    `select
       id,
       org_url,
       project,
       default_repo,
       selected_repo_id,
       selected_repo_name,
       last_pr_id,
       last_pr_title,
       epic_work_item_type,
       issue_work_item_type,
       default_branch,
       created_at,
       updated_at
     from workspace
     where singleton_key = $1
     limit 1`,
    [WORKSPACE_KEY]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapWorkspaceRow(result.rows[0]);
}

async function insertRecentPrIfSelected(settings: WorkspaceSettings): Promise<void> {
  if (!settings.selectedRepoId || !settings.lastPrId) {
    return;
  }

  await getPgPool().query(
    `insert into recent_pr (
       repo_id,
       repo_name,
       pr_id,
       pr_title
     ) values ($1, $2, $3, $4)`,
    [
      settings.selectedRepoId,
      settings.selectedRepoName,
      settings.lastPrId,
      settings.lastPrTitle
    ]
  );
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
       selected_repo_id,
       selected_repo_name,
       last_pr_id,
       last_pr_title,
       epic_work_item_type,
       issue_work_item_type,
       default_branch
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (singleton_key) do update set
       org_url = excluded.org_url,
       project = excluded.project,
       default_repo = excluded.default_repo,
       selected_repo_id = excluded.selected_repo_id,
       selected_repo_name = excluded.selected_repo_name,
       last_pr_id = excluded.last_pr_id,
       last_pr_title = excluded.last_pr_title,
       epic_work_item_type = excluded.epic_work_item_type,
       issue_work_item_type = excluded.issue_work_item_type,
       default_branch = excluded.default_branch,
       updated_at = now()
     returning
       id,
       org_url,
       project,
       default_repo,
       selected_repo_id,
       selected_repo_name,
       last_pr_id,
       last_pr_title,
       epic_work_item_type,
       issue_work_item_type,
       default_branch,
       created_at,
       updated_at`,
    [
      WORKSPACE_KEY,
      settings.orgUrl,
      settings.project,
      settings.defaultRepo,
      settings.selectedRepoId,
      settings.selectedRepoName,
      settings.lastPrId,
      settings.lastPrTitle,
      settings.epicWorkItemType,
      settings.issueWorkItemType,
      settings.defaultBranch
    ]
  );

  const saved = mapWorkspaceRow(result.rows[0]);
  await insertRecentPrIfSelected(saved);

  return saved;
}

export async function listRecentPrs(limit = 5): Promise<RecentPrSummary[]> {
  const result = await getPgPool().query(
    `select
       id,
       repo_id,
       repo_name,
       pr_id,
       pr_title,
       created_at
     from recent_pr
     order by created_at desc
     limit $1`,
    [limit]
  );

  return result.rows.map(mapRecentPrRow);
}

export async function listRecentPrds(limit = 5): Promise<RecentPrdSummary[]> {
  const result = await getPgPool().query(
    `select
       id,
       prd_id,
       title,
       created_at
     from recent_prd
     order by created_at desc
     limit $1`,
    [limit]
  );

  return result.rows.map(mapRecentPrdRow);
}