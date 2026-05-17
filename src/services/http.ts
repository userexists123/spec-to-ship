import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { getAppConfig } from "./config";

export function corsHeaders(): Record<string, string> {
  const config = getAppConfig();

  return {
    "Access-Control-Allow-Origin": config.corsOrigin,
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-approval-token,x-run-id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

export function jsonResponse(status: number, jsonBody: unknown): HttpResponseInit {
  return {
    status,
    headers: corsHeaders(),
    jsonBody
  };
}

export function emptyResponse(status = 204): HttpResponseInit {
  return {
    status,
    headers: corsHeaders()
  };
}

export async function readJsonObject(request: HttpRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();

    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}