export interface PullRequestLinkedWorkItem {
  id: number;
  url?: string;
  title?: string;
}

export interface PullRequestAuthor {
  displayName?: string;
  uniqueName?: string;
}

export interface PullRequestContextResponse {
  repoId: string;
  prId: number;
  title: string;
  description: string;
  status: string;
  sourceRefName?: string;
  targetRefName?: string;
  createdBy?: PullRequestAuthor;
  workItems: PullRequestLinkedWorkItem[];
  abReferences: number[];
}

export interface PullRequestFileChangeSummary {
  path: string;
  changeType: string;
  additions?: number;
  deletions?: number;
  isBinary?: boolean;
  summary: string;
}

export interface PullRequestChangesResponse {
  repoId: string;
  prId: number;
  iterationId?: number;
  fileCount: number;
  returnedFileCount: number;
  truncated: boolean;
  files: PullRequestFileChangeSummary[];
}