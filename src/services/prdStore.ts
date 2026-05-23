import { BacklogBundle, TrustMetadata } from "../schemas/backlog";
import { PoolClient } from "pg";
import { getPgPool } from "./database";
import { RetrievedContextSource } from "./ragStore";

export interface PrdDocumentRecord {
  id: string;
  title: string;
  rawText: string;
  createdAt: string;
  updatedAt: string;
}

export interface BacklogPreviewRecord {
  runId: string;
  project: string;
  itemCount: number;
  epicCount: number;
  issueCount: number;
  items: Array<{
    localId: string;
    parentLocalId?: string;
    workItemType: string;
    title: string;
    description: string;
    requirementIds: string[];
    patch: Array<{
      op: "add";
      path: string;
      value: unknown;
    }>;
  }>;
}

export interface BacklogExecutionRecord {
  runId: string;
  project: string;
  createdCount: number;
  createdItems: Array<{
    localId: string;
    workItemType: string;
    adoWorkItemId: number;
    adoUrl: string;
    parentLocalId: string | null;
    parentAdoWorkItemId: number | null;
    requirementIds: string[];
  }>;
}

export interface WorkItemMappingRecord {
  id: string;
  draftId: string;
  runId: string;
  localId: string;
  workItemType: string;
  adoWorkItemId: number;
  adoUrl: string;
  parentLocalId: string | null;
  parentAdoWorkItemId: number | null;
  requirementIds: string[];
  createdAt: string;
}

export interface BacklogDraftRecord {
  id: string;
  prdDocumentId: string;
  title: string;
  status: string;
  draft: BacklogBundle;
  preview: BacklogPreviewRecord | null;
  execution: BacklogExecutionRecord | null;
  retrievedSources: RetrievedContextSource[];
  lastPreviewedAt: string | null;
  lastExecutedAt: string | null;
  mappings: WorkItemMappingRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemMappingInput {
  runId: string;
  localId: string;
  workItemType: string;
  adoWorkItemId: number;
  adoUrl: string;
  parentLocalId?: string | null;
  parentAdoWorkItemId?: number | null;
  requirementIds: string[];
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

  return asNumber(value);
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return asString(value);
}

function asIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : asString(value);
}

function asNullableIsoString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return asIsoString(value);
}

function asBacklogBundle(value: unknown): BacklogBundle {
  return value as BacklogBundle;
}

function asPreview(value: unknown): BacklogPreviewRecord | null {
  return value ? (value as BacklogPreviewRecord) : null;
}

function asExecution(value: unknown): BacklogExecutionRecord | null {
  return value ? (value as BacklogExecutionRecord) : null;
}

function asRetrievedSources(value: unknown): RetrievedContextSource[] {
  return Array.isArray(value) ? (value as RetrievedContextSource[]) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function inferTitleFromText(prdText: string): string {
  const titleMatch =
    prdText.match(/^\s*PRD\s*Title\s*:\s*(.+)$/im) ||
    prdText.match(/^\s*Title\s*:\s*(.+)$/im) ||
    prdText.match(/^\s*#\s+(.+)$/m);

  return titleMatch?.[1]?.trim() || "Untitled PRD";
}

function mapPrdDocument(row: Record<string, unknown>): PrdDocumentRecord {
  return {
    id: asString(row.id),
    title: asString(row.title),
    rawText: asString(row.raw_text),
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at)
  };
}

function mapWorkItemMapping(row: Record<string, unknown>): WorkItemMappingRecord {
  return {
    id: asString(row.id),
    draftId: asString(row.draft_id),
    runId: asString(row.run_id),
    localId: asString(row.local_id),
    workItemType: asString(row.work_item_type),
    adoWorkItemId: asNumber(row.ado_work_item_id),
    adoUrl: asString(row.ado_url),
    parentLocalId: asNullableString(row.parent_local_id),
    parentAdoWorkItemId: asNullableNumber(row.parent_ado_work_item_id),
    requirementIds: asStringArray(row.requirement_ids),
    createdAt: asIsoString(row.created_at)
  };
}

function mapRetrievedSource(row: Record<string, unknown>): RetrievedContextSource {
  return {
    sourceDocumentId: asString(row.source_document_id),
    sourceChunkId: asString(row.source_chunk_id),
    sourceType: row.source_type as RetrievedContextSource["sourceType"],
    title: asString(row.title),
    excerpt: asString(row.excerpt),
    similarity: asNumber(row.similarity),
    rank: asNumber(row.rank)
  };
}

function mapBacklogDraft(
  row: Record<string, unknown>,
  mappings: WorkItemMappingRecord[] = [],
  retrievedSources?: RetrievedContextSource[]
): BacklogDraftRecord {
  return {
    id: asString(row.id),
    prdDocumentId: asString(row.prd_document_id),
    title: asString(row.title),
    status: asString(row.status),
    draft: asBacklogBundle(row.draft_json),
    preview: asPreview(row.preview_json),
    execution: asExecution(row.execution_json),
    retrievedSources: retrievedSources ?? asRetrievedSources(row.retrieved_context_json),
    lastPreviewedAt: asNullableIsoString(row.last_previewed_at),
    lastExecutedAt: asNullableIsoString(row.last_executed_at),
    mappings,
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at)
  };
}

