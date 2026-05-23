import { getPgPool } from "./database";

export interface TraceabilityWorkItem {
  localId: string;
  workItemType: "Epic" | "Issue";
  title: string;
  summary: string;
  requirementIds: string[];
  adoWorkItemId: number | null;
  adoUrl: string;
  parentLocalId: string | null;
  parentAdoWorkItemId: number | null;
}

export interface TraceabilityReviewAssessment {
  acceptanceCriterionId: string;
  acceptanceCriterionText: string;
  localBacklogItemId: string;
  workItemId: number | null;
  status: string;
  confidence: string;
  evidence: string[];
  missingEvidence: string[];
  rationale: string;
}

export interface TraceabilityChain {
  requirementId: string;
  requirementTitle: string;
  requirementSummary: string;
  epicLocalIds: string[];
  issueLocalIds: string[];
  adoWorkItemIds: number[];
  acceptanceCriteria: Array<{
    id: string;
    text: string;
    issueLocalId: string;
  }>;
  reviewAssessments: TraceabilityReviewAssessment[];
  status: "covered" | "partial" | "not_evident" | "not_reviewed";
}

export interface TraceabilitySnapshotPayload {
  title: string;
  summary: string;
  customerReleaseNotes: string;
  internalReleaseNotes: string;
  generatedAt: string;
  latestDraft: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  latestReview: {
    id: string;
    prId: number;
    prTitle: string;
    repoName: string;
    reviewStatus: string;
    commentPosted: boolean;
    createdAt: string;
  } | null;
  workItems: TraceabilityWorkItem[];
  chains: TraceabilityChain[];
  sourceCounts: {
    requirements: number;
    epics: number;
    issues: number;
    acceptanceCriteria: number;
    mappedWorkItems: number;
    reviewAssessments: number;
  };
}

export interface TraceabilitySnapshotRecord extends TraceabilitySnapshotPayload {
  id: string;
  createdAt: string;
}

interface RequirementRow {
  external_id: string;
  title: string;
  summary: string;
}

interface BacklogItemRow {
  external_id: string;
  item_type: string;
  parent_external_id: string;
  title: string;
  summary: string;
  requirement_ids: unknown;
}

interface AcceptanceCriterionRow {
  external_id: string;
  story_external_id: string;
  text: string;
}

interface WorkItemMappingRow {
  local_id: string;
  work_item_type: string;
  ado_work_item_id: number;
  ado_url: string;
  parent_local_id: string | null;
  parent_ado_work_item_id: number | null;
  requirement_ids: unknown;
}

interface ReviewAssessmentRow {
  acceptance_criterion_id: string;
  acceptance_criterion_text: string;
  local_backlog_item_id: string;
  work_item_id: number | null;
  status: string;
  confidence: string;
  evidence: unknown;
  missing_evidence: unknown;
  rationale: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function asIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : asString(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
  return Array.from(
    new Set(values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)))
  );
}

function determineChainStatus(assessments: TraceabilityReviewAssessment[]): TraceabilityChain["status"] {
  if (assessments.length === 0) {
    return "not_reviewed";
  }

  if (assessments.every((assessment) => assessment.status === "met" || assessment.status === "not_applicable")) {
    return "covered";
  }

  if (assessments.some((assessment) => assessment.status === "met" || assessment.status === "partial")) {
    return "partial";
  }

  return "not_evident";
}

