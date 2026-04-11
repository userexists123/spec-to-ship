import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { readFile } from "node:fs/promises";
import { BacklogBundle, Epic, Story } from "../schemas/backlog";
import { getAppConfig } from "../services/config";
import { withModeGuard } from "../services/modeGuard";
import { validateBacklogBundle } from "../services/backlogValidator";
import {
  AzureDevOpsClient,
  AzureDevOpsCreatedWorkItem,
  AzureDevOpsWorkItemPayload
} from "../services/azureDevOpsClient";
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

function buildEpicPayload(epic: Epic, runId: string): AzureDevOpsWorkItemPayload {
  return {
    title: `${epic.id} ${epic.title}`,
    description: epic.summary,
    tags: [`run_id:${runId}`, `local_id:${epic.id}`]
  };
}

function buildStoryPayload(story: Story, runId: string, parentId?: number): AzureDevOpsWorkItemPayload {
  return {
    title: `${story.id} ${story.title}`,
    description: [
      `<p>${story.summary}</p>`,
      `<p><strong>Requirement IDs:</strong> ${story.requirement_ids.join(", ")}</p>`,
      "<p><strong>Acceptance Criteria:</strong></p>",
      "<ul>",
      ...story.acceptance_criteria.map((criterion) => `<li>${criterion.id}: ${criterion.text}</li>`),
      "</ul>"
    ].join(""),
    tags: [`run_id:${runId}`, `local_id:${story.id}`],
    parentId
  };
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

    const storyWorkItemType = config.storyWorkItemType;

    const epicPayloads = backlog.epics.map((epic) => ({
      local_id: epic.id,
      work_item_type: "Epic",
      payload: buildEpicPayload(epic, runId)
    }));

    const storyPayloads = backlog.stories.map((story) => ({
      local_id: story.id,
      parent_local_id: story.epic_id,
      work_item_type: storyWorkItemType,
      payload: buildStoryPayload(story, runId)
    }));

    if (mode === "dry_run") {
      return {
        response: {
          status: 200,
          jsonBody: {
            ok: true,
            mode,
            outcome: "preview",
            action: "backlog_execute",
            preview: {
              project: config.azdoProject,
              prd_id: backlog.prd_id,
              backlog_title: backlog.title,
              epic_count: epicPayloads.length,
              story_count: storyPayloads.length,
              epics: epicPayloads,
              stories: storyPayloads
            }
          }
        },
        previewOrResultRef: `backlog_execute_preview:${backlog.prd_id}`,
        metadata: {
          prd_id: backlog.prd_id,
          backlog_title: backlog.title,
          epic_count: epicPayloads.length,
          story_count: storyPayloads.length
        }
      };
    }

    const client = new AzureDevOpsClient(config.azdoOrgUrl, config.azdoProject, config.azdoPat);
    const createdEpicMap = new Map<string, AzureDevOpsCreatedWorkItem>();
    const mappingRecords: BacklogMappingRecord[] = [];

    for (const epic of backlog.epics) {
      const payload = buildEpicPayload(epic, runId);
      const createdEpic = await client.createWorkItem("Epic", payload);

      createdEpicMap.set(epic.id, createdEpic);
      mappingRecords.push({
        run_id: runId,
        local_id: epic.id,
        work_item_type: "Epic",
        ado_work_item_id: createdEpic.id,
        ado_url: createdEpic.webUrl || createdEpic.url,
        requirement_ids: epic.requirement_ids
      });
    }

    for (const story of backlog.stories) {
      const parentEpic = createdEpicMap.get(story.epic_id);
      const payload = buildStoryPayload(story, runId, parentEpic?.id);
      const createdStory = await client.createWorkItem(storyWorkItemType, payload);

      mappingRecords.push({
        run_id: runId,
        local_id: story.id,
        work_item_type: storyWorkItemType,
        ado_work_item_id: createdStory.id,
        ado_url: createdStory.webUrl || createdStory.url,
        parent_local_id: story.epic_id,
        requirement_ids: story.requirement_ids
      });
    }

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