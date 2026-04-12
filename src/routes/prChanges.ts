import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AzureDevOpsClient } from "../services/azureDevOpsClient";
import { withModeGuard } from "../services/modeGuard";
import type {
  PullRequestChangesResponse,
  PullRequestFileChangeSummary
} from "../schemas/pr";

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

export const prChanges = withModeGuard({
  actionName: "pr_changes",
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
    const iterations = await client.getPullRequestIterations(repoId, prId);

    if (!iterations.length) {
      const result: PullRequestChangesResponse = {
        repoId,
        prId,
        fileCount: 0,
        returnedFileCount: 0,
        truncated: false,
        files: []
      };

      return {
        response: {
          status: 200,
          jsonBody: {
            ok: true,
            mode,
            outcome: "success",
            action: "pr_changes",
            result
          }
        },
        previewOrResultRef: `pr_changes:${repoId}:${prId}`,
        metadata: {
          repoId,
          prId,
          iterationCount: 0,
          fileCount: 0,
          returnedFileCount: 0,
          truncated: false
        }
      };
    }

    const latestIteration = [...iterations].sort((left, right) => right.id - left.id)[0];
    const changeEntries = await client.getPullRequestIterationChanges(
      repoId,
      prId,
      latestIteration.id
    );

    const files: PullRequestFileChangeSummary[] = changeEntries
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

    const result: PullRequestChangesResponse = {
      repoId,
      prId,
      iterationId: latestIteration.id,
      fileCount: changeEntries.length,
      returnedFileCount: files.length,
      truncated: changeEntries.length > MAX_FILES,
      files
    };

    return {
      response: {
        status: 200,
        jsonBody: {
          ok: true,
          mode,
          outcome: "success",
          action: "pr_changes",
          result
        }
      },
      previewOrResultRef: `pr_changes:${repoId}:${prId}`,
      metadata: {
        repoId,
        prId,
        iterationId: latestIteration.id,
        iterationCount: iterations.length,
        fileCount: result.fileCount,
        returnedFileCount: result.returnedFileCount,
        truncated: result.truncated
      }
    };
  }
});

app.http("pr-changes", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "repos/pull-requests/{repoId}/{prId}/changes",
  handler: prChanges
});