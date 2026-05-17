import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { emptyResponse, jsonResponse, readJsonObject } from "../services/http";
import {
  getWorkspaceSettings,
  listRecentPrs,
  parseWorkspaceSettings,
  upsertWorkspaceSettings
} from "../services/workspaceStore";

export async function workspaceRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    if (request.method === "GET") {
      const workspace = await getWorkspaceSettings();
      const recentPrs = await listRecentPrs(5);

      return jsonResponse(200, {
        ok: true,
        workspace,
        recentPrs
      });
    }

    if (request.method === "PUT") {
      const body = await readJsonObject(request);
      const saved = await upsertWorkspaceSettings(parseWorkspaceSettings(body));
      const recentPrs = await listRecentPrs(5);

      return jsonResponse(200, {
        ok: true,
        workspace: saved,
        recentPrs
      });
    }

    return jsonResponse(405, { ok: false, error: "Method not allowed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workspace error.";
    context.log(`Workspace route failed: ${message}`);
    return jsonResponse(400, { ok: false, error: message });
  }
}

app.http("workspace", {
  methods: ["GET", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "workspace",
  handler: workspaceRoute
});