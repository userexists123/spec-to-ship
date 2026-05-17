import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { emptyResponse, jsonResponse, readJsonObject } from "../services/http";
import {
  getWorkspaceSettings,
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
      return jsonResponse(200, { ok: true, workspace });
    }

    if (request.method === "PUT") {
      const body = await readJsonObject(request);
      const saved = await upsertWorkspaceSettings(parseWorkspaceSettings(body));
      return jsonResponse(200, { ok: true, workspace: saved });
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