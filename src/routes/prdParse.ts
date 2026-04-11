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

function inferPrdId(prdText: string): string {
  const titleMatch =
    prdText.match(/^\s*PRD\s*Title\s*:\s*(.+)$/im) ||
    prdText.match(/^\s*Title\s*:\s*(.+)$/im) ||
    prdText.match(/^\s*#\s+(.+)$/m);

  const rawTitle = titleMatch?.[1]?.trim();

  if (!rawTitle) {
    return "prd-inline";
  }

  return rawTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "prd-inline";
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

    const inlinePrdText =
      typeof body.prdText === "string" && body.prdText.trim() ? body.prdText.trim() : null;

    const prdText = inlinePrdText ?? (await readFile(config.defaultPrdPath, "utf8"));

    const prdId =
      typeof body.prdId === "string" && body.prdId.trim()
        ? body.prdId.trim()
        : inlinePrdText
          ? inferPrdId(inlinePrdText)
          : "prd-golden";

    const backlog = parsePrdToBacklog(prdText, prdId);
    const validation = validateBacklogBundle(backlog);

    const inlineParseFailed =
      Boolean(inlinePrdText) &&
      (!validation.ok ||
        backlog.requirements.length === 0 ||
        backlog.epics.length === 0 ||
        backlog.stories.length === 0);

    return {
      response: {
        status: validation.ok ? 200 : 400,
        jsonBody: {
          ok: validation.ok,
          prd_id: backlog.prd_id,
          backlog,
          validation,
          source: inlinePrdText ? "inline_prd" : "default_prd",
          ...(inlineParseFailed
            ? {
                parse_error:
                  "Inline PRD text was provided, but no usable backlog items were extracted. The parser likely needs broader support for this PRD structure."
              }
            : {})
        }
      },
      previewOrResultRef: `backlog:${backlog.prd_id}`,
      metadata: {
        prd_id: backlog.prd_id,
        source: inlinePrdText ? "inline_prd" : "default_prd",
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