function buildCustomerReleaseNotes(chains: TraceabilityChain[]): string {
  const covered = chains.filter((chain) => chain.status === "covered");
  const partial = chains.filter((chain) => chain.status === "partial");
  const notEvident = chains.filter((chain) => chain.status === "not_evident");
  const notReviewed = chains.filter((chain) => chain.status === "not_reviewed");
  const lines = [
    "# Customer-facing release notes",
    "",
    covered.length > 0
      ? `This release includes ${covered.length} requirement${covered.length === 1 ? "" : "s"} with PR evidence marked as covered.`
      : "No requirements are currently marked as fully covered by PR evidence.",
    ""
  ];

  if (covered.length > 0) {
    lines.push("## Included improvements");
    for (const chain of covered.slice(0, 8)) {
      lines.push(`- ${chain.requirementTitle}`);
    }
    lines.push("");
  }

  if (partial.length > 0 || notEvident.length > 0 || notReviewed.length > 0) {
    lines.push("## Notes");
    if (partial.length > 0) {
      lines.push(`- ${partial.length} requirement${partial.length === 1 ? "" : "s"} have partial PR evidence.`);
    }
    if (notEvident.length > 0) {
      lines.push(`- ${notEvident.length} requirement${notEvident.length === 1 ? "" : "s"} have no visible PR evidence yet.`);
    }
    if (notReviewed.length > 0) {
      lines.push(`- ${notReviewed.length} requirement${notReviewed.length === 1 ? "" : "s"} have not been reviewed against a PR yet.`);
    }
  }

  return lines.join("\n").trim();
}

function buildInternalReleaseNotes(params: {
  chains: TraceabilityChain[];
  workItems: TraceabilityWorkItem[];
  latestDraft: TraceabilitySnapshotPayload["latestDraft"];
  latestReview: TraceabilitySnapshotPayload["latestReview"];
}): string {
  const mapped = params.workItems.filter((item) => item.adoWorkItemId);
  const covered = params.chains.filter((chain) => chain.status === "covered").length;
  const partial = params.chains.filter((chain) => chain.status === "partial").length;
  const notEvident = params.chains.filter((chain) => chain.status === "not_evident").length;
  const notReviewed = params.chains.filter((chain) => chain.status === "not_reviewed").length;
  const lines = [
    "# Internal release notes",
    "",
    `Latest draft: ${params.latestDraft ? `${params.latestDraft.title} (${params.latestDraft.status})` : "none"}`,
    `Latest review: ${params.latestReview ? `PR ${params.latestReview.prId} - ${params.latestReview.prTitle}` : "none"}`,
    `Mapped Azure DevOps work items: ${mapped.length}`,
    "",
    "## Requirement coverage",
    `- Covered: ${covered}`,
    `- Partial: ${partial}`,
    `- Not evident: ${notEvident}`,
    `- Not reviewed: ${notReviewed}`,
    "",
    "## Traceability chains"
  ];

  for (const chain of params.chains.slice(0, 12)) {
    lines.push(
      `- ${chain.requirementId}: ${chain.status}; Epics ${chain.epicLocalIds.join(", ") || "none"}; Issues ${chain.issueLocalIds.join(", ") || "none"}; ADO ${chain.adoWorkItemIds.join(", ") || "none"}.`
    );
  }

  return lines.join("\n").trim();
}

function mapSnapshotRecord(row: Record<string, unknown>): TraceabilitySnapshotRecord {
  const payload = row.snapshot_json as TraceabilitySnapshotPayload;

  return {
    ...payload,
    id: asString(row.id),
    createdAt: asIsoString(row.created_at)
  };
}

