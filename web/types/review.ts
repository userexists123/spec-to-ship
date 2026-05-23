export type ReviewCriterionStatus = "met" | "partial" | "not_evident" | "not_applicable";
export type ReviewConfidence = "High" | "Medium" | "Low";

export interface PullRequestChangedFile {
  path: string;
  changeType: string;
  summary: string;
}

export interface ReviewAssessmentRecord {
  id: string;
  reviewRunId: string;
  workItemId: number | null;
  workItemTitle: string;
  localBacklogItemId: string;
  acceptanceCriterionId: string;
  acceptanceCriterionText: string;
  status: ReviewCriterionStatus;
  evidence: string[];
  missingEvidence: string[];
  rationale: string;
  confidence: ReviewConfidence;
  requirementIds: string[];
  createdAt: string;
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