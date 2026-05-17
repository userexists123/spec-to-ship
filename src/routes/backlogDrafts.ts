import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { emptyResponse, jsonResponse } from "../services/http";
import { getBacklogDraft } from "../services/prdStore";

export async function getBacklogDraftRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const draftId = request.params.id;

    if (!draftId) {
      return jsonResponse(400, { ok: false, error: "Draft id is required." });
    }

    const draft = await getBacklogDraft(draftId);

    if (!draft) {
      return jsonResponse(404, { ok: false, error: "Backlog draft was not found." });
    }

    return jsonResponse(200, {
      ok: true,
      draft
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backlog draft loading error.";
    context.log(`Get backlog draft route failed: ${message}`);
    return jsonResponse(500, { ok: false, error: message });
  }
}

app.http("getBacklogDraft", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "backlog/drafts/{id}",
  handler: getBacklogDraftRoute
});