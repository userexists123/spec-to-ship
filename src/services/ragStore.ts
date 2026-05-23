import { BacklogBundle, SourceReference } from "../schemas/backlog";
import { getAppConfig } from "./config";
import { getPgPool } from "./database";
import { createEmbedding, toPgVectorLiteral } from "./embeddingService";

export type SourceType =
  | "prior_prd"
  | "ado_work_item"
  | "accepted_backlog"
  | "architecture_doc"
  | "convention_doc";

export interface SourceDocumentInput {
  sourceType: SourceType;
  title: string;
  content: string;
  externalUrl: string;
  metadata: Record<string, unknown>;
}

export interface SourceDocumentSummary {
  id: string;
  sourceType: SourceType;
  title: string;
  externalUrl: string;
  status: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RetrievedContextSource {
  sourceDocumentId: string;
  sourceChunkId: string;
  sourceType: SourceType;
  title: string;
  excerpt: string;
  similarity: number;
  rank: number;
}

const WORKSPACE_KEY = "single-pm-pilot";
const SOURCE_TYPES: SourceType[] = [
  "prior_prd",
  "ado_work_item",
  "accepted_backlog",
  "architecture_doc",
  "convention_doc"
];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function asIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : asString(value);
}

function asSourceType(value: unknown): SourceType {
  const sourceType = asString(value) as SourceType;

  if (!SOURCE_TYPES.includes(sourceType)) {
    throw new Error(
      "sourceType must be one of prior_prd, ado_work_item, accepted_backlog, architecture_doc, convention_doc."
    );
  }

  return sourceType;
}

function asMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function mapSourceDocument(row: Record<string, unknown>): SourceDocumentSummary {
  return {
    id: asString(row.id),
    sourceType: asSourceType(row.source_type),
    title: asString(row.title),
    externalUrl: asString(row.external_url),
    status: asString(row.status),
    chunkCount: asNumber(row.chunk_count),
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at)
  };
}