function trustValues(trust: TrustMetadata): [string, string, string, string] {
  return [trust.evidence_label, trust.confidence, trust.rationale, JSON.stringify(trust.warnings)];
}

function assertObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function hasValidTrust(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const trust = value as TrustMetadata;
  return (
    (trust.evidence_label === "explicit" || trust.evidence_label === "inferred") &&
    (trust.confidence === "High" || trust.confidence === "Medium" || trust.confidence === "Low") &&
    typeof trust.rationale === "string" &&
    Array.isArray(trust.warnings)
  );
}

function validateBacklogShape(backlog: BacklogBundle): void {
  if (!backlog || typeof backlog !== "object") {
    throw new Error("backlog must be an object.");
  }

  if (!backlog.prd_id || !backlog.title) {
    throw new Error("backlog.prd_id and backlog.title are required.");
  }

  if (
    !Array.isArray(backlog.requirements) ||
    !Array.isArray(backlog.epics) ||
    !Array.isArray(backlog.stories) ||
    !Array.isArray(backlog.risks) ||
    !Array.isArray(backlog.ambiguity_warnings)
  ) {
    throw new Error("backlog must include requirements, epics, stories, risks, and ambiguity_warnings arrays.");
  }

  for (const requirement of backlog.requirements) {
    if (!requirement.id || !requirement.title || !requirement.summary || !hasValidTrust(requirement.trust)) {
      throw new Error("Each requirement must include id, title, summary, and trust metadata.");
    }
  }

  for (const epic of backlog.epics) {
    if (!epic.id || !epic.title || !Array.isArray(epic.requirement_ids) || !hasValidTrust(epic.trust)) {
      throw new Error("Each epic must include id, title, requirement_ids, and trust metadata.");
    }
  }

  for (const story of backlog.stories) {
    if (
      !story.id ||
      !story.epic_id ||
      !story.title ||
      !Array.isArray(story.requirement_ids) ||
      !Array.isArray(story.acceptance_criteria) ||
      !hasValidTrust(story.trust)
    ) {
      throw new Error("Each issue must include id, epic_id, title, requirement_ids, acceptance_criteria, and trust metadata.");
    }

    for (const criterion of story.acceptance_criteria) {
      if (!criterion.id || !criterion.story_id || !criterion.text || !hasValidTrust(criterion.trust)) {
        throw new Error("Each acceptance criterion must include id, story_id, text, and trust metadata.");
      }
    }
  }
}

export function parsePrdCreateBody(body: Record<string, unknown>): { title: string; rawText: string } {
  const rawText = typeof body.prdText === "string" ? body.prdText.trim() : "";
  const providedTitle = typeof body.title === "string" ? body.title.trim() : "";

  if (!rawText) {
    throw new Error("prdText is required.");
  }

  return {
    title: providedTitle || inferTitleFromText(rawText),
    rawText
  };
}

export function parseBacklogDraftUpdateBody(body: Record<string, unknown>): BacklogBundle {
  const backlogBody = assertObject(body.backlog, "backlog");
  const backlog = backlogBody as unknown as BacklogBundle;

  validateBacklogShape(backlog);

  return backlog;
}

export async function createPrdDocument(input: { title: string; rawText: string }): Promise<PrdDocumentRecord> {
  const result = await getPgPool().query(
    `insert into prd_document (title, raw_text)
     values ($1, $2)
     returning id, title, raw_text, created_at, updated_at`,
    [input.title, input.rawText]
  );

  return mapPrdDocument(result.rows[0]);
}

export async function getPrdDocument(id: string): Promise<PrdDocumentRecord | null> {
  const result = await getPgPool().query(
    `select id, title, raw_text, created_at, updated_at
     from prd_document
     where id = $1
     limit 1`,
    [id]
  );

  return result.rows[0] ? mapPrdDocument(result.rows[0]) : null;
}

