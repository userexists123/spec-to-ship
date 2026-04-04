export type Mode = "dry_run" | "execute";
export type OperationType = "read" | "write";

export type AuditOutcome = "preview" | "success" | "blocked" | "error";

export interface AuditEvent {
  timestamp: string;
  run_id: string;
  request_id: string;
  endpoint: string;
  mode: Mode;
  operation_type: OperationType;
  action: string;
  outcome: AuditOutcome;
  preview_or_result_ref?: string;
  metadata: Record<string, unknown>;
}