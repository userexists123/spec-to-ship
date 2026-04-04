import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { readFile } from "node:fs/promises";
import { getAppConfig } from "../services/config";
import { withModeGuard } from "../services/modeGuard";
import { parsePrdToBacklog } from "../services/prdParser";
import { validateBacklogBundle } from "../services/backlogValidator";

async function readRequestBody(request: HttpRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();

    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

export const prdParse = withModeGuard({
  actionName: "parse_prd",
  operationType: "read",
  handler: async ({
    request
  }: {
    request: HttpRequest;
    context: InvocationContext;
    mode: "dry_run" | "execute";
    runId: string;
    requestId: string;
  }): Promise<{
    response: HttpResponseInit;
    previewOrResultRef?: string;
    metadata?: Record<string, unknown>;
  }> => {
    const config = getAppConfig();
    const body = await readRequestBody(request);

    const prdId = typeof body.prdId === "string" && body.prdId.trim() ? body.prdId.trim() : "prd-golden";
    const prdText =
      typeof body.prdText === "string" && body.prdText.trim()
        ? body.prdText
        : await readFile(config.defaultPrdPath, "utf8");

    const backlog = parsePrdToBacklog(prdText, prdId);
    const validation = validateBacklogBundle(backlog);

    return {
      response: {
        status: validation.ok ? 200 : 400,
        jsonBody: {
          ok: validation.ok,
          prd_id: backlog.prd_id,
          backlog,
          validation
        }
      },
      previewOrResultRef: `backlog:${backlog.prd_id}`,
      metadata: {
        prd_id: backlog.prd_id,
        requirement_count: backlog.requirements.length,
        epic_count: backlog.epics.length,
        story_count: backlog.stories.length,
        risk_count: backlog.risks.length,
        validation_ok: validation.ok
      }
    };
  }
});

app.http("prdParse", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "prd/parse",
  handler: prdParse
});