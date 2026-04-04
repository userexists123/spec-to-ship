import { randomUUID } from "node:crypto";
import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Mode, OperationType, AuditOutcome } from "../schemas/audit";
import { getAppConfig } from "./config";
import { writeAuditEvent } from "./auditLogger";

interface GuardHandlerResult {
  response: HttpResponseInit;
  previewOrResultRef?: string;
  metadata?: Record<string, unknown>;
}

interface GuardHandlerArgs {
  request: HttpRequest;
  context: InvocationContext;
  mode: Mode;
  runId: string;
  requestId: string;
}

interface ModeGuardOptions {
  actionName: string;
  operationType: OperationType;
  handler: (args: GuardHandlerArgs) => Promise<GuardHandlerResult>;
}

function getMode(request: HttpRequest): Mode {
  const mode = request.query.get("mode");

  if (mode === "execute") {
    return "execute";
  }

  return "dry_run";
}

function getRunId(request: HttpRequest): string {
  return request.query.get("run_id") || request.headers.get("x-run-id") || "local-dev";
}

function getEndpoint(request: HttpRequest): string {
  return new URL(request.url).pathname;
}

function getApprovalToken(request: HttpRequest): string {
  return request.headers.get("x-approval-token") || "";
}

function getOutcome(operationType: OperationType, mode: Mode, status: number): AuditOutcome {
  if (status >= 400) {
    return "error";
  }

  if (operationType === "write" && mode === "dry_run") {
    return "preview";
  }

  return "success";
}

export function withModeGuard(options: ModeGuardOptions) {
  return async function guardedHandler(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    const config = getAppConfig();
    const mode = getMode(request);
    const runId = getRunId(request);
    const requestId = randomUUID();
    const endpoint = getEndpoint(request);

    if (options.operationType === "write" && mode === "execute") {
      const providedToken = getApprovalToken(request);

      if (!config.executeApprovalToken || providedToken !== config.executeApprovalToken) {
        await writeAuditEvent({
          timestamp: new Date().toISOString(),
          run_id: runId,
          request_id: requestId,
          endpoint,
          mode,
          operation_type: options.operationType,
          action: options.actionName,
          outcome: "blocked",
          metadata: {
            method: request.method,
            reason: "missing_or_invalid_approval_token"
          }
        });

        return {
          status: 403,
          jsonBody: {
            ok: false,
            mode,
            outcome: "blocked",
            error: "Approval token required for write operations."
          }
        };
      }
    }

    try {
      const result = await options.handler({
        request,
        context,
        mode,
        runId,
        requestId
      });

      const status = result.response.status ?? 200;
      const outcome = getOutcome(options.operationType, mode, status);

      await writeAuditEvent({
        timestamp: new Date().toISOString(),
        run_id: runId,
        request_id: requestId,
        endpoint,
        mode,
        operation_type: options.operationType,
        action: options.actionName,
        outcome,
        preview_or_result_ref: result.previewOrResultRef,
        metadata: {
          method: request.method,
          ...(result.metadata || {})
        }
      });

      return result.response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      await writeAuditEvent({
        timestamp: new Date().toISOString(),
        run_id: runId,
        request_id: requestId,
        endpoint,
        mode,
        operation_type: options.operationType,
        action: options.actionName,
        outcome: "error",
        metadata: {
          method: request.method,
          error: message
        }
      });

      return {
        status: 500,
        jsonBody: {
          ok: false,
          mode,
          outcome: "error",
          error: "Internal server error"
        }
      };
    }
  };
}