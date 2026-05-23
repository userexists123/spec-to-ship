import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { emptyResponse, jsonResponse } from "../services/http";
import {
  createTraceabilitySnapshot,
  getLatestTraceabilitySnapshot,
  getTraceabilitySnapshot
} from "../services/traceabilityStore";

export async function getTraceabilityRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const refresh = request.query.get("refresh") === "true";
    const snapshot = refresh
      ? await createTraceabilitySnapshot()
      : (await getLatestTraceabilitySnapshot()) || (await createTraceabilitySnapshot());

    return jsonResponse(200, {
      ok: true,
      snapshot
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown traceability error.";
    context.log(`Get traceability route failed: ${message}`);
    return jsonResponse(500, {
      ok: false,
      error: message
    });
  }
}

export async function getTraceabilityByIdRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const id = request.params.id;

    if (!id) {
      return jsonResponse(400, {
        ok: false,
        error: "Traceability snapshot id is required."
      });
    }

    const snapshot = await getTraceabilitySnapshot(id);

    if (!snapshot) {
      return jsonResponse(404, {
        ok: false,
        error: "Traceability snapshot was not found."
      });
    }

    return jsonResponse(200, {
      ok: true,
      snapshot
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown traceability snapshot loading error.";
    context.log(`Get traceability by id route failed: ${message}`);
    return jsonResponse(500, {
      ok: false,
      error: message
    });
  }
}

app.http("getTraceability", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "traceability",
  handler: getTraceabilityRoute
});

app.http("getTraceabilityById", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "traceability/{id}",
  handler: getTraceabilityByIdRoute
});