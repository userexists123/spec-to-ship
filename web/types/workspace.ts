export interface WorkspaceSettings {
  id?: string;
  orgUrl: string;
  project: string;
  defaultRepo: string;
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