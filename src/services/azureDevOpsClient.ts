import { env } from "node:process";
import type {
  BacklogBundle,
  AcceptanceCriterion,
  SourceReference
} from "../schemas/backlog";

export interface CreateWorkItemResult {
  id: number;
  url: string;
}

export interface AzureDevOpsPullRequest {
  pullRequestId: number;
  title?: string;
  description?: string;
  status?: string;
  sourceRefName?: string;
  targetRefName?: string;
  createdBy?: {
    displayName?: string;
    uniqueName?: string;
  };
}

export interface AzureDevOpsPullRequestWorkItemRef {
  id: string;
  url?: string;
}

export interface AzureDevOpsIteration {
  id: number;
}

export interface AzureDevOpsIterationChangeEntry {
  changeTrackingId?: number;
  changeType?: string;
  item?: {
    path?: string;
    isFolder?: boolean;
    gitObjectType?: string;
  };
}

interface AzureDevOpsCreateWorkItemResponse {
  id: number;
  url: string;
}

interface AzureDevOpsListResponse<T> {
  count: number;
  value: T[];
}

export interface WorkItemPayloadPreview {
  type: "Epic" | "User Story";
  title: string;
  description: string;
  localId: string;
  parentLocalId?: string;
  requirementIds?: string[];
  patch: Array<{ op: "add"; path: string; value: string }>;
}

export interface BacklogExecutePreview {
  runId: string;
  project: string;
  itemsToCreate: WorkItemPayloadPreview[];
}

export interface BacklogExecuteResult {
  runId: string;
  project: string;
  created: Array<{
    type: "Epic" | "User Story";
    localId: string;
    azureDevOpsId: number;
    url: string;
    parentAzureDevOpsId?: number;
    requirementIds?: string[];
  }>;
}

