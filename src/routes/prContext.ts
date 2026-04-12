import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AzureDevOpsClient } from "../services/azureDevOpsClient";
import { withModeGuard } from "../services/modeGuard";
import type { PullRequestContextResponse } from "../schemas/pr";

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

export const prContext = withModeGuard({
  actionName: "pr_context",
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
    const workItems = await client.getPullRequestWorkItems(repoId, prId);
    const abReferences = extractAbReferences(pullRequest.title, pullRequest.description);

    const result: PullRequestContextResponse = {
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
      workItems: workItems.map((workItem) => ({
        id: Number(workItem.id),
        url: workItem.url
      })),
      abReferences
    };

    return {
      response: {
        status: 200,
        jsonBody: {
          ok: true,
          mode,
          outcome: "success",
          action: "pr_context",
          result
        }
      },
      previewOrResultRef: `pr_context:${repoId}:${prId}`,
      metadata: {
        repoId,
        prId,
        status: result.status,
        workItemCount: result.workItems.length,
        abReferenceCount: result.abReferences.length
      }
    };
  }
});

app.http("pr-context", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "repos/pull-requests/{repoId}/{prId}/context",
  handler: prContext
});