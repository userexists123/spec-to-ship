import type { PullRequestChangesResponse, PullRequestContextResponse } from "../schemas/pr";
import type {
  PullRequestReviewDraft,
  ReviewConfidence,
  ReviewCriterionAssessment,
  ReviewCriterionStatus,
  ReviewFinding
} from "../schemas/review";

export interface ReviewWorkItemInput {
  id: number | null;
  title: string;
  localBacklogItemId?: string;
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
  "system",
  "pm",
  "page",
  "show",
  "shows",
  "able",
  "when",
  "given"
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

function missingEvidenceFor(status: ReviewCriterionStatus, criterionTokens: string[]): string[] {
  if (status === "met" || status === "not_applicable") {
    return [];
  }

  const importantTokens = criterionTokens.slice(0, 5);

  if (importantTokens.length === 0) {
    return ["No clear testable keywords were found in the acceptance criterion."];
  }

  return [`No direct changed-file evidence was found for: ${importantTokens.join(", ")}.`];
}

function classifyCriterion(
  criterion: string,
  changes: PullRequestChangesResponse
): {
  status: ReviewCriterionStatus;
  evidence: string[];
  missingEvidence: string[];
  rationale: string;
  confidence: ReviewConfidence;
} {
  const criterionTokens = unique(tokenize(criterion));

  if (criterionTokens.length === 0) {
    return {
      status: "not_applicable",
      evidence: [],
      missingEvidence: ["Criterion text is too vague to map to changed files."],
      rationale: "The criterion did not contain enough specific terms for evidence matching.",
      confidence: "Low"
    };
  }

  const scoredMatches = changes.files
    .map((file) => {
      const haystack = normalizeText(`${file.path} ${file.summary}`);
      const matchedTokens = criterionTokens.filter((token) => haystack.includes(token));

      return {
        file,
        matchedTokens,
        score: matchedTokens.length
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const evidence = scoredMatches
    .slice(0, 4)
    .map((entry) => `${toEvidenceLine(entry.file.path, entry.file.summary)} Matched: ${entry.matchedTokens.join(", ")}.`);

  if (scoredMatches.length === 0) {
    return {
      status: "not_evident",
      evidence: [],
      missingEvidence: missingEvidenceFor("not_evident", criterionTokens),
      rationale: "No changed file path or change summary clearly supports this acceptance criterion.",
      confidence: "Medium"
    };
  }

  const best = scoredMatches[0];

  if (best.score >= 3) {
    return {
      status: "met",
      evidence,
      missingEvidence: [],
      rationale: "PR changed-file evidence contains multiple terms that directly map to this criterion.",
      confidence: "High"
    };
  }

  if (best.score >= 2) {
    return {
      status: "partial",
      evidence,
      missingEvidence: missingEvidenceFor("partial", criterionTokens),
      rationale: "PR changed-file evidence is related, but not strong enough to mark the criterion fully met.",
      confidence: "Medium"
    };
  }

  return {
    status: "partial",
    evidence,
    missingEvidence: missingEvidenceFor("partial", criterionTokens),
    rationale: "A weak file-level signal was found, but evidence is indirect.",
    confidence: "Low"
  };
}

function buildSummary(checklist: ReviewCriterionAssessment[]): string {
  const met = checklist.filter((item) => item.status === "met").length;
  const partial = checklist.filter((item) => item.status === "partial").length;
  const notEvident = checklist.filter((item) => item.status === "not_evident").length;
  const notApplicable = checklist.filter((item) => item.status === "not_applicable").length;

  return `Reviewed ${checklist.length} acceptance criteria: ${met} met, ${partial} partial, ${notEvident} not evident, ${notApplicable} not applicable.`;
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
    .slice(0, 5)
    .map((file) => `Changed ${file.path}, but it does not map clearly to the linked acceptance criteria.`);
}

function buildFindings(
  checklist: ReviewCriterionAssessment[],
  possibleScopeCreep: string[]
): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  for (const item of checklist.filter((entry) => entry.status === "met").slice(0, 3)) {
    findings.push({
      type: "strength",
      message: `${item.criterionId} looks supported by PR evidence.`
    });
  }

  for (const item of checklist.filter((entry) => entry.status === "partial").slice(0, 3)) {
    findings.push({
      type: "gap",
      message: `${item.criterionId} is partial. ${item.rationale}`
    });
  }

  for (const item of checklist.filter((entry) => entry.status === "not_evident").slice(0, 3)) {
    findings.push({
      type: "gap",
      message: `${item.criterionId} is not evident. ${item.rationale}`
    });
  }

  for (const note of possibleScopeCreep) {
    findings.push({
      type: "scope_creep",
      message: note
    });
  }

  return findings.slice(0, 8);
}

function buildFollowUps(checklist: ReviewCriterionAssessment[]): string[] {
  return checklist
    .filter((item) => item.status !== "met" && item.status !== "not_applicable")
    .slice(0, 5)
    .map((item) => `Recheck ${item.criterionId}: ${item.missingEvidence[0] || item.rationale}`);
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
        localBacklogItemId: workItem.localBacklogItemId || "",
        requirementIds: workItem.requirementIds,
        criterion: criterion.text,
        status: classification.status,
        evidence: classification.evidence,
        missingEvidence: classification.missingEvidence,
        rationale: classification.rationale,
        confidence: classification.confidence
      };
    })
  );

  const requirementIds = unique(workItems.flatMap((workItem) => workItem.requirementIds)).sort();
  const possibleScopeCreep = buildScopeCreepNotes(changes, checklist);

  return {
    repoId: context.repoId,
    prId: context.prId,
    summary: buildSummary(checklist),
    linkedWorkItemIds: workItems
      .map((item) => item.id)
      .filter((id): id is number => typeof id === "number"),
    requirementIds,
    checklist,
    findings: buildFindings(checklist, possibleScopeCreep),
    possibleScopeCreep,
    followUps: buildFollowUps(checklist)
  };
}