function mapRetrievedSource(row: Record<string, unknown>, rankFallback: number): RetrievedContextSource {
  return {
    sourceDocumentId: asString(row.source_document_id),
    sourceChunkId: asString(row.source_chunk_id),
    sourceType: asSourceType(row.source_type),
    title: asString(row.title),
    excerpt: asString(row.excerpt),
    similarity: asNumber(row.similarity),
    rank: Number.isFinite(asNumber(row.rank)) ? asNumber(row.rank) : rankFallback
  };
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function normalizeContent(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function splitIntoChunks(content: string): string[] {
  const normalized = normalizeContent(content);
  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs.length > 0 ? paragraphs : [normalized]) {
    if ((current + "\n\n" + paragraph).trim().length <= 1800) {
      current = (current ? `${current}\n\n${paragraph}` : paragraph).trim();
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length <= 1800) {
      current = paragraph;
      continue;
    }

    for (let index = 0; index < paragraph.length; index += 1800) {
      chunks.push(paragraph.slice(index, index + 1800).trim());
    }

    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.slice(0, 80);
}

function buildRetrievalQuery(prdText: string): string {
  const lines = prdText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .slice(0, 60);

  return lines.join("\n").slice(0, 8000) || prdText.slice(0, 8000);
}

function buildGroundingSourceRefs(retrievedSources: RetrievedContextSource[]): SourceReference[] {
  return retrievedSources.slice(0, 3).map((source) => ({
    section: `Retrieved ${source.sourceType}: ${source.title}`,
    excerpt: source.excerpt
  }));
}

export function parseSourceDocumentBody(body: Record<string, unknown>): SourceDocumentInput {
  const sourceType = asSourceType(body.sourceType);
  const title = asString(body.title);
  const content = asString(body.content);
  const externalUrl = asString(body.externalUrl);

  if (!title) {
    throw new Error("title is required.");
  }

  if (!content) {
    throw new Error("content is required.");
  }

  return {
    sourceType,
    title,
    content,
    externalUrl,
    metadata: asMetadata(body.metadata)
  };
}

export async function ingestSourceDocument(input: SourceDocumentInput): Promise<SourceDocumentSummary> {
  const chunks = splitIntoChunks(input.content);

  if (chunks.length === 0) {
    throw new Error("Source content did not produce any chunks.");
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const documentResult = await client.query(
      `insert into source_document (
         workspace_key,
         source_type,
         title,
         content,
         external_url,
         metadata,
         status,
         chunk_count
       ) values ($1, $2, $3, $4, $5, $6::jsonb, 'indexing', $7)
       returning id, source_type, title, external_url, status, chunk_count, created_at, updated_at`,
      [
        WORKSPACE_KEY,
        input.sourceType,
        input.title,
        input.content,
        input.externalUrl,
        JSON.stringify(input.metadata),
        chunks.length
      ]
    );

    const documentId = asString(documentResult.rows[0].id);

    for (const [index, chunk] of chunks.entries()) {
      const embedding = await createEmbedding(chunk);

      await client.query(
        `insert into source_chunk (
           source_document_id,
           chunk_index,
           content,
           token_estimate,
           embedding,
           metadata
         ) values ($1, $2, $3, $4, $5::vector, $6::jsonb)`,
        [
          documentId,
          index,
          chunk,
          estimateTokens(chunk),
          toPgVectorLiteral(embedding),
          JSON.stringify({ sourceType: input.sourceType, title: input.title })
        ]
      );
    }

    const updatedResult = await client.query(
      `update source_document
       set status = 'indexed',
           chunk_count = $2,
           updated_at = now()
       where id = $1
       returning id, source_type, title, external_url, status, chunk_count, created_at, updated_at`,
      [documentId, chunks.length]
    );

    await client.query("commit");

    return mapSourceDocument(updatedResult.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listSourceDocuments(): Promise<SourceDocumentSummary[]> {
  const result = await getPgPool().query(
    `select id, source_type, title, external_url, status, chunk_count, created_at, updated_at
     from source_document
     where workspace_key = $1
     order by created_at desc
     limit 50`,
    [WORKSPACE_KEY]
  );

  return result.rows.map(mapSourceDocument);
}

export async function retrieveContextForPrd(prdText: string): Promise<RetrievedContextSource[]> {
  const query = buildRetrievalQuery(prdText);
  const config = getAppConfig();
  const embedding = await createEmbedding(query);
  const embeddingLiteral = toPgVectorLiteral(embedding);

  const result = await getPgPool().query(
    `select
       sd.id as source_document_id,
       sc.id as source_chunk_id,
       sd.source_type,
       sd.title,
       sc.content as excerpt,
       greatest(0, 1 - (sc.embedding <=> $1::vector)) as similarity,
       row_number() over (order by sc.embedding <=> $1::vector asc) as rank
     from source_chunk sc
     join source_document sd on sd.id = sc.source_document_id
     where sd.workspace_key = $2
       and sd.status = 'indexed'
     order by sc.embedding <=> $1::vector asc
     limit $3`,
    [embeddingLiteral, WORKSPACE_KEY, config.ragMatchCount]
  );

  return result.rows.map((row, index) => mapRetrievedSource(row, index + 1));
}

export function groundBacklogWithRetrievedContext(
  backlog: BacklogBundle,
  retrievedSources: RetrievedContextSource[]
): BacklogBundle {
  if (retrievedSources.length === 0) {
    return backlog;
  }

  const groundingRefs = buildGroundingSourceRefs(retrievedSources);
  const groundingBasis = ` Retrieved context used: ${retrievedSources
    .slice(0, 3)
    .map((source) => `${source.sourceType}/${source.title}`)
    .join("; ")}.`;

  return {
    ...backlog,
    requirements: backlog.requirements.map((requirement) => ({
      ...requirement,
      source_refs: [...requirement.source_refs, ...groundingRefs],
      trust: {
        ...requirement.trust,
        rationale: `${requirement.trust.rationale}${groundingBasis}`
      }
    })),
    epics: backlog.epics.map((epic) => ({
      ...epic,
      source_refs: [...epic.source_refs, ...groundingRefs],
      trust: {
        ...epic.trust,
        rationale: `${epic.trust.rationale}${groundingBasis}`
      }
    })),
    stories: backlog.stories.map((story) => ({
      ...story,
      source_refs: [...story.source_refs, ...groundingRefs],
      trust: {
        ...story.trust,
        rationale: `${story.trust.rationale}${groundingBasis}`
      }
    }))
  };
}