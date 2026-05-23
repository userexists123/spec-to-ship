export interface SourceReference {
  section: string;
  excerpt: string;
}

export type EvidenceLabel = "explicit" | "inferred";
export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface TrustMetadata {
  evidence_label: EvidenceLabel;
  confidence: ConfidenceLevel;
  rationale: string;
  warnings: string[];
}

export interface DraftAmbiguityWarning {
  id: string;
  category:
    | "vague_wording"
    | "mixed_scope"
    | "unclear_ownership"
    | "non_testable_outcome"
    | "missing_non_functional_details";
  severity: "high" | "medium" | "low";
  message: string;
  evidence: string;
}

export interface Requirement {
  id: string;
  title: string;
  summary: string;
  priority: "high" | "medium" | "low";
  source_refs: SourceReference[];
  trust: TrustMetadata;
}

export interface Epic {
  id: string;
  title: string;
  summary: string;
  requirement_ids: string[];
  source_refs: SourceReference[];
  trust: TrustMetadata;
}

export interface AcceptanceCriterion {
  id: string;
  story_id: string;
  text: string;
  trust: TrustMetadata;
}

export interface Story {
  id: string;
  epic_id: string;
  title: string;
  summary: string;
  requirement_ids: string[];
  acceptance_criteria: AcceptanceCriterion[];
  source_refs: SourceReference[];
  trust: TrustMetadata;
}

export interface Risk {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  related_requirement_ids: string[];
  mitigation_note: string;
  trust: TrustMetadata;
}

export interface BacklogBundle {
  prd_id: string;
  title: string;
  requirements: Requirement[];
  epics: Epic[];
  stories: Story[];
  risks: Risk[];
  ambiguity_warnings: DraftAmbiguityWarning[];
}

export type SourceType =
  | "prior_prd"
  | "ado_work_item"
  | "accepted_backlog"
  | "architecture_doc"
  | "convention_doc";

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

export interface PrdDocumentRecord {
  id: string;
  title: string;
  rawText: string;
  createdAt: string;
  updatedAt: string;
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

export interface PreviewItem {
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
}

export interface BacklogPreview {
  runId: string;
  project: string;
  itemCount: number;
  epicCount: number;
  issueCount: number;
  items: PreviewItem[];
}

export interface ExecutionItem {
  localId: string;
  workItemType: string;
  adoWorkItemId: number;
  adoUrl: string;
  parentLocalId: string | null;
  parentAdoWorkItemId: number | null;
  requirementIds: string[];
}

export interface BacklogExecutionResult {
  runId: string;
  project: string;
  createdCount: number;
  createdItems: ExecutionItem[];
}

export interface BacklogDraftRecord {
  id: string;
  prdDocumentId: string;
  title: string;
  status: string;
  draft: BacklogBundle;
  preview: BacklogPreview | null;
  execution: BacklogExecutionResult | null;
  retrievedSources: RetrievedContextSource[];
  lastPreviewedAt: string | null;
  lastExecutedAt: string | null;
  mappings: WorkItemMappingRecord[];
  createdAt: string;
  updatedAt: string;
}