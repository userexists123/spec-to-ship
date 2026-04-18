export type ReviewCriterionStatus = "met" | "partial" | "not_evident";

export interface ReviewCriterionAssessment {
  criterionId: string;
  storyId?: string;
  workItemId: number;
  workItemTitle: string;
  requirementIds: string[];
  criterion: string;
  status: ReviewCriterionStatus;
  evidence: string[];
  note: string;
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