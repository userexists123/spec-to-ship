import { getAppConfig } from "./config";
import type {
  DemoPullRequestWorkItemRef,
  PullRequestChangedFile,
  PullRequestChangesResponse,
  PullRequestContextResponse
} from "../schemas/pr";

interface AzureDevOpsIdentity {
  displayName?: string;
  uniqueName?: string;
}

interface AzureDevOpsPullRequest {
  pullRequestId?: number;
  title?: string;
  description?: string;
  status?: string;
  createdBy?: AzureDevOpsIdentity;
  sourceRefName?: string;
  targetRefName?: string;
  url?: string;
  _links?: {
    web?: {
      href?: string;
    };
  };
}

interface AzureDevOpsWorkItemRef {
  id?: string;
  url?: string;
}

interface AzureDevOpsWorkItemsResponse {
  value?: AzureDevOpsWorkItemRef[];
}

interface AzureDevOpsIterationsResponse {
  value?: Array<{
    id?: number;
  }>;
}

interface AzureDevOpsChangesResponse {
  changeEntries?: Array<{
    changeType?: string;
    item?: {
      path?: string;
      gitObjectType?: string;
    };
  }>;
}

interface AzureDevOpsThreadResponse {
  id?: number;
  _links?: {
    web?: {
      href?: string;
    };
  };
}

function cleanBranchName(value: string | undefined): string {
  return (value || "").replace(/^refs\/heads\//, "");
}

function toWorkItemId(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : null;
}

function summarizeChange(file: PullRequestChangedFile): string {
  const path = file.path.toLowerCase();

  if (path.endsWith(".tsx") || path.endsWith(".ts")) {
    return `${file.changeType} TypeScript application code.`;
  }

  if (path.endsWith(".sql")) {
    return `${file.changeType} database migration or SQL schema file.`;
  }

  if (path.endsWith(".md")) {
    return `${file.changeType} documentation or Markdown content.`;
  }

  if (path.endsWith(".json")) {
    return `${file.changeType} JSON configuration or package metadata.`;
  }

  if (path.endsWith(".yml") || path.endsWith(".yaml")) {
    return `${file.changeType} YAML configuration.`;
  }

  return `${file.changeType} ${file.path}.`;
}

export class PrReviewAdoClient {
  private readonly orgUrl: string;
  private readonly project: string;
  private readonly pat: string;

  constructor() {
    const config = getAppConfig();

    if (!config.azdoPat) {
      throw new Error("Missing required environment variable: AZDO_PAT");
    }

    this.orgUrl = config.azdoOrgUrl.replace(/\/$/, "");
    this.project = config.azdoProject;
    this.pat = config.azdoPat;
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`:${this.pat}`).toString("base64")}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.orgUrl}/${encodeURIComponent(this.project)}/${path}${separator}api-version=7.1`;

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Azure DevOps request failed ${response.status}: ${text.slice(0, 500)}`);
    }

    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  async getPullRequestContext(params: {
    repoId: string;
    repoName: string;
    prId: number;
  }): Promise<PullRequestContextResponse> {
    const pr = await this.request<AzureDevOpsPullRequest>(
      `_apis/git/repositories/${encodeURIComponent(params.repoId)}/pullRequests/${params.prId}`
    );

    const workItems = await this.request<AzureDevOpsWorkItemsResponse>(
      `_apis/git/repositories/${encodeURIComponent(params.repoId)}/pullRequests/${params.prId}/workitems`
    );

    const normalizedWorkItems: DemoPullRequestWorkItemRef[] = [];

    for (const item of workItems.value || []) {
      const id = toWorkItemId(item.id);

      if (id) {
        normalizedWorkItems.push({
          id,
          url: item.url
        });
      }
    }

    const linkedWorkItemIds = normalizedWorkItems.map((item) => item.id);

    return {
      repoId: params.repoId,
      repoName: params.repoName,
      prId: params.prId,

      prTitle: pr.title || "",
      prStatus: pr.status || "",
      prAuthor: pr.createdBy?.displayName || pr.createdBy?.uniqueName || "",
      sourceBranch: cleanBranchName(pr.sourceRefName),
      targetBranch: cleanBranchName(pr.targetRefName),
      prUrl: pr._links?.web?.href || pr.url || "",
      linkedWorkItemIds,

      title: pr.title || "",
      description: pr.description || "",
      status: pr.status || "",
      sourceRefName: pr.sourceRefName || "",
      targetRefName: pr.targetRefName || "",
      createdBy: pr.createdBy,
      workItems: normalizedWorkItems,
      abReferences: []
    };
  }

  async getPullRequestChanges(params: {
    repoId: string;
    prId: number;
  }): Promise<PullRequestChangesResponse> {
    const iterations = await this.request<AzureDevOpsIterationsResponse>(
      `_apis/git/repositories/${encodeURIComponent(params.repoId)}/pullRequests/${params.prId}/iterations`
    );

    const iterationIds = (iterations.value || [])
      .map((iteration) => iteration.id)
      .filter((id): id is number => typeof id === "number");

    const latestIterationId = iterationIds.length > 0 ? Math.max(...iterationIds) : null;

    if (!latestIterationId) {
      return {
        repoId: params.repoId,
        prId: params.prId,
        files: [],
        fileCount: 0,
        returnedFileCount: 0,
        truncated: false
      };
    }

    const changes = await this.request<AzureDevOpsChangesResponse>(
      `_apis/git/repositories/${encodeURIComponent(params.repoId)}/pullRequests/${params.prId}/iterations/${latestIterationId}/changes`
    );

    const files = (changes.changeEntries || [])
      .map((entry) => ({
        path: entry.item?.path || "",
        changeType: entry.changeType || "edit",
        summary: "",
        isBinary: entry.item?.gitObjectType === "tree"
      }))
      .filter((file) => file.path)
      .map((file) => ({
        ...file,
        summary: summarizeChange(file)
      }));

    return {
      repoId: params.repoId,
      prId: params.prId,
      files,
      fileCount: files.length,
      returnedFileCount: files.length,
      truncated: false,
      iterationId: latestIterationId
    };
  }

  async postPullRequestComment(params: {
    repoId: string;
    prId: number;
    comment: string;
  }): Promise<{ threadId: number; threadUrl: string }> {
    const thread = await this.request<AzureDevOpsThreadResponse>(
      `_apis/git/repositories/${encodeURIComponent(params.repoId)}/pullRequests/${params.prId}/threads`,
      {
        method: "POST",
        body: JSON.stringify({
          comments: [
            {
              parentCommentId: 0,
              content: params.comment,
              commentType: 1
            }
          ],
          status: 1
        })
      }
    );

    return {
      threadId: thread.id || 0,
      threadUrl: thread._links?.web?.href || ""
    };
  }
}