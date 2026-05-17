import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AzureDevOpsClient } from "../services/azureDevOpsClient";
import { emptyResponse, jsonResponse } from "../services/http";
import { getWorkspaceSettings } from "../services/workspaceStore";

export async function reposRoute(
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
        error: "Save workspace settings before loading repositories."
      });
    }

    const client = new AzureDevOpsClient({
      orgUrl: workspace.orgUrl,
      project: workspace.project
    });

    const repos = await client.listRepositories();

    return jsonResponse(200, {
      ok: true,
      workspace: {
        orgUrl: workspace.orgUrl,
        project: workspace.project,
        defaultRepo: workspace.defaultRepo,
        defaultBranch: workspace.defaultBranch
      },
      repos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        defaultBranch: repo.defaultBranch ?? "",
        projectName: repo.project?.name ?? workspace.project,
        webUrl:
          repo.webUrl ??
          `${workspace.orgUrl}/${encodeURIComponent(workspace.project)}/_git/${encodeURIComponent(
            repo.name
          )}`
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown repo loading error.";
    context.log(`Repos route failed: ${message}`);
    return jsonResponse(500, { ok: false, error: message });
  }
}

app.http("repos", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "repos",
  handler: reposRoute
});