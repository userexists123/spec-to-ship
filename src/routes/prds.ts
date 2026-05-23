import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { validateBacklogBundle } from "../services/backlogValidator";
import { emptyResponse, jsonResponse, readJsonObject } from "../services/http";
import { parsePrdToBacklog } from "../services/prdParser";
import {
  createGeneratedDraft,
  createPrdDocument,
  getPrdDocument,
  parsePrdCreateBody
} from "../services/prdStore";
import {
  groundBacklogWithRetrievedContext,
  retrieveContextForPrd
} from "../services/ragStore";

export async function createPrdRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const body = await readJsonObject(request);
    const input = parsePrdCreateBody(body);
    const prd = await createPrdDocument(input);

    return jsonResponse(201, {
      ok: true,
      prd
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PRD save error.";
    context.log(`Create PRD route failed: ${message}`);
    return jsonResponse(400, { ok: false, error: message });
  }
}

export async function analyzePrdRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const prdId = request.params.id;

    if (!prdId) {
      return jsonResponse(400, { ok: false, error: "PRD id is required." });
    }

    const prd = await getPrdDocument(prdId);

    if (!prd) {
      return jsonResponse(404, { ok: false, error: "PRD document was not found." });
    }

    const retrievedSources = await retrieveContextForPrd(prd.rawText);
    const parsedBacklog = parsePrdToBacklog(prd.rawText, prd.id);
    const backlog = groundBacklogWithRetrievedContext(parsedBacklog, retrievedSources);
    const validation = validateBacklogBundle(backlog);

    if (!validation.ok) {
      return jsonResponse(400, {
        ok: false,
        error: "PRD analysis did not produce a valid backlog draft.",
        validation
      });
    }

    const draft = await createGeneratedDraft({
      prdDocumentId: prd.id,
      backlog,
      retrievedSources
    });

    return jsonResponse(200, {
      ok: true,
      prd,
      draft,
      validation,
      retrievedSources
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PRD analysis error.";
    context.log(`Analyze PRD route failed: ${message}`);
    return jsonResponse(500, { ok: false, error: message });
  }
}

app.http("createPrd", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "prds",
  handler: createPrdRoute
});

app.http("analyzePrd", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "prds/{id}/analyze",
  handler: analyzePrdRoute
});