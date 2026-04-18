import { createHash } from "node:crypto";

const REDACTED_KEYS = new Set([
  "authorization",
  "pat",
  "azdo_pat",
  "azdopat",
  "token",
  "approvaltoken",
  "x-approval-token",
  "executeapprovaltoken",
  "apikey",
  "password",
  "secret",
  "cookie",
  "set-cookie"
]);

const MAX_STRING_LENGTH = 240;
const MAX_ARRAY_LENGTH = 12;
const EXCERPT_LENGTH = 100;

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function summarizeLargeText(value: string) {
  return {
    sha256: hashValue(value),
    length: value.length,
    excerpt: value.slice(0, EXCERPT_LENGTH)
  };
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      return summarizeLargeText(value);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return {
      count: value.length,
      items: value.slice(0, MAX_ARRAY_LENGTH).map(redactValue)
    };
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase();

      if (REDACTED_KEYS.has(normalizedKey)) {
        output[key] = "[REDACTED]";
        continue;
      }

      if (
        typeof nestedValue === "string" &&
        (normalizedKey.includes("diff") ||
          normalizedKey.includes("patch") ||
          normalizedKey.includes("content") ||
          normalizedKey.includes("body") ||
          normalizedKey.includes("comment") ||
          normalizedKey.includes("description") ||
          normalizedKey.includes("prd"))
      ) {
        output[key] = summarizeLargeText(nestedValue);
        continue;
      }

      output[key] = redactValue(nestedValue);
    }

    return output;
  }

  return value;
}

export function redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return redactValue(metadata) as Record<string, unknown>;
}