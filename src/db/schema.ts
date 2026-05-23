import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  singletonKey: text("singleton_key").notNull().unique(),
  orgUrl: text("org_url").notNull(),
  project: text("project").notNull(),
  defaultRepo: text("default_repo").notNull().default(""),
  selectedRepoId: text("selected_repo_id").notNull().default(""),
  selectedRepoName: text("selected_repo_name").notNull().default(""),
  lastPrId: integer("last_pr_id"),
  lastPrTitle: text("last_pr_title").notNull().default(""),
  epicWorkItemType: text("epic_work_item_type").notNull().default("Epic"),
  issueWorkItemType: text("issue_work_item_type").notNull().default("Issue"),
  defaultBranch: text("default_branch").notNull().default("main"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const recentPr = pgTable("recent_pr", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoId: text("repo_id").notNull(),
  repoName: text("repo_name").notNull().default(""),
  prId: integer("pr_id").notNull(),
  prTitle: text("pr_title").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const recentPrd = pgTable("recent_prd", {
  id: uuid("id").primaryKey().defaultRandom(),
  prdId: text("prd_id").notNull(),
  title: text("title").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const prdDocument = pgTable("prd_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  rawText: text("raw_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const backlogDraft = pgTable("backlog_draft", {
  id: uuid("id").primaryKey().defaultRandom(),
  prdDocumentId: uuid("prd_document_id").notNull().references(() => prdDocument.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("generated"),
  draftJson: jsonb("draft_json").notNull(),
  ambiguityWarnings: jsonb("ambiguity_warnings").notNull().default([]),
  previewJson: jsonb("preview_json"),
  executionJson: jsonb("execution_json"),
  retrievedContextJson: jsonb("retrieved_context_json").notNull().default([]),
  lastPreviewedAt: timestamp("last_previewed_at", { withTimezone: true }),
  lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const backlogItem = pgTable("backlog_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftId: uuid("draft_id").notNull().references(() => backlogDraft.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(),
  externalId: text("external_id").notNull(),
  parentExternalId: text("parent_external_id").notNull().default(""),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  priority: text("priority").notNull().default(""),
  requirementIds: jsonb("requirement_ids").notNull().default([]),
  sourceRefs: jsonb("source_refs").notNull().default([]),
  evidenceLabel: text("evidence_label").notNull().default("inferred"),
  confidence: text("confidence").notNull().default("Medium"),
  rationale: text("rationale").notNull().default(""),
  warnings: jsonb("warnings").notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const acceptanceCriterion = pgTable("acceptance_criterion", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftId: uuid("draft_id").notNull().references(() => backlogDraft.id, { onDelete: "cascade" }),
  storyExternalId: text("story_external_id").notNull(),
  externalId: text("external_id").notNull(),
  text: text("text").notNull(),
  evidenceLabel: text("evidence_label").notNull().default("inferred"),
  confidence: text("confidence").notNull().default("Medium"),
  rationale: text("rationale").notNull().default(""),
  warnings: jsonb("warnings").notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const riskItem = pgTable("risk_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftId: uuid("draft_id").notNull().references(() => backlogDraft.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  relatedRequirementIds: jsonb("related_requirement_ids").notNull().default([]),
  mitigationNote: text("mitigation_note").notNull().default(""),
  evidenceLabel: text("evidence_label").notNull().default("inferred"),
  confidence: text("confidence").notNull().default("Medium"),
  rationale: text("rationale").notNull().default(""),
  warnings: jsonb("warnings").notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const workItemMapping = pgTable("work_item_mapping", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftId: uuid("draft_id").notNull().references(() => backlogDraft.id, { onDelete: "cascade" }),
  runId: text("run_id").notNull(),
  localId: text("local_id").notNull(),
  workItemType: text("work_item_type").notNull(),
  adoWorkItemId: integer("ado_work_item_id").notNull(),
  adoUrl: text("ado_url").notNull(),
  parentLocalId: text("parent_local_id"),
  parentAdoWorkItemId: integer("parent_ado_work_item_id"),
  requirementIds: jsonb("requirement_ids").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const sourceDocument = pgTable("source_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceKey: text("workspace_key").notNull().default("single-pm-pilot"),
  sourceType: text("source_type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  externalUrl: text("external_url").notNull().default(""),
  metadata: jsonb("metadata").notNull().default({}),
  status: text("status").notNull().default("indexed"),
  chunkCount: integer("chunk_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const sourceChunk = pgTable("source_chunk", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceDocumentId: uuid("source_document_id").notNull().references(() => sourceDocument.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenEstimate: integer("token_estimate").notNull().default(0),
  embedding: text("embedding").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const draftRetrievalSource = pgTable("draft_retrieval_source", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftId: uuid("draft_id").notNull().references(() => backlogDraft.id, { onDelete: "cascade" }),
  sourceDocumentId: uuid("source_document_id").notNull().references(() => sourceDocument.id, { onDelete: "cascade" }),
  sourceChunkId: uuid("source_chunk_id").notNull().references(() => sourceChunk.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  similarity: integer("similarity").notNull(),
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});