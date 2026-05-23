import type { PullRequestChangedFile, PullRequestContextResponse } from "../schemas/pr";
import type {
  PullRequestReviewDraft,
  ReviewCriterionAssessment
} from "../schemas/review";
import { getPgPool } from "./database";

export interface SelectedPrContext {
  repoId: string;
  repoName: string;
  prId: number;
  prTitle: string;
}

export interface ReviewRunRecord {
  id: string;
  repoId: string;
  repoName: string;
  prId: number;
  prTitle: string;
  prStatus: string;
  prAuthor: string;
  sourceBranch: string;
  targetBranch: string;
  prUrl: string;
  reviewStatus: string;
  summary: string;
  linkedWorkItemIds: number[];
  changedFiles: PullRequestChangedFile[];
  commentPreview: string | null;
  commentPosted: boolean;
  commentThreadId: number | null;
  commentUrl: string | null;
  assessments: ReviewAssessmentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewAssessmentRecord {
  id: string;
  reviewRunId: string;
  workItemId: number | null;
  workItemTitle: string;
  localBacklogItemId: string;
  acceptanceCriterionId: string;
  acceptanceCriterionText: string;
  status: string;
  evidence: string[];
  missingEvidence: string[];
  rationale: string;
  confidence: string;
  requirementIds: string[];
  createdAt: string;
}

export interface ReviewWorkItemForAssessment {
  id: number | null;
  title: string;
  localBacklogItemId: string;
  requirementIds: string[];
  acceptanceCriteria: Array<{
    id: string;
    text: string;
    storyId?: string;
  }>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = asNumber(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function asIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : asString(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isInteger(item))
    : [];
}

function asChangedFiles(value: unknown): PullRequestChangedFile[] {
  return Array.isArray(value) ? (value as PullRequestChangedFile[]) : [];
}

function mapAssessment(row: Record<string, unknown>): ReviewAssessmentRecord {
  return {
    id: asString(row.id),
    reviewRunId: asString(row.review_run_id),
    workItemId: asNullableNumber(row.work_item_id),
    workItemTitle: asString(row.work_item_title),
    localBacklogItemId: asString(row.local_backlog_item_id),
    acceptanceCriterionId: asString(row.acceptance_criterion_id),
    acceptanceCriterionText: asString(row.acceptance_criterion_text),
    status: asString(row.status),
    evidence: asStringArray(row.evidence),
    missingEvidence: asStringArray(row.missing_evidence),
    rationale: asString(row.rationale),
    confidence: asString(row.confidence),
    requirementIds: asStringArray(row.requirement_ids),
    createdAt: asIsoString(row.created_at)
  };
}

function mapReviewRun(
  row: Record<string, unknown>,
  assessments: ReviewAssessmentRecord[]
): ReviewRunRecord {
  return {
    id: asString(row.id),
    repoId: asString(row.repo_id),
    repoName: asString(row.repo_name),
    prId: asNumber(row.pr_id),
    prTitle: asString(row.pr_title),
    prStatus: asString(row.pr_status),
    prAuthor: asString(row.pr_author),
    sourceBranch: asString(row.source_branch),
    targetBranch: asString(row.target_branch),
    prUrl: asString(row.pr_url),
    reviewStatus: asString(row.review_status),
    summary: asString(row.summary),
    linkedWorkItemIds: asNumberArray(row.linked_work_item_ids),
    changedFiles: asChangedFiles(row.changed_files),
    commentPreview: row.comment_preview === null || row.comment_preview === undefined ? null : asString(row.comment_preview),
    commentPosted: Boolean(row.comment_posted),
    commentThreadId: asNullableNumber(row.comment_thread_id),
    commentUrl: row.comment_url === null || row.comment_url === undefined ? null : asString(row.comment_url),
    assessments,
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at)
  };
}

export async function getSelectedPrContext(): Promise<SelectedPrContext | null> {
  const result = await getPgPool().query(
    `select selected_repo_id, selected_repo_name, last_pr_id, last_pr_title
     from workspace
     where singleton_key = 'single-pm-pilot'
     limit 1`
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  const repoId = asString(row.selected_repo_id);
  const repoName = asString(row.selected_repo_name);
  const prId = asNullableNumber(row.last_pr_id);

  if (!repoId || !prId) {
    return null;
  }

  return {
    repoId,
    repoName,
    prId,
    prTitle: asString(row.last_pr_title)
  };
}

export async function getReviewWorkItemsForLinkedIds(
  linkedWorkItemIds: number[]
): Promise<ReviewWorkItemForAssessment[]> {
  if (linkedWorkItemIds.length === 0) {
    return [];
  }

  const result = await getPgPool().query(
    `select
       wim.ado_work_item_id,
       wim.local_id,
       wim.requirement_ids,
       bi.title as work_item_title,
       ac.external_id as criterion_id,
       ac.text as criterion_text,
       ac.story_external_id
     from work_item_mapping wim
     left join backlog_item bi
       on bi.draft_id = wim.draft_id
      and bi.external_id = wim.local_id
      and bi.item_type = 'issue'
     left join acceptance_criterion ac
       on ac.draft_id = wim.draft_id
      and ac.story_external_id = wim.local_id
      and ac.is_deleted = false
     where wim.ado_work_item_id = any($1::int[])
     order by wim.ado_work_item_id asc, ac.sort_order asc`,
    [linkedWorkItemIds]
  );

  const grouped = new Map<string, ReviewWorkItemForAssessment>();

  for (const row of result.rows as Record<string, unknown>[]) {
    const localId = asString(row.local_id);
    const adoId = asNullableNumber(row.ado_work_item_id);
    const key = `${adoId || "local"}-${localId}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: adoId,
        title: asString(row.work_item_title),
        localBacklogItemId: localId,
        requirementIds: asStringArray(row.requirement_ids),
        acceptanceCriteria: []
      });
    }

    const criterionId = asString(row.criterion_id);
    const criterionText = asString(row.criterion_text);

    if (criterionId && criterionText) {
      grouped.get(key)?.acceptanceCriteria.push({
        id: criterionId,
        text: criterionText,
        storyId: asString(row.story_external_id)
      });
    }
  }

  return Array.from(grouped.values()).filter((item) => item.acceptanceCriteria.length > 0);
}

export async function createReviewRun(params: {
  context: PullRequestContextResponse;
  changedFiles: PullRequestChangedFile[];
  review: PullRequestReviewDraft;
}): Promise<ReviewRunRecord> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const runResult = await client.query(
      `insert into pr_review_run (
         repo_id,
         repo_name,
         pr_id,
         pr_title,
         pr_status,
         pr_author,
         source_branch,
         target_branch,
         pr_url,
         review_status,
         summary,
         linked_work_item_ids,
         changed_files
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'generated', $10, $11::jsonb, $12::jsonb)
       returning id, repo_id, repo_name, pr_id, pr_title, pr_status, pr_author, source_branch,
                 target_branch, pr_url, review_status, summary, linked_work_item_ids, changed_files,
                 comment_preview, comment_posted, comment_thread_id, comment_url, created_at, updated_at`,
      [
        params.context.repoId,
        params.context.repoName,
        params.context.prId,
        params.context.prTitle,
        params.context.prStatus,
        params.context.prAuthor,
        params.context.sourceBranch,
        params.context.targetBranch,
        params.context.prUrl,
        params.review.summary,
        JSON.stringify(params.context.linkedWorkItemIds),
        JSON.stringify(params.changedFiles)
      ]
    );

    const reviewRunId = asString(runResult.rows[0].id);
    const assessments: ReviewAssessmentRecord[] = [];

    for (const item of params.review.checklist) {
      const assessmentResult = await client.query(
        `insert into review_assessment (
           review_run_id,
           work_item_id,
           work_item_title,
           local_backlog_item_id,
           acceptance_criterion_id,
           acceptance_criterion_text,
           status,
           evidence,
           missing_evidence,
           rationale,
           confidence,
           requirement_ids
         ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb)
         returning id, review_run_id, work_item_id, work_item_title, local_backlog_item_id,
                   acceptance_criterion_id, acceptance_criterion_text, status, evidence, missing_evidence,
                   rationale, confidence, requirement_ids, created_at`,
        [
          reviewRunId,
          item.workItemId,
          item.workItemTitle,
          item.localBacklogItemId,
          item.criterionId,
          item.criterion,
          item.status,
          JSON.stringify(item.evidence),
          JSON.stringify(item.missingEvidence),
          item.rationale,
          item.confidence,
          JSON.stringify(item.requirementIds)
        ]
      );

      assessments.push(mapAssessment(assessmentResult.rows[0]));
    }

    await client.query("commit");

    return mapReviewRun(runResult.rows[0], assessments);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getReviewRun(reviewRunId: string): Promise<ReviewRunRecord | null> {
  const pool = getPgPool();

  const runResult = await pool.query(
    `select id, repo_id, repo_name, pr_id, pr_title, pr_status, pr_author, source_branch,
            target_branch, pr_url, review_status, summary, linked_work_item_ids, changed_files,
            comment_preview, comment_posted, comment_thread_id, comment_url, created_at, updated_at
     from pr_review_run
     where id = $1
     limit 1`,
    [reviewRunId]
  );

  if (!runResult.rows[0]) {
    return null;
  }

  const assessmentResult = await pool.query(
    `select id, review_run_id, work_item_id, work_item_title, local_backlog_item_id,
            acceptance_criterion_id, acceptance_criterion_text, status, evidence, missing_evidence,
            rationale, confidence, requirement_ids, created_at
     from review_assessment
     where review_run_id = $1
     order by created_at asc`,
    [reviewRunId]
  );

  return mapReviewRun(runResult.rows[0], assessmentResult.rows.map(mapAssessment));
}

export async function saveCommentPreview(params: {
  reviewRunId: string;
  comment: string;
}): Promise<ReviewRunRecord> {
  const result = await getPgPool().query(
    `update pr_review_run
     set comment_preview = $2,
         review_status = 'comment_previewed',
         updated_at = now()
     where id = $1
     returning id`,
    [params.reviewRunId, params.comment]
  );

  if (!result.rows[0]) {
    throw new Error("Review run was not found.");
  }

  const run = await getReviewRun(params.reviewRunId);

  if (!run) {
    throw new Error("Review run was not found.");
  }

  return run;
}

export async function savePostedComment(params: {
  reviewRunId: string;
  repoId: string;
  prId: number;
  commentBody: string;
  threadId: number;
  threadUrl: string;
}): Promise<ReviewRunRecord> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const existing = await client.query(
      `select id
       from comment_posting
       where review_run_id = $1
       limit 1`,
      [params.reviewRunId]
    );

    if (existing.rows[0]) {
      throw new Error("A comment was already posted for this review run.");
    }

    await client.query(
      `insert into comment_posting (
         review_run_id,
         repo_id,
         pr_id,
         comment_body,
         thread_id,
         thread_url
       ) values ($1, $2, $3, $4, $5, $6)`,
      [
        params.reviewRunId,
        params.repoId,
        params.prId,
        params.commentBody,
        params.threadId,
        params.threadUrl
      ]
    );

    await client.query(
      `update pr_review_run
       set comment_posted = true,
           comment_thread_id = $2,
           comment_url = $3,
           review_status = 'comment_posted',
           updated_at = now()
       where id = $1`,
      [params.reviewRunId, params.threadId, params.threadUrl]
    );

    await client.query("commit");

    const run = await getReviewRun(params.reviewRunId);

    if (!run) {
      throw new Error("Review run was not found after posting comment.");
    }

    return run;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}