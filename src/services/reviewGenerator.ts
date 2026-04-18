import type { PullRequestChangesResponse, PullRequestContextResponse } from "../schemas/pr";
import type {
  PullRequestReviewDraft,
  ReviewCriterionAssessment,
  ReviewCriterionStatus,
  ReviewFinding
} from "../schemas/review";

export interface ReviewWorkItemInput {
  id: number;
  title: string;
  requirementIds: string[];
  acceptanceCriteria: Array<{
    id: string;
    text: string;
    storyId?: string;
  }>;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "with",
  "by",
  "is",
  "are",
  "be",
  "as",
  "from",
  "that",
  "this",
  "it",
  "at",
  "into",
  "than",
  "then",
  "must",
  "should",
  "can",
  "user",
  "users",
  "system"
]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s/_-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function toEvidenceLine(path: string, summary: string): string {
  return `${path}: ${summary}`;
}

function classifyCriterion(
  criterion: string,
  changes: PullRequestChangesResponse
): {
  status: ReviewCriterionStatus;
  evidence: string[];
  note: string;
} {
  const criterionTokens = unique(tokenize(criterion));
  const scoredMatches = changes.files
    .map((file) => {
      const haystack = normalizeText(`${file.path} ${file.summary}`);
      const matchedTokens = criterionTokens.filter((token) => haystack.includes(token));

      return {
        file,
        score: matchedTokens.length
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const evidence = scoredMatches
    .slice(0, 3)
    .map((entry) => toEvidenceLine(entry.file.path, entry.file.summary));

  if (scoredMatches.length === 0) {
    return {
      status: "not_evident",
      evidence: [],
      note: "No changed file or summary point clearly supports this criterion."
    };
  }

  const best = scoredMatches[0];

  if (best.score >= 2) {
    return {
      status: "met",
      evidence,
      note: "PR changes contain direct evidence that maps to this criterion."
    };
  }

  return {
    status: "partial",
    evidence,
    note: "There is some related evidence, but coverage is not strong enough to mark fully met."
  };
}

function buildSummary(checklist: ReviewCriterionAssessment[]): string {
  const met = checklist.filter((item) => item.status === "met").length;
  const partial = checklist.filter((item) => item.status === "partial").length;
  const notEvident = checklist.filter((item) => item.status === "not_evident").length;

  return `Reviewed ${checklist.length} acceptance criteria: ${met} met, ${partial} partial, ${notEvident} not evident.`;
}

function buildScopeCreepNotes(
  changes: PullRequestChangesResponse,
  checklist: ReviewCriterionAssessment[]
): string[] {
  const evidencePaths = new Set<string>();

  for (const item of checklist) {
    for (const evidence of item.evidence) {
      const separatorIndex = evidence.indexOf(":");
      if (separatorIndex > 0) {
        evidencePaths.add(evidence.slice(0, separatorIndex));
      }
    }
  }

  return changes.files
    .filter((file) => !evidencePaths.has(file.path))
    .filter((file) => {
      const path = file.path.toLowerCase();

      return (
        path.includes("/config") ||
        path.endsWith(".json") ||
        path.endsWith(".yml") ||
        path.endsWith(".yaml") ||
        path.endsWith(".md") ||
        path.includes("/infra") ||
        path.includes("/scripts")
      );
    })
    .slice(0, 3)
    .map(
      (file) =>
        `Changed ${file.path} but it does not map clearly to the linked acceptance criteria.`
    );
}

function buildFindings(
  checklist: ReviewCriterionAssessment[],
  possibleScopeCreep: string[]
): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  for (const item of checklist.filter((entry) => entry.status === "met").slice(0, 2)) {
    findings.push({
      type: "strength",
      message: `${item.criterionId} looks implemented based on ${item.evidence[0] ?? "the changed files"}.`
    });
  }

  for (const item of checklist.filter((entry) => entry.status !== "met").slice(0, 3)) {
    findings.push({
      type: "gap",
      message: `${item.criterionId} is ${item.status.replace("_", " ")}. ${item.note}`
    });
  }

  for (const note of possibleScopeCreep) {
    findings.push({
      type: "scope_creep",
      message: note
    });
  }

  return findings.slice(0, 6);
}

function buildFollowUps(checklist: ReviewCriterionAssessment[]): string[] {
  return checklist
    .filter((item) => item.status !== "met")
    .slice(0, 3)
    .map((item) => `Recheck ${item.criterionId} with more explicit evidence or tests.`);
}

export function generateReviewDraft(params: {
  context: PullRequestContextResponse;
  changes: PullRequestChangesResponse;
  workItems: ReviewWorkItemInput[];
}): PullRequestReviewDraft {
  const { context, changes, workItems } = params;

  const checklist: ReviewCriterionAssessment[] = workItems.flatMap((workItem) =>
    workItem.acceptanceCriteria.map((criterion) => {
      const classification = classifyCriterion(criterion.text, changes);

      return {
        criterionId: criterion.id,
        storyId: criterion.storyId,
        workItemId: workItem.id,
        workItemTitle: workItem.title,
        requirementIds: workItem.requirementIds,
        criterion: criterion.text,
        status: classification.status,
        evidence: classification.evidence,
        note: classification.note
      };
    })
  );

  const requirementIds = unique(workItems.flatMap((workItem) => workItem.requirementIds)).sort();
  const possibleScopeCreep = buildScopeCreepNotes(changes, checklist);

  return {
    repoId: context.repoId,
    prId: context.prId,
    summary: buildSummary(checklist),
    linkedWorkItemIds: workItems.map((item) => item.id),
    requirementIds,
    checklist,
    findings: buildFindings(checklist, possibleScopeCreep),
    possibleScopeCreep,
    followUps: buildFollowUps(checklist)
  };
}