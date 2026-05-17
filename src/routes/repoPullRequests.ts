import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getAppConfig } from "../services/config";
import { emptyResponse, jsonResponse } from "../services/http";
import { getWorkspaceSettings, listRecentPrs } from "../services/workspaceStore";

interface AzureDevOpsPullRequest {
  pullRequestId: number;
  title?: string;
  status?: string;
  sourceRefName?: string;
  targetRefName?: string;
  createdBy?: {
    displayName?: string;
    uniqueName?: string;
  };
}

interface AzureDevOpsListResponse<T> {
  value: T[];
}

function encodePat(pat: string): string {
  return Buffer.from(`:${pat}`).toString("base64");
}

function branchLabel(refName?: string): string {
  return (refName || "").replace(/^refs\/heads\//, "");
}

function getQueryValue(request: HttpRequest, key: string): string | null {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

async function listPullRequests(input: {
  orgUrl: string;
  project: string;
  pat: string;
  repoId: string;
  status: string;
  top: number;
}): Promise<AzureDevOpsPullRequest[]> {
  const url = new URL(
    `${input.orgUrl}/${input.project}/_apis/git/repositories/${encodeURIComponent(
      input.repoId
    )}/pullrequests`
  );

  url.searchParams.set("searchCriteria.status", input.status);
  url.searchParams.set("$top", String(input.top));
  url.searchParams.set("api-version", "7.1");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${encodePat(input.pat)}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Azure DevOps pull request loading failed (${response.status} ${response.statusText}): ${body}`
    );
  }

  const payload = (await response.json()) as AzureDevOpsListResponse<AzureDevOpsPullRequest>;
  return payload.value;
}

export async function repoPullRequestsRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const workspace = await getWorkspaceSettings();

    if (!workspace) {
      return jsonResponse(400, {
        ok: false,
        error: "Save workspace settings before loading pull requests."
      });
    }

    const repoId = request.params.repoId;

    if (!repoId) {
      return jsonResponse(400, { ok: false, error: "repoId is required." });
    }

    const config = getAppConfig();

    if (!config.azdoPat) {
      return jsonResponse(500, {
        ok: false,
        error: "Missing required environment variable: AZDO_PAT"
      });
    }

    const status = getQueryValue(request, "status") || "all";
    const requestedTop = Number(getQueryValue(request, "top") || "25");
    const top = Number.isFinite(requestedTop) ? Math.min(Math.max(requestedTop, 1), 100) : 25;

    const pullRequests = await listPullRequests({
      orgUrl: workspace.orgUrl,
      project: workspace.project,
      pat: config.azdoPat,
      repoId,
      status,
      top
    });

    const recentPrs = await listRecentPrs(5);

    return jsonResponse(200, {
      ok: true,
      repoId,
      pullRequests: pullRequests.map((pullRequest) => ({
        prId: pullRequest.pullRequestId,
        title: pullRequest.title || "Untitled pull request",
        status: pullRequest.status || "unknown",
        author:
          pullRequest.createdBy?.displayName ||
          pullRequest.createdBy?.uniqueName ||
          "Unknown author",
        sourceBranch: branchLabel(pullRequest.sourceRefName),
        targetBranch: branchLabel(pullRequest.targetRefName)
      })),
      recentPrs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pull request loading error.";
    context.log(`Repo pull requests route failed: ${message}`);
    return jsonResponse(500, { ok: false, error: message });
  }
}

app.http("repoPullRequests", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "repos/{repoId}/pull-requests",
  handler: repoPullRequestsRoute
});