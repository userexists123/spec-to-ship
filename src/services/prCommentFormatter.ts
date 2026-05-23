import type {
  PullRequestReviewDraft,
  ReviewCriterionAssessment,
  ReviewFinding
} from "../schemas/review";

function toHeading(title: string): string {
  return `### ${title}`;
}

function toStatusLabel(status: ReviewCriterionAssessment["status"]): string {
  switch (status) {
    case "met":
      return "Met";
    case "partial":
      return "Partial";
    case "not_evident":
      return "Not evident";
    case "not_applicable":
      return "Not applicable";
    default:
      return status;
  }
}

function formatChecklistItem(item: ReviewCriterionAssessment): string {
  const lines = [
    `- ${item.criterionId} (${toStatusLabel(item.status)}, ${item.confidence} confidence): ${item.criterion}`
  ];

  if (item.localBacklogItemId) {
    lines.push(`  Local item: ${item.localBacklogItemId}`);
  }

  if (item.workItemId) {
    lines.push(`  Azure DevOps work item: ${item.workItemId}`);
  }

  if (item.evidence.length > 0) {
    lines.push(`  Evidence: ${item.evidence.join("; ")}`);
  }

  if (item.missingEvidence.length > 0) {
    lines.push(`  Missing evidence: ${item.missingEvidence.join("; ")}`);
  }

  lines.push(`  Rationale: ${item.rationale}`);

  return lines.join("\n");
}

function formatFindings(findings: ReviewFinding[]): string[] {
  if (findings.length === 0) {
    return ["- No additional findings."];
  }

  return findings.map((finding) => `- ${finding.message}`);
}

function formatFollowUps(followUps: string[]): string[] {
  if (followUps.length === 0) {
    return ["- No follow-up actions."];
  }

  return followUps.map((item) => `- ${item}`);
}

export function formatPrReviewComment(review: PullRequestReviewDraft, runId: string): string {
  const lines: string[] = [
    toHeading("Spec-to-Ship PR readiness summary"),
    review.summary,
    "",
    toHeading("Acceptance criteria evidence")
  ];

  if (review.checklist.length === 0) {
    lines.push("- No acceptance criteria were available for review.");
  } else {
    for (const item of review.checklist) {
      lines.push(formatChecklistItem(item));
    }
  }

  lines.push(
    "",
    toHeading("Findings"),
    ...formatFindings(review.findings),
    "",
    toHeading("Recommended next steps"),
    ...formatFollowUps(review.followUps),
    "",
    `run_id: ${runId}`
  );

  return lines.join("\n").trim();
}