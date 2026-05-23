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

export interface TraceabilitySnapshotRecord {
  id: string;
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
  createdAt: string;
}