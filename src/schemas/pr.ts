export interface PullRequestSummary {
  prId: number;
  title: string;
  status: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  url: string;
}

export interface AbReference {
  id: number;
  title: string;
  url?: string;
}

export interface DemoPullRequestWorkItemRef {
  id: number;
  url?: string;
  title?: string;
}

export interface PullRequestContextResponse {
  repoId: string;
  repoName?: string;
  prId: number;

  /**
   * Saturday 7 normalized fields.
   */
  prTitle?: string;
  prStatus?: string;
  prAuthor?: string;
  sourceBranch?: string;
  targetBranch?: string;
  prUrl?: string;
  linkedWorkItemIds?: number[];

  /**
   * Backward-compatible fields used by earlier PR context/review/traceability routes.
   */
  title?: string;
  description?: string;
  status?: string;
  sourceRefName?: string;
  targetRefName?: string;
  createdBy?: {
    displayName?: string;
    uniqueName?: string;
  };
  workItems: DemoPullRequestWorkItemRef[];
  abReferences: AbReference[];
}

export interface PullRequestChangedFile {
  path: string;
  changeType: string;
  summary: string;
  isBinary?: boolean;
}

export interface PullRequestFileChangeSummary extends PullRequestChangedFile {
  isBinary: boolean;
}

export interface PullRequestChangesResponse {
  repoId: string;
  prId: number;
  files: PullRequestFileChangeSummary[];
  fileCount: number;
  returnedFileCount: number;
  truncated: boolean;

  /**
   * Backward-compatible field used by the existing AzureDevOpsClient demo change fixture.
   */
  iterationId?: number;
}