async function replaceNormalizedDraftRows(client: PoolClient, draftId: string, backlog: BacklogBundle): Promise<void> {
  await client.query(`delete from risk_item where draft_id = $1`, [draftId]);
  await client.query(`delete from acceptance_criterion where draft_id = $1`, [draftId]);
  await client.query(`delete from backlog_item where draft_id = $1`, [draftId]);

  for (const [index, requirement] of backlog.requirements.entries()) {
    await client.query(
      `insert into backlog_item (
         draft_id, item_type, external_id, parent_external_id, title, summary, priority,
         requirement_ids, source_refs, evidence_label, confidence, rationale, warnings, sort_order
       ) values ($1, 'requirement', $2, '', $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11::jsonb, $12)`,
      [
        draftId,
        requirement.id,
        requirement.title,
        requirement.summary,
        requirement.priority,
        JSON.stringify([requirement.id]),
        JSON.stringify(requirement.source_refs),
        ...trustValues(requirement.trust),
        index
      ]
    );
  }

  for (const [index, epic] of backlog.epics.entries()) {
    await client.query(
      `insert into backlog_item (
         draft_id, item_type, external_id, parent_external_id, title, summary, priority,
         requirement_ids, source_refs, evidence_label, confidence, rationale, warnings, sort_order
       ) values ($1, 'epic', $2, '', $3, $4, '', $5::jsonb, $6::jsonb, $7, $8, $9, $10::jsonb, $11)`,
      [
        draftId,
        epic.id,
        epic.title,
        epic.summary,
        JSON.stringify(epic.requirement_ids),
        JSON.stringify(epic.source_refs),
        ...trustValues(epic.trust),
        index
      ]
    );
  }

  for (const [index, story] of backlog.stories.entries()) {
    await client.query(
      `insert into backlog_item (
         draft_id, item_type, external_id, parent_external_id, title, summary, priority,
         requirement_ids, source_refs, evidence_label, confidence, rationale, warnings, sort_order
       ) values ($1, 'issue', $2, $3, $4, $5, '', $6::jsonb, $7::jsonb, $8, $9, $10, $11::jsonb, $12)`,
      [
        draftId,
        story.id,
        story.epic_id,
        story.title,
        story.summary,
        JSON.stringify(story.requirement_ids),
        JSON.stringify(story.source_refs),
        ...trustValues(story.trust),
        index
      ]
    );

    for (const [criterionIndex, criterion] of story.acceptance_criteria.entries()) {
      await client.query(
        `insert into acceptance_criterion (
           draft_id, story_external_id, external_id, text, evidence_label, confidence, rationale, warnings, sort_order
         ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          draftId,
          story.id,
          criterion.id,
          criterion.text,
          ...trustValues(criterion.trust),
          criterionIndex
        ]
      );
    }
  }

  for (const [index, risk] of backlog.risks.entries()) {
    await client.query(
      `insert into risk_item (
         draft_id, external_id, title, severity, related_requirement_ids, mitigation_note,
         evidence_label, confidence, rationale, warnings, sort_order
       ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11)`,
      [
        draftId,
        risk.id,
        risk.title,
        risk.severity,
        JSON.stringify(risk.related_requirement_ids),
        risk.mitigation_note,
        ...trustValues(risk.trust),
        index
      ]
    );
  }
}

async function insertDraftRetrievalSources(
  client: PoolClient,
  draftId: string,
  retrievedSources: RetrievedContextSource[]
): Promise<void> {
  await client.query(`delete from draft_retrieval_source where draft_id = $1`, [draftId]);

  for (const source of retrievedSources) {
    await client.query(
      `insert into draft_retrieval_source (
         draft_id,
         source_document_id,
         source_chunk_id,
         source_type,
         title,
         excerpt,
         similarity,
         rank
       ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        draftId,
        source.sourceDocumentId,
        source.sourceChunkId,
        source.sourceType,
        source.title,
        source.excerpt,
        source.similarity,
        source.rank
      ]
    );
  }
}

export async function createGeneratedDraft(input: {
  prdDocumentId: string;
  backlog: BacklogBundle;
  retrievedSources?: RetrievedContextSource[];
}): Promise<BacklogDraftRecord> {
  const pool = getPgPool();
  const client = await pool.connect();
  const retrievedSources = input.retrievedSources || [];

  try {
    await client.query("begin");

    const result = await client.query(
      `insert into backlog_draft (
         prd_document_id, title, status, draft_json, ambiguity_warnings, retrieved_context_json
       ) values ($1, $2, 'generated', $3::jsonb, $4::jsonb, $5::jsonb)
       returning id, prd_document_id, title, status, draft_json, preview_json, execution_json,
                 retrieved_context_json, last_previewed_at, last_executed_at, created_at, updated_at`,
      [
        input.prdDocumentId,
        input.backlog.title,
        JSON.stringify(input.backlog),
        JSON.stringify(input.backlog.ambiguity_warnings),
        JSON.stringify(retrievedSources)
      ]
    );

    const draft = mapBacklogDraft(result.rows[0], [], retrievedSources);

    await client.query(
      `insert into recent_prd (prd_id, title)
       values ($1, $2)`,
      [input.prdDocumentId, input.backlog.title]
    );

    await replaceNormalizedDraftRows(client, draft.id, input.backlog);
    await insertDraftRetrievalSources(client, draft.id, retrievedSources);
    await client.query("commit");

    return draft;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getBacklogDraft(id: string): Promise<BacklogDraftRecord | null> {
  const pool = getPgPool();

  const draftResult = await pool.query(
    `select id, prd_document_id, title, status, draft_json, preview_json, execution_json,
            retrieved_context_json, last_previewed_at, last_executed_at, created_at, updated_at
     from backlog_draft
     where id = $1
     limit 1`,
    [id]
  );

  if (!draftResult.rows[0]) {
    return null;
  }

  const mappingResult = await pool.query(
    `select id, draft_id, run_id, local_id, work_item_type, ado_work_item_id, ado_url,
            parent_local_id, parent_ado_work_item_id, requirement_ids, created_at
     from work_item_mapping
     where draft_id = $1
     order by created_at asc`,
    [id]
  );

  const retrievalResult = await pool.query(
    `select source_document_id, source_chunk_id, source_type, title, excerpt, similarity, rank
     from draft_retrieval_source
     where draft_id = $1
     order by rank asc`,
    [id]
  );

  const retrievedSources =
    retrievalResult.rows.length > 0
      ? retrievalResult.rows.map(mapRetrievedSource)
      : asRetrievedSources(draftResult.rows[0].retrieved_context_json);

  return mapBacklogDraft(draftResult.rows[0], mappingResult.rows.map(mapWorkItemMapping), retrievedSources);
}

export async function updateBacklogDraft(input: {
  draftId: string;
  backlog: BacklogBundle;
}): Promise<BacklogDraftRecord> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const existing = await client.query(
      `select id
       from backlog_draft
       where id = $1
       limit 1`,
      [input.draftId]
    );

    if (!existing.rows[0]) {
      throw new Error("Backlog draft was not found.");
    }

    const result = await client.query(
      `update backlog_draft
       set title = $2,
           status = 'edited',
           draft_json = $3::jsonb,
           ambiguity_warnings = $4::jsonb,
           preview_json = null,
           execution_json = null,
           last_previewed_at = null,
           last_executed_at = null,
           updated_at = now()
       where id = $1
       returning id, prd_document_id, title, status, draft_json, preview_json, execution_json,
                 retrieved_context_json, last_previewed_at, last_executed_at, created_at, updated_at`,
      [input.draftId, input.backlog.title, JSON.stringify(input.backlog), JSON.stringify(input.backlog.ambiguity_warnings)]
    );

    await replaceNormalizedDraftRows(client, input.draftId, input.backlog);
    await client.query("commit");

    return mapBacklogDraft(result.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveDraftPreview(input: {
  draftId: string;
  preview: BacklogPreviewRecord;
}): Promise<void> {
  await getPgPool().query(
    `update backlog_draft
     set status = 'previewed',
         preview_json = $2::jsonb,
         last_previewed_at = now(),
         updated_at = now()
     where id = $1`,
    [input.draftId, JSON.stringify(input.preview)]
  );
}

export async function saveDraftExecution(input: {
  draftId: string;
  execution: BacklogExecutionRecord;
}): Promise<void> {
  await getPgPool().query(
    `update backlog_draft
     set status = 'executed',
         execution_json = $2::jsonb,
         last_executed_at = now(),
         updated_at = now()
     where id = $1`,
    [input.draftId, JSON.stringify(input.execution)]
  );
}

export async function insertWorkItemMappings(input: {
  draftId: string;
  mappings: WorkItemMappingInput[];
}): Promise<WorkItemMappingRecord[]> {
  const pool = getPgPool();
  const inserted: WorkItemMappingRecord[] = [];

  for (const mapping of input.mappings) {
    const result = await pool.query(
      `insert into work_item_mapping (
         draft_id, run_id, local_id, work_item_type, ado_work_item_id, ado_url,
         parent_local_id, parent_ado_work_item_id, requirement_ids
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       returning id, draft_id, run_id, local_id, work_item_type, ado_work_item_id, ado_url,
                 parent_local_id, parent_ado_work_item_id, requirement_ids, created_at`,
      [
        input.draftId,
        mapping.runId,
        mapping.localId,
        mapping.workItemType,
        mapping.adoWorkItemId,
        mapping.adoUrl,
        mapping.parentLocalId ?? null,
        mapping.parentAdoWorkItemId ?? null,
        JSON.stringify(mapping.requirementIds)
      ]
    );

    inserted.push(mapWorkItemMapping(result.rows[0]));
  }

  return inserted;
}