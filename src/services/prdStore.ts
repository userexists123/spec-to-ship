import { BacklogBundle, TrustMetadata } from "../schemas/backlog";
import { PoolClient } from "pg";
import { getPgPool } from "./database";

export interface PrdDocumentRecord {
  id: string;
  title: string;
  rawText: string;
  createdAt: string;
  updatedAt: string;
}

export interface BacklogDraftRecord {
  id: string;
  prdDocumentId: string;
  title: string;
  status: string;
  draft: BacklogBundle;
  createdAt: string;
  updatedAt: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : asString(value);
}

function asBacklogBundle(value: unknown): BacklogBundle {
  return value as BacklogBundle;
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

function mapBacklogDraft(row: Record<string, unknown>): BacklogDraftRecord {
  return {
    id: asString(row.id),
    prdDocumentId: asString(row.prd_document_id),
    title: asString(row.title),
    status: asString(row.status),
    draft: asBacklogBundle(row.draft_json),
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at)
  };
}

function trustValues(trust: TrustMetadata): [string, string, string, string] {
  return [
    trust.evidence_label,
    trust.confidence,
    trust.rationale,
    JSON.stringify(trust.warnings)
  ];
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

export async function createPrdDocument(input: {
  title: string;
  rawText: string;
}): Promise<PrdDocumentRecord> {
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

async function replaceNormalizedDraftRows(
  client: PoolClient,
  draftId: string,
  backlog: BacklogBundle
): Promise<void> {
  for (const [index, requirement] of backlog.requirements.entries()) {
    await client.query(
      `insert into backlog_item (
         draft_id,
         item_type,
         external_id,
         parent_external_id,
         title,
         summary,
         priority,
         requirement_ids,
         source_refs,
         evidence_label,
         confidence,
         rationale,
         warnings,
         sort_order
       ) values (
         $1,
         'requirement',
         $2,
         '',
         $3,
         $4,
         $5,
         $6::jsonb,
         $7::jsonb,
         $8,
         $9,
         $10,
         $11::jsonb,
         $12
       )`,
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
         draft_id,
         item_type,
         external_id,
         parent_external_id,
         title,
         summary,
         priority,
         requirement_ids,
         source_refs,
         evidence_label,
         confidence,
         rationale,
         warnings,
         sort_order
       ) values (
         $1,
         'epic',
         $2,
         '',
         $3,
         $4,
         '',
         $5::jsonb,
         $6::jsonb,
         $7,
         $8,
         $9,
         $10::jsonb,
         $11
       )`,
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
         draft_id,
         item_type,
         external_id,
         parent_external_id,
         title,
         summary,
         priority,
         requirement_ids,
         source_refs,
         evidence_label,
         confidence,
         rationale,
         warnings,
         sort_order
       ) values (
         $1,
         'issue',
         $2,
         $3,
         $4,
         $5,
         '',
         $6::jsonb,
         $7::jsonb,
         $8,
         $9,
         $10,
         $11::jsonb,
         $12
       )`,
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
           draft_id,
           story_external_id,
           external_id,
           text,
           evidence_label,
           confidence,
           rationale,
           warnings,
           sort_order
         ) values (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8::jsonb,
           $9
         )`,
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
         draft_id,
         external_id,
         title,
         severity,
         related_requirement_ids,
         mitigation_note,
         evidence_label,
         confidence,
         rationale,
         warnings,
         sort_order
       ) values (
         $1,
         $2,
         $3,
         $4,
         $5::jsonb,
         $6,
         $7,
         $8,
         $9,
         $10::jsonb,
         $11
       )`,
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

export async function createGeneratedDraft(input: {
  prdDocumentId: string;
  backlog: BacklogBundle;
}): Promise<BacklogDraftRecord> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `insert into backlog_draft (
         prd_document_id,
         title,
         status,
         draft_json,
         ambiguity_warnings
       ) values (
         $1,
         $2,
         'generated',
         $3::jsonb,
         $4::jsonb
       )
       returning id, prd_document_id, title, status, draft_json, created_at, updated_at`,
      [
        input.prdDocumentId,
        input.backlog.title,
        JSON.stringify(input.backlog),
        JSON.stringify(input.backlog.ambiguity_warnings)
      ]
    );

    const draft = mapBacklogDraft(result.rows[0]);

    await client.query(
      `insert into recent_prd (prd_id, title)
       values ($1, $2)`,
      [input.prdDocumentId, input.backlog.title]
    );

    await replaceNormalizedDraftRows(client, draft.id, input.backlog);
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
  const result = await getPgPool().query(
    `select id, prd_document_id, title, status, draft_json, created_at, updated_at
     from backlog_draft
     where id = $1
     limit 1`,
    [id]
  );

  return result.rows[0] ? mapBacklogDraft(result.rows[0]) : null;
}