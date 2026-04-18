import type { ReleaseNotesDraft, ReleaseNoteItem, TraceabilityRow } from "../schemas/traceability";

interface ReleaseNoteSource {
  requirementId: string;
  requirementTitle: string;
  storyId: string;
  workItemId: number;
  workItemTitle: string;
}

function uniqueBy<T>(values: T[], keySelector: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = keySelector(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function buildCustomerFacingItem(source: ReleaseNoteSource, index: number): ReleaseNoteItem {
  return {
    id: `RN-${String(index + 1).padStart(3, "0")}`,
    requirementId: source.requirementId,
    title: source.requirementTitle,
    summary: `${source.requirementTitle} is now represented in the prototype workflow through ${source.workItemTitle.toLowerCase()}.`
  };
}

function buildInternalFacingItem(source: ReleaseNoteSource, index: number): ReleaseNoteItem {
  return {
    id: `RN-${String(index + 101).padStart(3, "0")}`,
    requirementId: source.requirementId,
    title: `${source.requirementTitle} implementation trace`,
    summary: `Tracked via ${source.storyId} and Azure DevOps work item ${source.workItemId} (${source.workItemTitle}).`
  };
}

export function generateReleaseNotes(params: {
  prdId: string;
  title: string;
  repoId: string;
  prId: number;
  sources: ReleaseNoteSource[];
}): ReleaseNotesDraft {
  const uniqueSources = uniqueBy(params.sources, (source) => source.requirementId).slice(0, 2);

  return {
    prdId: params.prdId,
    repoId: params.repoId,
    prId: params.prId,
    customerFacing: uniqueSources.map(buildCustomerFacingItem),
    internalFacing: uniqueSources.map(buildInternalFacingItem)
  };
}

export function attachReleaseNoteIdsToRows(
  rows: TraceabilityRow[],
  notes: ReleaseNotesDraft
): TraceabilityRow[] {
  const noteByRequirementId = new Map<string, string>();

  for (const note of [...notes.customerFacing, ...notes.internalFacing]) {
    if (!noteByRequirementId.has(note.requirementId)) {
      noteByRequirementId.set(note.requirementId, note.id);
    }
  }

  return rows.map((row) => ({
    ...row,
    release_note_item_id: noteByRequirementId.get(row.requirement_id) ?? row.release_note_item_id
  }));
}