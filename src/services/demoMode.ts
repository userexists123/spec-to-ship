import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BacklogBundle } from "../schemas/backlog";
import type { PullRequestChangesResponse, PullRequestContextResponse } from "../schemas/pr";
import type { PullRequestReviewDraft } from "../schemas/review";
import type { TraceabilityResponse } from "../schemas/traceability";
import { getAppConfig } from "./config";
import { readBacklogMappings } from "./mappingStore";

interface DemoThreadState {
  repoId: string;
  prId: number;
  threadId: number;
  runId: string;
  content: string;
  url: string;
}

function getFixturePath(fileName: string): string {
  return join(getAppConfig().demoFixtureDir, fileName);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export function isDemoModeEnabled(): boolean {
  return getAppConfig().demoMode;
}

export async function readDemoBacklog(): Promise<BacklogBundle> {
  return readJsonFile<BacklogBundle>(getAppConfig().defaultBacklogPath);
}

export async function readDemoPrContext(): Promise<PullRequestContextResponse> {
  return readJsonFile<PullRequestContextResponse>(getFixturePath("pr-context.json"));
}

export async function readDemoPrChanges(): Promise<PullRequestChangesResponse> {
  return readJsonFile<PullRequestChangesResponse>(getFixturePath("pr-changes.json"));
}

export async function readDemoPrReview(): Promise<PullRequestReviewDraft> {
  return readJsonFile<PullRequestReviewDraft>(getFixturePath("pr-review.json"));
}

export async function readDemoTraceability(): Promise<TraceabilityResponse> {
  return readJsonFile<TraceabilityResponse>(getFixturePath("traceability.json"));
}

function getThreadStatePath(): string {
  return join(dirname(getAppConfig().backlogMappingPath), "demo-pr-threads.json");
}

export async function readDemoThreadState(): Promise<DemoThreadState[]> {
  try {
    return await readJsonFile<DemoThreadState[]>(getThreadStatePath());
  } catch {
    return [];
  }
}

export async function appendDemoThreadState(thread: DemoThreadState): Promise<void> {
  const filePath = getThreadStatePath();
  const existing = await readDemoThreadState();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify([...existing, thread], null, 2), "utf8");
}

export async function buildDemoWorkItemPayload(id: number): Promise<{
  id: number;
  url: string;
  fields: Record<string, unknown>;
}> {
  const backlog = await readDemoBacklog();
  const mappings = await readBacklogMappings();
  const mapping = mappings.find((item) => item.ado_work_item_id === id);

  if (mapping) {
    const epic = backlog.epics.find((item) => item.id === mapping.local_id);
    const story = backlog.stories.find((item) => item.id === mapping.local_id);
    const item = epic ?? story;

    if (item) {
      const criteria = story?.acceptance_criteria
        .map((entry, index) => `${index + 1}. ${entry.text}`)
        .join("\n");
      const descriptionParts = [item.summary];

      if (criteria) {
        descriptionParts.push(`Acceptance Criteria\n${criteria}`);
      }

      return {
        id,
        url: mapping.ado_url,
        fields: {
          "System.Title": item.title,
          "System.WorkItemType": mapping.work_item_type,
          "System.Description": descriptionParts.join("\n\n"),
          "Microsoft.VSTS.Common.AcceptanceCriteria": criteria ?? ""
        }
      };
    }
  }

  if (id === 248) {
    return {
      id,
      url: `https://dev.azure.com/agentic-booth/fa33a4c0-e1e2-4686-a6ad-57cf9e400072/_apis/wit/workItems/${id}`,
      fields: {
        "System.Title": "Validate Rendering Performance Under Load",
        "System.WorkItemType": "Issue",
        "System.Description": [
          "Stress-test React + PixiJS rendering under multiple active units.",
          "Acceptance Criteria",
          "1. Rendering performance under multiple active units is represented in the backlog output.",
          "2. The review flow includes a concise, acceptance-criteria-grounded summary."
        ].join("\n")
      }
    };
  }

  return {
    id,
    url: `https://dev.azure.com/agentic-booth/fa33a4c0-e1e2-4686-a6ad-57cf9e400072/_apis/wit/workItems/${id}`,
    fields: {
      "System.Title": `Demo work item ${id}`,
      "System.WorkItemType": "Issue",
      "System.Description": "Demo-mode work item payload."
    }
  };
}