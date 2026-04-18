import { readFile } from "node:fs/promises";
import type { BacklogBundle, Requirement, Story } from "../schemas/backlog";
import type { TraceabilityRow } from "../schemas/traceability";
import { getAppConfig } from "./config";
import {
  readBacklogMappings,
  type BacklogMappingRecord
} from "./mappingStore";

interface TraceabilitySource {
  requirement: Requirement;
  story: Story;
  mapping: BacklogMappingRecord;
}

async function readBacklogFixture(): Promise<BacklogBundle> {
  const config = getAppConfig();
  const content = await readFile(config.defaultBacklogPath, "utf8");
  return JSON.parse(content) as BacklogBundle;
}

function buildTraceabilitySources(
  backlog: BacklogBundle,
  mappings: BacklogMappingRecord[]
): TraceabilitySource[] {
  const storyById = new Map(backlog.stories.map((story) => [story.id, story]));
  const requirementById = new Map(
    backlog.requirements.map((requirement) => [requirement.id, requirement])
  );

  const sources: TraceabilitySource[] = [];

  for (const mapping of mappings) {
    if (mapping.work_item_type !== "Issue") {
      continue;
    }

    const story = storyById.get(mapping.local_id);

    if (!story) {
      continue;
    }

    for (const requirementId of mapping.requirement_ids ?? []) {
      const requirement = requirementById.get(requirementId);

      if (!requirement) {
        continue;
      }

      sources.push({
        requirement,
        story,
        mapping
      });
    }
  }

  return sources;
}

export async function buildTraceabilityRows(params: {
  prdId: string;
  prId: number;
  prUrl: string;
  prThreadId: number;
  prThreadUrl: string;
  runId: string;
  workItemIds: number[];
}): Promise<{
  backlog: BacklogBundle;
  rows: TraceabilityRow[];
  sources: Array<{
    requirementId: string;
    requirementTitle: string;
    storyId: string;
    workItemId: number;
    workItemTitle: string;
  }>;
}> {
  const backlog = await readBacklogFixture();

  if (backlog.prd_id !== params.prdId) {
    throw new Error(
      `Traceability fixture PRD mismatch. Expected ${backlog.prd_id}, received ${params.prdId}.`
    );
  }

  const mappings = await readBacklogMappings();
  const allowedWorkItemIds = new Set(params.workItemIds);
  const sources = buildTraceabilitySources(backlog, mappings).filter((source) =>
    allowedWorkItemIds.has(source.mapping.ado_work_item_id)
  );

  const rows: TraceabilityRow[] = sources.map((source) => ({
    requirement_id: source.requirement.id,
    requirement_title: source.requirement.title,
    story_id: source.story.id,
    ado_work_item_id: source.mapping.ado_work_item_id,
    ado_url: source.mapping.ado_url,
    pr_id: params.prId,
    pr_url: params.prUrl,
    pr_thread_id: params.prThreadId,
    pr_thread_url: params.prThreadUrl,
    release_note_item_id: "",
    run_id: params.runId
  }));

  return {
    backlog,
    rows,
    sources: sources.map((source) => ({
      requirementId: source.requirement.id,
      requirementTitle: source.requirement.title,
      storyId: source.story.id,
      workItemId: source.mapping.ado_work_item_id,
      workItemTitle: source.story.title
    }))
  };
}

export async function buildManualTraceabilityRows(params: {
  prdId: string;
  prId: number;
  prUrl: string;
  prThreadId: number;
  prThreadUrl: string;
  runId: string;
  storyId: string;
  adoWorkItemId: number;
  adoUrl: string;
  workItemTitle: string;
}): Promise<{
  backlog: BacklogBundle;
  rows: TraceabilityRow[];
  sources: Array<{
    requirementId: string;
    requirementTitle: string;
    storyId: string;
    workItemId: number;
    workItemTitle: string;
  }>;
}> {
  const backlog = await readBacklogFixture();

  if (backlog.prd_id !== params.prdId) {
    throw new Error(
      `Traceability fixture PRD mismatch. Expected ${backlog.prd_id}, received ${params.prdId}.`
    );
  }

  const story = backlog.stories.find((item) => item.id === params.storyId);

  if (!story) {
    throw new Error(`Story ${params.storyId} was not found in the backlog fixture.`);
  }

  const requirementById = new Map(
    backlog.requirements.map((requirement) => [requirement.id, requirement])
  );

  const matchedRequirements = story.requirement_ids
    .map((requirementId) => requirementById.get(requirementId))
    .filter((requirement): requirement is Requirement => Boolean(requirement));

  const rows: TraceabilityRow[] = matchedRequirements.map((requirement) => ({
    requirement_id: requirement.id,
    requirement_title: requirement.title,
    story_id: story.id,
    ado_work_item_id: params.adoWorkItemId,
    ado_url: params.adoUrl,
    pr_id: params.prId,
    pr_url: params.prUrl,
    pr_thread_id: params.prThreadId,
    pr_thread_url: params.prThreadUrl,
    release_note_item_id: "",
    run_id: params.runId
  }));

  return {
    backlog,
    rows,
    sources: matchedRequirements.map((requirement) => ({
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      storyId: story.id,
      workItemId: params.adoWorkItemId,
      workItemTitle: params.workItemTitle
    }))
  };
}