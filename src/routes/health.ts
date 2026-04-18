import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getAppConfig } from "../services/config";
import { withModeGuard } from "../services/modeGuard";

export const health = withModeGuard({
  actionName: "health_check",
  operationType: "read",
  handler: async ({
    context
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

    context.log("Health endpoint called");

    return {
      response: {
        status: 200,
        jsonBody: {
          status: "ok",
          environment: config.environment,
          demoMode: config.demoMode,
          liveApisEnabled: !config.demoMode,
          message: "Spec-to-Ship gateway is running"
        }
      },
      metadata: {
        environment: config.environment,
        demoMode: config.demoMode
      }
    };
  }
});

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: health
});