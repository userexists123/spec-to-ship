import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AuditEvent } from "../schemas/audit";
import { getAppConfig } from "./config";
import { redactMetadata } from "./redaction";

export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  const config = getAppConfig();
  const filePath = config.auditLogPath;

  const sanitizedEvent: AuditEvent = {
    ...event,
    metadata: redactMetadata(event.metadata)
  };

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(sanitizedEvent)}\n`, "utf8");
  } catch {
    console.error(
      JSON.stringify({
        fallback: "console_audit",
        event: sanitizedEvent
      })
    );
  }
}