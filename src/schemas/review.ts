export type ReviewCriterionStatus = "met" | "partial" | "not_evident" | "not_applicable";
export type ReviewConfidence = "High" | "Medium" | "Low";

export interface ReviewCriterionAssessment {
  criterionId: string;
  storyId?: string;
  workItemId: number | null;
  workItemTitle: string;
  localBacklogItemId: string;
  requirementIds: string[];
  criterion: string;
  status: ReviewCriterionStatus;
  evidence: string[];
  missingEvidence: string[];
  rationale: string;
  confidence: ReviewConfidence;
}

export interface ReviewFinding {
  type: "strength" | "gap" | "scope_creep" | "follow_up";
  message: string;
}

export interface PullRequestReviewDraft {
  repoId: string;
  prId: number;
  summary: string;
  linkedWorkItemIds: number[];
  requirementIds: string[];
  checklist: ReviewCriterionAssessment[];
  findings: ReviewFinding[];
  possibleScopeCreep: string[];
  followUps: string[];
}