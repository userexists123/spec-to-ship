import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { withModeGuard } from "../services/modeGuard";

async function parseOptionalJson(request: HttpRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();

    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }

    return {};
  } catch {
    return {};
  }
}

export const writeStub = withModeGuard({
  actionName: "write_stub",
  operationType: "write",
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
    const payload = await parseOptionalJson(request);

    if (mode === "dry_run") {
      return {
        response: {
          status: 200,
          jsonBody: {
            ok: true,
            mode,
            outcome: "preview",
            action: "write_stub",
            preview: {
              message: "WOULD_CALL",
              target: "stub write operation",
              payload_summary: payload
            }
          }
        },
        previewOrResultRef: "write_stub_preview",
        metadata: {
          payload
        }
      };
    }

    return {
      response: {
        status: 200,
        jsonBody: {
          ok: true,
          mode,
          outcome: "success",
          action: "write_stub",
          result: {
            message: "Stub write executed successfully"
          }
        }
      },
      previewOrResultRef: "write_stub_execute",
      metadata: {
        payload
      }
    };
  }
});

app.http("writeStub", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "write-stub",
  handler: writeStub
});