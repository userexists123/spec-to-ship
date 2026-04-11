export interface AzureDevOpsWorkItemPayload {
  title: string;
  description: string;
  tags?: string[];
  parentId?: number;
}

export interface AzureDevOpsCreatedWorkItem {
  id: number;
  url: string;
  webUrl?: string;
  title: string;
  workItemType: string;
}

export class AzureDevOpsClient {
  constructor(
    private readonly orgUrl: string,
    private readonly project: string,
    private readonly pat: string,
  ) {}

  getInfo() {
    return {
      orgUrl: this.orgUrl,
      project: this.project,
      status: "configured",
    };
  }

  private getAuthHeader(): string {
    const token = Buffer.from(`:${this.pat}`).toString("base64");
    return `Basic ${token}`;
  }

  private buildPatchDocument(payload: AzureDevOpsWorkItemPayload) {
    const operations: Array<Record<string, unknown>> = [
      {
        op: "add",
        path: "/fields/System.Title",
        value: payload.title,
      },
      {
        op: "add",
        path: "/fields/System.Description",
        value: payload.description,
      },
    ];

    if (payload.tags && payload.tags.length > 0) {
      operations.push({
        op: "add",
        path: "/fields/System.Tags",
        value: payload.tags.join("; "),
      });
    }

    if (typeof payload.parentId === "number") {
      operations.push({
        op: "add",
        path: "/relations/-",
        value: {
          rel: "System.LinkTypes.Hierarchy-Reverse",
          url: `${this.orgUrl}/${this.project}/_apis/wit/workItems/${payload.parentId}`,
        },
      });
    }

    return operations;
  }

  async createWorkItem(
    workItemType: string,
    payload: AzureDevOpsWorkItemPayload,
  ): Promise<AzureDevOpsCreatedWorkItem> {
    if (!this.pat) {
      throw new Error("AZDO_PAT is not configured.");
    }

    const url =
      `${this.orgUrl}/${encodeURIComponent(this.project)}` +
      `/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=7.1`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json-patch+json",
      },
      body: JSON.stringify(this.buildPatchDocument(payload)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Azure DevOps createWorkItem failed: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      id: number;
      url: string;
      fields?: Record<string, unknown>;
      _links?: {
        html?: {
          href?: string;
        };
      };
    };

    return {
      id: data.id,
      url: data.url,
      webUrl: data._links?.html?.href,
      title: String(data.fields?.["System.Title"] || payload.title),
      workItemType,
    };
  }
}
