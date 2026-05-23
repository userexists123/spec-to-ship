import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { AzureDevOpsClient } from "../services/azureDevOpsClient";
import { validateBacklogBundle } from "../services/backlogValidator";
import { getAppConfig } from "../services/config";
import { emptyResponse, jsonResponse, readJsonObject } from "../services/http";
import {
  getBacklogDraft,
  insertWorkItemMappings,
  parseBacklogDraftUpdateBody,
  saveDraftExecution,
  saveDraftPreview,
  updateBacklogDraft
} from "../services/prdStore";

function getRunId(request: HttpRequest, draftId: string): string {
  return request.headers.get("x-run-id") || request.query.get("run_id") || `draft-${draftId}-${randomUUID()}`;
}

function getApprovalToken(request: HttpRequest): string {
  return request.headers.get("x-approval-token") || "";
}

function toPreviewResponse(preview: ReturnType<AzureDevOpsClient["buildBacklogPreview"]>) {
  return {
    runId: preview.runId,
    project: preview.project,
    itemCount: preview.itemsToCreate.length,
    epicCount: preview.itemsToCreate.filter((item) => item.type === "Epic").length,
    issueCount: preview.itemsToCreate.filter((item) => item.type === "Issue").length,
    items: preview.itemsToCreate.map((item) => ({
      localId: item.localId,
      parentLocalId: item.parentLocalId,
      workItemType: item.type,
      title: item.title,
      description: item.description,
      requirementIds: item.requirementIds || [],
      patch: item.patch
    }))
  };
}

export async function getBacklogDraftRoute(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

    return jsonResponse(200, { ok: true, draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backlog draft loading error.";
    context.log(`Get backlog draft route failed: ${message}`);
    return jsonResponse(500, { ok: false, error: message });
  }
}

export async function updateBacklogDraftRoute(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const draftId = request.params.id;

    if (!draftId) {
      return jsonResponse(400, { ok: false, error: "Draft id is required." });
    }

    const body = await readJsonObject(request);
    const backlog = parseBacklogDraftUpdateBody(body);
    const validation = validateBacklogBundle(backlog);

    if (!validation.ok) {
      return jsonResponse(400, {
        ok: false,
        error: "Edited backlog draft is not valid.",
        validation
      });
    }

    const draft = await updateBacklogDraft({ draftId, backlog });

    return jsonResponse(200, {
      ok: true,
      draft,
      validation
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backlog draft update error.";
    context.log(`Update backlog draft route failed: ${message}`);
    return jsonResponse(500, { ok: false, error: message });
  }
}

export async function previewBacklogDraftRoute(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

    const validation = validateBacklogBundle(draft.draft);

    if (!validation.ok) {
      return jsonResponse(400, {
        ok: false,
        error: "Backlog draft is not valid for preview.",
        validation
      });
    }

    const runId = getRunId(request, draftId);
    const client = new AzureDevOpsClient();
    const preview = toPreviewResponse(client.buildBacklogPreview(draft.draft, runId));

    await saveDraftPreview({ draftId, preview });

    const refreshedDraft = await getBacklogDraft(draftId);

    return jsonResponse(200, {
      ok: true,
      preview,
      draft: refreshedDraft,
      validation
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backlog draft preview error.";
    context.log(`Preview backlog draft route failed: ${message}`);
    return jsonResponse(500, { ok: false, error: message });
  }
}

export async function executeBacklogDraftRoute(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const draftId = request.params.id;

    if (!draftId) {
      return jsonResponse(400, { ok: false, error: "Draft id is required." });
    }

    const config = getAppConfig();
    const approvalToken = getApprovalToken(request);

    if (!config.executeApprovalToken || approvalToken !== config.executeApprovalToken) {
      return jsonResponse(403, {
        ok: false,
        outcome: "blocked",
        error: "Approval token required for Azure DevOps item creation."
      });
    }

    const draft = await getBacklogDraft(draftId);

    if (!draft) {
      return jsonResponse(404, { ok: false, error: "Backlog draft was not found." });
    }

    if (draft.mappings.length > 0) {
      return jsonResponse(409, {
        ok: false,
        error: "This draft already has Azure DevOps mappings. Create a new draft or remove mappings manually before executing again.",
        mappings: draft.mappings
      });
    }

    const validation = validateBacklogBundle(draft.draft);

    if (!validation.ok) {
      return jsonResponse(400, {
        ok: false,
        error: "Backlog draft is not valid for Azure DevOps creation.",
        validation
      });
    }

    const runId = getRunId(request, draftId);
    const client = new AzureDevOpsClient();
    const execution = await client.executeBacklog(draft.draft, runId);
    const mappings = await insertWorkItemMappings({
      draftId,
      mappings: execution.created.map((item) => ({
        runId,
        localId: item.localId,
        workItemType: item.type,
        adoWorkItemId: item.azureDevOpsId,
        adoUrl: item.url,
        parentLocalId: draft.draft.stories.find((story) => story.id === item.localId)?.epic_id,
        parentAdoWorkItemId: item.parentAzureDevOpsId,
        requirementIds: item.requirementIds || []
      }))
    });

    const result = {
      runId,
      project: execution.project,
      createdCount: execution.created.length,
      createdItems: mappings.map((mapping) => ({
        localId: mapping.localId,
        workItemType: mapping.workItemType,
        adoWorkItemId: mapping.adoWorkItemId,
        adoUrl: mapping.adoUrl,
        parentLocalId: mapping.parentLocalId,
        parentAdoWorkItemId: mapping.parentAdoWorkItemId,
        requirementIds: mapping.requirementIds
      }))
    };

    await saveDraftExecution({ draftId, execution: result });

    const refreshedDraft = await getBacklogDraft(draftId);

    return jsonResponse(200, {
      ok: true,
      outcome: "success",
      result,
      draft: refreshedDraft,
      validation
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backlog draft execute error.";
    context.log(`Execute backlog draft route failed: ${message}`);
    return jsonResponse(500, { ok: false, error: message });
  }
}

app.http("getBacklogDraft", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "backlog/drafts/{id}",
  handler: getBacklogDraftRoute
});

app.http("updateBacklogDraft", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "backlog/drafts/{id}",
  handler: updateBacklogDraftRoute
});

app.http("previewBacklogDraft", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "backlog/drafts/{id}/preview",
  handler: previewBacklogDraftRoute
});

app.http("executeBacklogDraft", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "backlog/drafts/{id}/execute",
  handler: executeBacklogDraftRoute
});