export async function createTraceabilitySnapshot(): Promise<TraceabilitySnapshotRecord> {
  const pool = getPgPool();
  const latestDraftResult = await pool.query(
    `select id, title, status, created_at, updated_at
     from backlog_draft
     order by updated_at desc
     limit 1`
  );
  const latestDraftRow = latestDraftResult.rows[0] as Record<string, unknown> | undefined;

  if (!latestDraftRow) {
    const emptySnapshot: TraceabilitySnapshotPayload = {
      title: "Traceability snapshot",
      summary: "No backlog draft exists yet.",
      customerReleaseNotes: "No release notes are available because no backlog draft exists yet.",
      internalReleaseNotes: "No internal release notes are available because no backlog draft exists yet.",
      generatedAt: new Date().toISOString(),
      latestDraft: null,
      latestReview: null,
      workItems: [],
      chains: [],
      sourceCounts: {
        requirements: 0,
        epics: 0,
        issues: 0,
        acceptanceCriteria: 0,
        mappedWorkItems: 0,
        reviewAssessments: 0
      }
    };

    return insertTraceabilitySnapshot(emptySnapshot);
  }

  const draftId = asString(latestDraftRow.id);
  const latestReviewResult = await pool.query(
    `select id, pr_id, pr_title, repo_name, review_status, comment_posted, created_at
     from pr_review_run
     order by created_at desc
     limit 1`
  );
  const latestReviewRow = latestReviewResult.rows[0] as Record<string, unknown> | undefined;

  const requirementsResult = await pool.query<RequirementRow>(
    `select external_id, title, summary
     from backlog_item
     where draft_id = $1 and item_type = 'requirement' and is_deleted = false
     order by sort_order asc`,
    [draftId]
  );
  const backlogItemsResult = await pool.query<BacklogItemRow>(
    `select external_id, item_type, parent_external_id, title, summary, requirement_ids
     from backlog_item
     where draft_id = $1 and item_type in ('epic', 'issue') and is_deleted = false
     order by sort_order asc`,
    [draftId]
  );
  const criteriaResult = await pool.query<AcceptanceCriterionRow>(
    `select external_id, story_external_id, text
     from acceptance_criterion
     where draft_id = $1 and is_deleted = false
     order by sort_order asc`,
    [draftId]
  );
  const mappingsResult = await pool.query<WorkItemMappingRow>(
    `select local_id, work_item_type, ado_work_item_id, ado_url, parent_local_id,
            parent_ado_work_item_id, requirement_ids
     from work_item_mapping
     where draft_id = $1
     order by created_at asc`,
    [draftId]
  );
  const assessmentsResult = await pool.query<ReviewAssessmentRow>(
    `select acceptance_criterion_id, acceptance_criterion_text, local_backlog_item_id,
            work_item_id, status, confidence, evidence, missing_evidence, rationale
     from review_assessment
     where review_run_id = (
       select id from pr_review_run order by created_at desc limit 1
     )
     order by created_at asc`
  );

  const mappingsByLocalId = new Map<string, WorkItemMappingRow>();
  for (const mapping of mappingsResult.rows) {
    mappingsByLocalId.set(mapping.local_id, mapping);
  }

  const workItems: TraceabilityWorkItem[] = backlogItemsResult.rows.map((item) => {
    const mapping = mappingsByLocalId.get(item.external_id);

    return {
      localId: item.external_id,
      workItemType: item.item_type === "epic" ? "Epic" : "Issue",
      title: item.title,
      summary: item.summary,
      requirementIds: asStringArray(item.requirement_ids),
      adoWorkItemId: mapping?.ado_work_item_id ?? null,
      adoUrl: mapping?.ado_url ?? "",
      parentLocalId: mapping?.parent_local_id ?? (item.parent_external_id || null),
      parentAdoWorkItemId: mapping?.parent_ado_work_item_id ?? null
    };
  });

  const assessments: TraceabilityReviewAssessment[] = assessmentsResult.rows.map((assessment) => ({
    acceptanceCriterionId: assessment.acceptance_criterion_id,
    acceptanceCriterionText: assessment.acceptance_criterion_text,
    localBacklogItemId: assessment.local_backlog_item_id,
    workItemId: assessment.work_item_id,
    status: assessment.status,
    confidence: assessment.confidence,
    evidence: asStringArray(assessment.evidence),
    missingEvidence: asStringArray(assessment.missing_evidence),
    rationale: assessment.rationale
  }));

  const chains: TraceabilityChain[] = requirementsResult.rows.map((requirement) => {
    const epics = backlogItemsResult.rows.filter(
      (item) => item.item_type === "epic" && asStringArray(item.requirement_ids).includes(requirement.external_id)
    );
    const issues = backlogItemsResult.rows.filter(
      (item) => item.item_type === "issue" && asStringArray(item.requirement_ids).includes(requirement.external_id)
    );
    const criteria = criteriaResult.rows.filter((criterion) =>
      issues.some((issue) => issue.external_id === criterion.story_external_id)
    );
    const chainAssessments = assessments.filter((assessment) =>
      criteria.some((criterion) => criterion.external_id === assessment.acceptanceCriterionId)
    );
    const issueMappings = issues.map((issue) => mappingsByLocalId.get(issue.external_id));

    return {
      requirementId: requirement.external_id,
      requirementTitle: requirement.title,
      requirementSummary: requirement.summary,
      epicLocalIds: epics.map((epic) => epic.external_id),
      issueLocalIds: issues.map((issue) => issue.external_id),
      adoWorkItemIds: uniqueNumbers(issueMappings.map((mapping) => mapping?.ado_work_item_id)),
      acceptanceCriteria: criteria.map((criterion) => ({
        id: criterion.external_id,
        text: criterion.text,
        issueLocalId: criterion.story_external_id
      })),
      reviewAssessments: chainAssessments,
      status: determineChainStatus(chainAssessments)
    };
  });

  const latestDraft = {
    id: draftId,
    title: asString(latestDraftRow.title),
    status: asString(latestDraftRow.status),
    createdAt: asIsoString(latestDraftRow.created_at),
    updatedAt: asIsoString(latestDraftRow.updated_at)
  };
  const latestReview = latestReviewRow
    ? {
        id: asString(latestReviewRow.id),
        prId: asNumber(latestReviewRow.pr_id),
        prTitle: asString(latestReviewRow.pr_title),
        repoName: asString(latestReviewRow.repo_name),
        reviewStatus: asString(latestReviewRow.review_status),
        commentPosted: Boolean(latestReviewRow.comment_posted),
        createdAt: asIsoString(latestReviewRow.created_at)
      }
    : null;
  const sourceCounts = {
    requirements: requirementsResult.rows.length,
    epics: backlogItemsResult.rows.filter((item) => item.item_type === "epic").length,
    issues: backlogItemsResult.rows.filter((item) => item.item_type === "issue").length,
    acceptanceCriteria: criteriaResult.rows.length,
    mappedWorkItems: mappingsResult.rows.length,
    reviewAssessments: assessments.length
  };
  const customerReleaseNotes = buildCustomerReleaseNotes(chains);
  const internalReleaseNotes = buildInternalReleaseNotes({ chains, workItems, latestDraft, latestReview });
  const snapshot: TraceabilitySnapshotPayload = {
    title: `Traceability snapshot - ${latestDraft.title}`,
    summary: `Generated traceability for ${sourceCounts.requirements} requirements, ${sourceCounts.issues} issues, ${sourceCounts.mappedWorkItems} mapped Azure DevOps work items, and ${sourceCounts.reviewAssessments} review assessments.`,
    customerReleaseNotes,
    internalReleaseNotes,
    generatedAt: new Date().toISOString(),
    latestDraft,
    latestReview,
    workItems,
    chains,
    sourceCounts
  };

  return insertTraceabilitySnapshot(snapshot);
}

