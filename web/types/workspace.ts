export interface WorkspaceSettings {
  id?: string;
  orgUrl: string;
  project: string;
  defaultRepo: string;
  selectedRepoId: string;
  selectedRepoName: string;
  lastPrId?: number | null;
  lastPrTitle: string;
  epicWorkItemType: string;
  issueWorkItemType: string;
  defaultBranch: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RepositorySummary {
  id: string;
  name: string;
  defaultBranch: string;
  projectName: string;
  webUrl: string;
}

export interface PullRequestSummary {
  prId: number;
  title: string;
  status: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface RecentPrSummary {
  id: string;
  repoId: string;
  repoName: string;
  prId: number;
  prTitle: string;
  createdAt: string;
}