function getRequiredEnv(name: string): string {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function encodePat(pat: string): string {
  return Buffer.from(`:${pat}`).toString("base64");
}

function toJsonPatchOperations(fields: Record<string, string>) {
  return Object.entries(fields).map(([path, value]) => ({
    op: "add" as const,
    path,
    value
  }));
}

export class AzureDevOpsClient {
  private readonly orgUrl: string;

  private readonly project: string;

  private readonly pat: string;

  constructor() {
    this.orgUrl = getRequiredEnv("AZDO_ORG_URL").replace(/\/$/, "");
    this.project = getRequiredEnv("AZDO_PROJECT");
    this.pat = getRequiredEnv("AZDO_PAT");
  }

  getProject(): string {
    return this.project;
  }

  buildBacklogPreview(bundle: BacklogBundle, runId: string): BacklogExecutePreview {
    const epicPreviews: WorkItemPayloadPreview[] = bundle.epics.map((epic) => {
      const description = [epic.summary, this.buildSourceReferencesBlock(epic.source_refs)]
        .filter(Boolean)
        .join("\n\n");

      return {
        type: "Epic",
        title: epic.title,
        description,
        localId: epic.id,
        requirementIds: epic.requirement_ids,
        patch: toJsonPatchOperations({
          "/fields/System.Title": epic.title,
          "/fields/System.Description": description,
          "/fields/System.Tags": this.buildTags(runId, epic.id)
        })
      };
    });

    const epicIdSet = new Set(bundle.epics.map((epic) => epic.id));

    const storyPreviews: WorkItemPayloadPreview[] = bundle.stories.map((story) => {
      const parentLocalId =
        story.epic_id && epicIdSet.has(story.epic_id) ? story.epic_id : undefined;
      const descriptionParts = [
        story.summary,
        this.buildAcceptanceCriteriaBlock(story.acceptance_criteria),
        this.buildSourceReferencesBlock(story.source_refs)
      ].filter(Boolean);

      const description = descriptionParts.join("\n\n");

      return {
        type: "User Story",
        title: story.title,
        description,
        localId: story.id,
        parentLocalId,
        requirementIds: story.requirement_ids,
        patch: toJsonPatchOperations({
          "/fields/System.Title": story.title,
          "/fields/System.Description": description,
          "/fields/System.Tags": this.buildTags(runId, story.id)
        })
      };
    });

    return {
      runId,
      project: this.project,
      itemsToCreate: [...epicPreviews, ...storyPreviews]
    };
  }

  async executeBacklog(bundle: BacklogBundle, runId: string): Promise<BacklogExecuteResult> {
    const created: BacklogExecuteResult["created"] = [];
    const epicIdMap = new Map<string, number>();

    for (const epic of bundle.epics) {
      const description = [epic.summary, this.buildSourceReferencesBlock(epic.source_refs)]
        .filter(Boolean)
        .join("\n\n");

      const createdEpic = await this.createWorkItem("Epic", {
        "/fields/System.Title": epic.title,
        "/fields/System.Description": description,
        "/fields/System.Tags": this.buildTags(runId, epic.id)
      });

      epicIdMap.set(epic.id, createdEpic.id);

      created.push({
        type: "Epic",
        localId: epic.id,
        azureDevOpsId: createdEpic.id,
        url: createdEpic.url,
        requirementIds: epic.requirement_ids
      });
    }

    for (const story of bundle.stories) {
      const description = [
        story.summary,
        this.buildAcceptanceCriteriaBlock(story.acceptance_criteria),
        this.buildSourceReferencesBlock(story.source_refs)
      ]
        .filter(Boolean)
        .join("\n\n");

      const fields: Record<string, string> = {
        "/fields/System.Title": story.title,
        "/fields/System.Description": description,
        "/fields/System.Tags": this.buildTags(runId, story.id)
      };

      const parentAzureDevOpsId = story.epic_id ? epicIdMap.get(story.epic_id) : undefined;

      if (parentAzureDevOpsId) {
        fields["/relations/-"] = JSON.stringify({
          rel: "System.LinkTypes.Hierarchy-Reverse",
          url: `${this.orgUrl}/${this.project}/_apis/wit/workItems/${parentAzureDevOpsId}`
        });
      }

      const createdStory = await this.createWorkItem("User Story", fields);

      created.push({
        type: "User Story",
        localId: story.id,
        azureDevOpsId: createdStory.id,
        url: createdStory.url,
        parentAzureDevOpsId,
        requirementIds: story.requirement_ids
      });
    }

    return {
      runId,
      project: this.project,
      created
    };
  }

  async getPullRequest(repoId: string, prId: number): Promise<AzureDevOpsPullRequest> {
    const url = new URL(
      `${this.orgUrl}/${this.project}/_apis/git/repositories/${encodeURIComponent(
        repoId
      )}/pullRequests/${prId}`
    );

    url.searchParams.set("api-version", "7.1");

    return this.requestJson<AzureDevOpsPullRequest>(url.toString());
  }

  async getPullRequestWorkItems(
    repoId: string,
    prId: number
  ): Promise<AzureDevOpsPullRequestWorkItemRef[]> {
    const url = new URL(
      `${this.orgUrl}/${this.project}/_apis/git/repositories/${encodeURIComponent(
        repoId
      )}/pullRequests/${prId}/workitems`
    );

    url.searchParams.set("api-version", "7.1");

    const response = await this.requestJson<AzureDevOpsListResponse<AzureDevOpsPullRequestWorkItemRef>>(
      url.toString()
    );

    return response.value;
  }

  async getPullRequestIterations(repoId: string, prId: number): Promise<AzureDevOpsIteration[]> {
    const url = new URL(
      `${this.orgUrl}/${this.project}/_apis/git/repositories/${encodeURIComponent(
        repoId
      )}/pullRequests/${prId}/iterations`
    );

    url.searchParams.set("api-version", "7.1");

    const response = await this.requestJson<AzureDevOpsListResponse<AzureDevOpsIteration>>(
      url.toString()
    );

    return response.value;
  }

  async getPullRequestIterationChanges(
    repoId: string,
    prId: number,
    iterationId: number
  ): Promise<AzureDevOpsIterationChangeEntry[]> {
    const url = new URL(
      `${this.orgUrl}/${this.project}/_apis/git/repositories/${encodeURIComponent(
        repoId
      )}/pullRequests/${prId}/iterations/${iterationId}/changes`
    );

    url.searchParams.set("api-version", "7.1");
    url.searchParams.set("$top", "2000");

    const response = await this.requestJson<{
      count: number;
      changeEntries?: AzureDevOpsIterationChangeEntry[];
    }>(url.toString());

    return response.changeEntries ?? [];
  }

  private async createWorkItem(
    workItemType: "Epic" | "User Story",
    fields: Record<string, string>
  ): Promise<CreateWorkItemResult> {
    const patch = toJsonPatchOperations(fields);
    const url = new URL(
      `${this.orgUrl}/${this.project}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}`
    );
    url.searchParams.set("api-version", "7.1");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodePat(this.pat)}`,
        "Content-Type": "application/json-patch+json"
      },
      body: JSON.stringify(patch)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Azure DevOps work item creation failed (${response.status} ${response.statusText}): ${body}`
      );
    }

    const data = (await response.json()) as AzureDevOpsCreateWorkItemResponse;

    return {
      id: data.id,
      url: data.url
    };
  }

  private async requestJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${encodePat(this.pat)}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Azure DevOps request failed (${response.status} ${response.statusText}): ${body}`
      );
    }

    return (await response.json()) as T;
  }

  private buildAcceptanceCriteriaBlock(criteria: AcceptanceCriterion[]): string {
    if (!criteria.length) {
      return "";
    }

    const lines = criteria.map((criterion, index) => `${index + 1}. ${criterion.text}`);
    return `Acceptance Criteria\n${lines.join("\n")}`;
  }

  private buildSourceReferencesBlock(references: SourceReference[]): string {
    if (!references.length) {
      return "";
    }

    const lines = references.map(
      (reference, index) => `${index + 1}. [${reference.section}] ${reference.excerpt}`
    );

    return `Source References\n${lines.join("\n")}`;
  }

  private buildTags(runId: string, localId: string): string {
    return [runId, localId, "spec-to-ship"].join("; ");
  }
}