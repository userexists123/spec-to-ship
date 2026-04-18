import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import type { PullRequestReviewDraft } from "../schemas/review";
import { AzureDevOpsClient } from "../services/azureDevOpsClient";
import { withModeGuard } from "../services/modeGuard";
import { formatPrReviewComment } from "../services/prCommentFormatter";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReviewCriterionStatus(value: unknown): value is "met" | "partial" | "not_evident" {
  return value === "met" || value === "partial" || value === "not_evident";
}

function isPullRequestReviewDraft(value: unknown): value is PullRequestReviewDraft {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.repoId === "string" &&
    typeof value.prId === "number" &&
    typeof value.summary === "string" &&
    Array.isArray(value.linkedWorkItemIds) &&
    Array.isArray(value.requirementIds) &&
    Array.isArray(value.checklist) &&
    value.checklist.every(
      (item) =>
        isRecord(item) &&
        typeof item.criterionId === "string" &&
        typeof item.workItemId === "number" &&
        typeof item.workItemTitle === "string" &&
        Array.isArray(item.requirementIds) &&
        typeof item.criterion === "string" &&
        isReviewCriterionStatus(item.status) &&
        Array.isArray(item.evidence) &&
        typeof item.note === "string"
    ) &&
    Array.isArray(value.findings) &&
    value.findings.every(
      (item) =>
        isRecord(item) &&
        (item.type === "strength" ||
          item.type === "gap" ||
          item.type === "scope_creep" ||
          item.type === "follow_up") &&
        typeof item.message === "string"
    ) &&
    Array.isArray(value.possibleScopeCreep) &&
    Array.isArray(value.followUps)
  );
}

async function readReviewFromRequest(request: HttpRequest): Promise<PullRequestReviewDraft | null> {
  const body = await request.json();

  if (isPullRequestReviewDraft(body)) {
    return body;
  }

  if (isRecord(body) && isPullRequestReviewDraft(body.review)) {
    return body.review;
  }

  return null;
}

export const prComment = withModeGuard({
  actionName: "pr_comment",
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

    const review = await readReviewFromRequest(request);

    if (!review) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error: "Request body must contain a valid review draft or { review: ... }."
          }
        },
        metadata: {
          repoId,
          prId,
          validation_ok: false,
          validation_error: "invalid_review_payload"
        }
      };
    }

    if (review.repoId !== repoId || review.prId !== prId) {
      return {
        response: {
          status: 400,
          jsonBody: {
            ok: false,
            mode,
            outcome: "error",
            error: "Route repoId/prId must match the review payload."
          }
        },
        metadata: {
          repoId,
          prId,
          review_repo_id: review.repoId,
          review_pr_id: review.prId,
          validation_ok: false,
          validation_error: "route_payload_mismatch"
        }
      };
    }

    const commentBody = formatPrReviewComment(review, runId);

    if (mode === "dry_run") {
      return {
        response: {
          status: 200,
          jsonBody: {
            ok: true,
            mode,
            outcome: "preview",
            action: "pr_comment",
            result: {
              repoId,
              prId,
              runId,
              commentBody
            }
          }
        },
        previewOrResultRef: `pr_comment:${repoId}:${prId}:${runId}`,
        metadata: {
          repoId,
          prId,
          runId,
          body_length: commentBody.length,
          checklist_count: review.checklist.length
        }
      };
    }

    const client = new AzureDevOpsClient();
    const existingThread = await client.findPullRequestThreadByRunId(repoId, prId, runId);

    if (existingThread) {
      return {
        response: {
          status: 200,
          jsonBody: {
            ok: true,
            mode,
            outcome: "success",
            action: "pr_comment",
            result: {
              repoId,
              prId,
              runId,
              threadId: existingThread.id,
              url: client.buildPullRequestThreadUrl(repoId, prId, existingThread.id),
              duplicatePrevented: true
            }
          }
        },
        previewOrResultRef: `pr_comment_thread:${repoId}:${prId}:${existingThread.id}`,
        metadata: {
          repoId,
          prId,
          runId,
          thread_id: existingThread.id,
          duplicate_prevented: true
        }
      };
    }

    const createdThread = await client.createPullRequestThread(repoId, prId, commentBody);

    return {
      response: {
        status: 200,
        jsonBody: {
          ok: true,
          mode,
          outcome: "success",
          action: "pr_comment",
          result: {
            repoId,
            prId,
            runId,
            threadId: createdThread.id,
            url: client.buildPullRequestThreadUrl(repoId, prId, createdThread.id),
            duplicatePrevented: false
          }
        }
      },
      previewOrResultRef: `pr_comment_thread:${repoId}:${prId}:${createdThread.id}`,
      metadata: {
        repoId,
        prId,
        runId,
        thread_id: createdThread.id,
        duplicate_prevented: false,
        body_length: commentBody.length
      }
    };
  }
});

app.http("pr-comment", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "repos/pull-requests/{repoId}/{prId}/comment",
  handler: prComment
});