export async function insertTraceabilitySnapshot(
  snapshot: TraceabilitySnapshotPayload
): Promise<TraceabilitySnapshotRecord> {
  const result = await getPgPool().query(
    `insert into traceability_snapshot (
       title, summary, customer_release_notes, internal_release_notes, snapshot_json, source_counts
     ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     returning id, snapshot_json, created_at`,
    [
      snapshot.title,
      snapshot.summary,
      snapshot.customerReleaseNotes,
      snapshot.internalReleaseNotes,
      JSON.stringify(snapshot),
      JSON.stringify(snapshot.sourceCounts)
    ]
  );

  return mapSnapshotRecord(result.rows[0]);
}

export async function getLatestTraceabilitySnapshot(): Promise<TraceabilitySnapshotRecord | null> {
  const result = await getPgPool().query(
    `select id, snapshot_json, created_at
     from traceability_snapshot
     order by created_at desc
     limit 1`
  );

  return result.rows[0] ? mapSnapshotRecord(result.rows[0]) : null;
}

export async function getTraceabilitySnapshot(id: string): Promise<TraceabilitySnapshotRecord | null> {
  const result = await getPgPool().query(
    `select id, snapshot_json, created_at
     from traceability_snapshot
     where id = $1
     limit 1`,
    [id]
  );

  return result.rows[0] ? mapSnapshotRecord(result.rows[0]) : null;
}