import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AzureDevOpsClient } from "../services/azureDevOpsClient";
import { findBacklogMappingByAdoWorkItemId } from "../services/mappingStore";
import { withModeGuard } from "../services/modeGuard";
import type { PullRequestChangesResponse, PullRequestContextResponse } from "../schemas/pr";
import { generateReviewDraft, type ReviewWorkItemInput } from "../services/reviewGenerator";

const MAX_FILES = 50;
const MAX_SUMMARY_LENGTH = 160;

function parsePullRequestId(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function extractAbReferences(...values: Array<string | undefined>): number[] {
  const ids = new Set<number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    const matches = value.matchAll(/\bAB#(\d+)\b/gi);

    for (const match of matches) {
      const parsed = Number(match[1]);

      if (Number.isInteger(parsed) && parsed > 0) {
        ids.add(parsed);
      }
    }
  }

  return Array.from(ids).sort((left, right) => left - right);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function summarizeChange(path: string, changeType: string): string {
  switch (changeType.toLowerCase()) {
    case "add":
      return `Added ${path}.`;
    case "delete":
      return `Deleted ${path}.`;
    case "rename":
      return `Renamed ${path}.`;
    case "edit":
      return `Modified ${path}.`;
    default:
      return `Updated ${path}.`;
  }
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

export const prReview = withModeGuard({
  actionName: "pr_review",
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
    const repoId = request.params.repoId?.trim();
    const prId = parsePullRequestId(request.params.prId);

    if (!repoId) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error: "repoId is required."
          }
        },
        metadata: {
          validation_ok: false,
          validation_error: "missing_repo_id"
        }
      };
    }

    if (!prId) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error: "prId must be a positive integer."
          }
        },
        metadata: {
          repoId,
          validation_ok: false,
          validation_error: "invalid_pr_id"
        }
      };
    }

    const client = new AzureDevOpsClient();
    const pullRequest = await client.getPullRequest(repoId, prId);
    const linkedWorkItems = await client.getPullRequestWorkItems(repoId, prId);
    const abReferences = extractAbReferences(pullRequest.title, pullRequest.description);

    const contextResult: PullRequestContextResponse = {
      repoId,
      prId,
      title: pullRequest.title ?? "",
      description: pullRequest.description ?? "",
      status: pullRequest.status ?? "unknown",
      sourceRefName: pullRequest.sourceRefName,
      targetRefName: pullRequest.targetRefName,
      createdBy: pullRequest.createdBy
        ? {
            displayName: pullRequest.createdBy.displayName,
            uniqueName: pullRequest.createdBy.uniqueName
          }
        : undefined,
      workItems: linkedWorkItems.map((workItem) => ({
        id: Number(workItem.id),
        url: workItem.url
      })),
      abReferences
    };

    const iterations = await client.getPullRequestIterations(repoId, prId);

    const changesResult: PullRequestChangesResponse = {
      repoId,
      prId,
      fileCount: 0,
      returnedFileCount: 0,
      truncated: false,
      files: []
    };

    if (iterations.length) {
      const latestIteration = [...iterations].sort((left, right) => right.id - left.id)[0];
      const changeEntries = await client.getPullRequestIterationChanges(
        repoId,
        prId,
        latestIteration.id
      );

      changesResult.iterationId = latestIteration.id;
      changesResult.fileCount = changeEntries.length;
      changesResult.files = changeEntries
        .filter((entry) => Boolean(entry.item?.path))
        .slice(0, MAX_FILES)
        .map((entry) => {
          const path = entry.item?.path ?? "unknown";
          const changeType = entry.changeType ?? "edit";

          return {
            path,
            changeType,
            isBinary: entry.item?.gitObjectType === "blob" ? false : undefined,
            summary: truncateText(summarizeChange(path, changeType), MAX_SUMMARY_LENGTH)
          };
        });
      changesResult.returnedFileCount = changesResult.files.length;
      changesResult.truncated = changeEntries.length > MAX_FILES;
    }

    const candidateWorkItemIds = Array.from(
      new Set([...contextResult.workItems.map((item) => item.id), ...contextResult.abReferences])
    ).sort((left, right) => left - right);

    const workItems: ReviewWorkItemInput[] = [];

    for (const workItemId of candidateWorkItemIds) {
      const workItem = await client.getWorkItem(workItemId);
      const mapping = await findBacklogMappingByAdoWorkItemId(workItemId);
      const fields = workItem.fields ?? {};

      const title = typeof fields["System.Title"] === "string" ? fields["System.Title"] : "";
      const acceptanceCriteria = parseAcceptanceCriteria(
        fields["Microsoft.VSTS.Common.AcceptanceCriteria"],
        fields["System.Description"],
        mapping?.local_id
      );

      if (!acceptanceCriteria.length) {
        continue;
      }

      workItems.push({
        id: workItemId,
        title,
        requirementIds: mapping?.requirement_ids ?? [],
        acceptanceCriteria
      });
    }

    const review = generateReviewDraft({
      context: contextResult,
      changes: changesResult,
      workItems
    });

    return {
      response: {
        status: 200,
        jsonBody: {
          ok: true,
          mode,
          outcome: "success",
          action: "pr_review",
          result: review
        }
      },
      previewOrResultRef: `pr_review:${repoId}:${prId}`,
      metadata: {
        repoId,
        prId,
        linkedWorkItemCount: contextResult.workItems.length,
        abReferenceCount: contextResult.abReferences.length,
        reviewWorkItemCount: workItems.length,
        checklistCount: review.checklist.length
      }
    };
  }
});

app.http("pr-review", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "repos/pull-requests/{repoId}/{prId}/review",
  handler: prReview
});