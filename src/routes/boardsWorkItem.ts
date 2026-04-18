import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AzureDevOpsClient } from "../services/azureDevOpsClient";
import { findBacklogMappingByAdoWorkItemId } from "../services/mappingStore";
import { withModeGuard } from "../services/modeGuard";

function parseWorkItemId(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCriteriaText(value: string): string[] {
  return value
    .replace(/\s+/g, " ")
    .replace(/(?:^|\s)(\d+)\.\s+/g, "\n$1. ")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function parseAcceptanceCriteria(
  acceptanceCriteriaField: unknown,
  descriptionField: unknown,
  localId?: string
): Array<{ id: string; text: string; storyId?: string }> {
  const rawAcceptanceCriteria =
    typeof acceptanceCriteriaField === "string" ? stripHtml(acceptanceCriteriaField) : "";

  const explicitLines = splitCriteriaText(rawAcceptanceCriteria);

  if (explicitLines.length > 0) {
    return explicitLines.map((line, index) => ({
      id: `${localId ?? "AC"}-${String(index + 1).padStart(3, "0")}`,
      text: line,
      storyId: localId
    }));
  }

  const description = typeof descriptionField === "string" ? stripHtml(descriptionField) : "";
  const blockMatch = description.match(/Acceptance Criteria\s+([\s\S]*?)(?:Source References|$)/i);

  if (!blockMatch) {
    return [];
  }

  return splitCriteriaText(blockMatch[1]).map((line, index) => ({
    id: `${localId ?? "AC"}-${String(index + 1).padStart(3, "0")}`,
    text: line,
    storyId: localId
  }));
}

export const boardsWorkItem = withModeGuard({
  actionName: "boards_work_item",
  operationType: "read",
  handler: async ({
    request,
    mode
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
    const id = parseWorkItemId(request.params.id);

    if (!id) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error: "id must be a positive integer."
          }
        },
        metadata: {
          validation_ok: false,
          validation_error: "invalid_work_item_id"
        }
      };
    }

    const client = new AzureDevOpsClient();
    const workItem = await client.getWorkItem(id);
    const mapping = await findBacklogMappingByAdoWorkItemId(id);

    const fields = workItem.fields ?? {};
    const title = typeof fields["System.Title"] === "string" ? fields["System.Title"] : "";
    const workItemType =
      typeof fields["System.WorkItemType"] === "string" ? fields["System.WorkItemType"] : "";
    const description =
      typeof fields["System.Description"] === "string" ? fields["System.Description"] : "";

    const acceptanceCriteria = parseAcceptanceCriteria(
      fields["Microsoft.VSTS.Common.AcceptanceCriteria"],
      description,
      mapping?.local_id
    );

    return {
      response: {
        status: 200,
        jsonBody: {
          ok: true,
          mode,
          outcome: "success",
          action: "boards_work_item",
          result: {
            id,
            url: workItem.url,
            title,
            workItemType,
            localId: mapping?.local_id,
            requirementIds: mapping?.requirement_ids ?? [],
            acceptanceCriteria
          }
        }
      },
      previewOrResultRef: `boards_work_item:${id}`,
      metadata: {
        workItemId: id,
        title,
        workItemType,
        acceptanceCriteriaCount: acceptanceCriteria.length
      }
    };
  }
});

app.http("boards-work-item", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "boards/work-items/{id}",
  handler: boardsWorkItem
});