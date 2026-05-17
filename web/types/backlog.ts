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