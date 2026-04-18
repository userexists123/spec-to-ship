export interface ReleaseNoteItem {
  id: string;
  requirementId: string;
  title: string;
  summary: string;
}

export interface ReleaseNotesDraft {
  prdId: string;
  repoId: string;
  prId: number;
  customerFacing: ReleaseNoteItem[];
  internalFacing: ReleaseNoteItem[];
}

export interface TraceabilityRow {
  requirement_id: string;
  requirement_title: string;
  story_id: string;
  ado_work_item_id: number;
  ado_url: string;
  pr_id: number;
  pr_url: string;
  pr_thread_id: number;
  pr_thread_url: string;
  release_note_item_id: string;
  run_id: string;
}

export interface TraceabilityResponse {
  prdId: string;
  title: string;
  repoId: string;
  prId: number;
  prThreadId: number;
  runId: string;
  releaseNotes: ReleaseNotesDraft;
  rows: TraceabilityRow[];
}