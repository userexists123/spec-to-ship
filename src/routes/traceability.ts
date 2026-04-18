import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import type { PullRequestContextResponse } from "../schemas/pr";
import type { TraceabilityResponse } from "../schemas/traceability";
import { AzureDevOpsClient } from "../services/azureDevOpsClient";
import { attachReleaseNoteIdsToRows, generateReleaseNotes } from "../services/releaseNotes";
import {
  buildManualTraceabilityRows,
  buildTraceabilityRows
} from "../services/traceabilityStore";
import { withModeGuard } from "../services/modeGuard";

function parsePositiveInteger(value: string | null): number | null {
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

export const traceability = withModeGuard({
  actionName: "traceability",
  operationType: "read",
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
    const prdId = request.params.prdId?.trim();
    const repoId = request.query.get("repoId")?.trim();
    const prId = parsePositiveInteger(request.query.get("prId"));
    const requestedThreadId = parsePositiveInteger(request.query.get("threadId"));
    const manualStoryId = request.query.get("storyId")?.trim() || "";
    const manualAdoWorkItemId = parsePositiveInteger(request.query.get("adoWorkItemId"));

    if (!prdId) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error: "prdId is required."
          }
        },
        metadata: {
          validation_ok: false,
          validation_error: "missing_prd_id"
        }
      };
    }

    if (!repoId) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error: "repoId query parameter is required."
          }
        },
        metadata: {
          prdId,
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
            error: "prId query parameter must be a positive integer."
          }
        },
        metadata: {
          prdId,
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

    const candidateWorkItemIds = Array.from(
      new Set([...contextResult.workItems.map((item) => item.id), ...contextResult.abReferences])
    ).sort((left, right) => left - right);

    const thread = requestedThreadId
      ? (await client.getPullRequestThreads(repoId, prId)).find((item) => item.id === requestedThreadId) ?? null
      : await client.findPullRequestThreadByRunId(repoId, prId, runId);

    if (!thread) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error: requestedThreadId
              ? `No pull request thread was found for threadId ${requestedThreadId}.`
              : `No pull request thread was found for run_id ${runId}.`
          }
        },
        metadata: {
          prdId,
          repoId,
          prId,
          runId,
          validation_ok: false,
          validation_error: requestedThreadId ? "thread_not_found" : "run_id_thread_not_found"
        }
      };
    }

    const prUrl = client.buildPullRequestUrl(repoId, prId);
    const prThreadUrl = client.buildPullRequestThreadUrl(repoId, prId, thread.id);

    let traceabilityData:
      | Awaited<ReturnType<typeof buildTraceabilityRows>>
      | Awaited<ReturnType<typeof buildManualTraceabilityRows>>
      | null = null;

    if (candidateWorkItemIds.length > 0) {
      const automaticData = await buildTraceabilityRows({
        prdId,
        prId,
        prUrl,
        prThreadId: thread.id,
        prThreadUrl,
        runId,
        workItemIds: candidateWorkItemIds
      });

      if (automaticData.rows.length > 0) {
        traceabilityData = automaticData;
      }
    }

    const shouldUseManualFallback =
      !traceabilityData && Boolean(manualStoryId) && Boolean(manualAdoWorkItemId);

    if (shouldUseManualFallback) {
      const workItem = await client.getWorkItem(manualAdoWorkItemId as number);
      const workItemTitle =
        typeof workItem.fields?.["System.Title"] === "string"
          ? (workItem.fields["System.Title"] as string)
          : `Work item ${manualAdoWorkItemId}`;

      traceabilityData = await buildManualTraceabilityRows({
        prdId,
        prId,
        prUrl,
        prThreadId: thread.id,
        prThreadUrl,
        runId,
        storyId: manualStoryId,
        adoWorkItemId: manualAdoWorkItemId as number,
        adoUrl: workItem.url,
        workItemTitle
      });
    }

    if (!traceabilityData || traceabilityData.rows.length === 0) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error:
              "No traceability rows could be built from the linked work items and backlog mappings. Provide storyId and adoWorkItemId to manually join the chain."
          }
        },
        metadata: {
          prdId,
          repoId,
          prId,
          runId,
          linkedWorkItemCount: candidateWorkItemIds.length,
          manual_story_id: manualStoryId || undefined,
          manual_ado_work_item_id: manualAdoWorkItemId ?? undefined,
          validation_ok: false,
          validation_error: "no_traceability_rows"
        }
      };
    }

    const releaseNotes = generateReleaseNotes({
      prdId,
      title: traceabilityData.backlog.title,
      repoId,
      prId,
      sources: traceabilityData.sources
    });

    const result: TraceabilityResponse = {
      prdId,
      title: traceabilityData.backlog.title,
      repoId,
      prId,
      prThreadId: thread.id,
      runId,
      releaseNotes,
      rows: attachReleaseNoteIdsToRows(traceabilityData.rows, releaseNotes)
    };

    return {
      response: {
        status: 200,
        jsonBody: {
          ok: true,
          mode,
          outcome: "success",
          action: "traceability",
          result
        }
      },
      previewOrResultRef: `traceability:${prdId}:${repoId}:${prId}`,
      metadata: {
        prdId,
        repoId,
        prId,
        prThreadId: thread.id,
        runId,
        linkedWorkItemCount: candidateWorkItemIds.length,
        used_manual_fallback: shouldUseManualFallback,
        manual_story_id: shouldUseManualFallback ? manualStoryId : undefined,
        manual_ado_work_item_id: shouldUseManualFallback ? manualAdoWorkItemId : undefined,
        releaseNoteCount:
          result.releaseNotes.customerFacing.length + result.releaseNotes.internalFacing.length,
        traceabilityRowCount: result.rows.length
      }
    };
  }
});

app.http("traceability", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "traceability/{prdId}",
  handler: traceability
});