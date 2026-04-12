import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { readFile } from "node:fs/promises";
import { BacklogBundle } from "../schemas/backlog";
import { getAppConfig } from "../services/config";
import { withModeGuard } from "../services/modeGuard";
import { validateBacklogBundle } from "../services/backlogValidator";
import { AzureDevOpsClient } from "../services/azureDevOpsClient";
import { appendBacklogMappings, BacklogMappingRecord } from "../services/mappingStore";
import { parsePrdToBacklog } from "../services/prdParser";

type ParsedBody = Record<string, unknown>;

async function readRequestBody(request: HttpRequest): Promise<ParsedBody> {
  try {
    const body = await request.json();

    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as ParsedBody;
    }
  } catch {
    return {};
  }

  return {};
}

function isBacklogBundle(value: unknown): value is BacklogBundle {
  return !!value && typeof value === "object" && "requirements" in value && "epics" in value && "stories" in value;
}

async function loadBacklogFromBodyOrPrd(body: ParsedBody): Promise<BacklogBundle> {
  if (isBacklogBundle(body)) {
    return body;
  }

  if (isBacklogBundle(body.backlog)) {
    return body.backlog;
  }

  const config = getAppConfig();
  const prdText = await readFile(config.defaultPrdPath, "utf8");
  const prdId =
    typeof body.prdId === "string" && body.prdId.trim()
      ? body.prdId.trim()
      : "prd-golden";

  return parsePrdToBacklog(prdText, prdId);
}

export const backlogExecute = withModeGuard({
  actionName: "backlog_execute",
  operationType: "write",
  handler: async ({
    request,
    mode,
    runId
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
    const backlog = await loadBacklogFromBodyOrPrd(body);
    const validation = validateBacklogBundle(backlog);

    if (!validation.ok) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error: "Backlog validation failed.",
            validation
          }
        },
        metadata: {
          validation_ok: false,
          validation_errors: validation.errors
        }
      };
    }

    const client = new AzureDevOpsClient();

    if (mode === "dry_run") {
      const preview = client.buildBacklogPreview(backlog, runId);

      return {
        response: {
          status: 200,
          jsonBody: {
            ok: true,
            mode,
            outcome: "preview",
            action: "backlog_execute",
            preview: {
              project: preview.project,
              prd_id: backlog.prd_id,
              backlog_title: backlog.title,
              epic_count: backlog.epics.length,
              story_count: backlog.stories.length,
              epics: preview.itemsToCreate
                .filter((item) => item.type === "Epic")
                .map((item) => ({
                  local_id: item.localId,
                  work_item_type: item.type,
                  payload: {
                    title: item.title,
                    description: item.description,
                    tags: [`run_id:${runId}`, `local_id:${item.localId}`]
                  }
                })),
              stories: preview.itemsToCreate
                .filter((item) => item.type === "User Story")
                .map((item) => ({
                  local_id: item.localId,
                  parent_local_id: item.parentLocalId,
                  work_item_type: item.type,
                  payload: {
                    title: item.title,
                    description: item.description,
                    tags: [`run_id:${runId}`, `local_id:${item.localId}`]
                  }
                }))
            }
          }
        },
        previewOrResultRef: `backlog_execute_preview:${backlog.prd_id}`,
        metadata: {
          prd_id: backlog.prd_id,
          backlog_title: backlog.title,
          epic_count: backlog.epics.length,
          story_count: backlog.stories.length
        }
      };
    }

    const executionResult = await client.executeBacklog(backlog, runId);

    const mappingRecords: BacklogMappingRecord[] = executionResult.created.map((item) => ({
      run_id: runId,
      local_id: item.localId,
      work_item_type: item.type,
      ado_work_item_id: item.azureDevOpsId,
      ado_url: item.url,
      parent_local_id: backlog.stories.find((story) => story.id === item.localId)?.epic_id,
      requirement_ids:
        backlog.epics.find((epic) => epic.id === item.localId)?.requirement_ids ??
        backlog.stories.find((story) => story.id === item.localId)?.requirement_ids
    }));

    const mappingPath = await appendBacklogMappings(mappingRecords);

    return {
      response: {
        status: 200,
        jsonBody: {
          ok: true,
          mode,
          outcome: "success",
          action: "backlog_execute",
          result: {
            project: config.azdoProject,
            prd_id: backlog.prd_id,
            backlog_title: backlog.title,
            epic_count: backlog.epics.length,
            story_count: backlog.stories.length,
            created_items: mappingRecords,
            mapping_path: mappingPath
          }
        }
      },
      previewOrResultRef: `backlog_execute_execute:${backlog.prd_id}`,
      metadata: {
        prd_id: backlog.prd_id,
        backlog_title: backlog.title,
        epic_count: backlog.epics.length,
        story_count: backlog.stories.length,
        mapping_path: mappingPath
      }
    };
  }
});

app.http("backlogExecute", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backlog/execute",
  handler: backlogExecute
});