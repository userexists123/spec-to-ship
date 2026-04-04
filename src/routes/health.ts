import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getAppConfig } from "../services/config";

export async function health(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const config = getAppConfig();

  context.log("Health endpoint called");

  return {
    status: 200,
    jsonBody: {
      status: "ok",
      environment: config.environment,
      message: "Spec-to-Ship gateway is running"
    }
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: health
});