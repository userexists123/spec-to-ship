import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { emptyResponse, jsonResponse, readJsonObject } from "../services/http";
import {
  ingestSourceDocument,
  listSourceDocuments,
  parseSourceDocumentBody
} from "../services/ragStore";

export async function listRagSourcesRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const sources = await listSourceDocuments();

    return jsonResponse(200, {
      ok: true,
      sources
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown source list error.";
    context.log(`List RAG sources route failed: ${message}`);
    return jsonResponse(500, { ok: false, error: message });
  }
}

export async function createRagSourceRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const body = await readJsonObject(request);
    const input = parseSourceDocumentBody(body);
    const source = await ingestSourceDocument(input);

    return jsonResponse(201, {
      ok: true,
      source
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown source ingestion error.";
    context.log(`Create RAG source route failed: ${message}`);
    return jsonResponse(400, { ok: false, error: message });
  }
}

app.http("listRagSources", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "rag/sources",
  handler: listRagSourcesRoute
});

app.http("createRagSource", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "rag/sources",
  handler: createRagSourceRoute
});