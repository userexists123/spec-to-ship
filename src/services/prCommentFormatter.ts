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
    default:
      return status;
  }
}

function formatChecklistItem(item: ReviewCriterionAssessment): string {
  const parts = [
    `- ${item.criterionId} (${toStatusLabel(item.status)}): ${item.criterion}`
  ];

  if (item.evidence.length > 0) {
    parts.push(`  Evidence: ${item.evidence.join("; ")}`);
  }

  parts.push(`  Note: ${item.note}`);

  return parts.join("\n");
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
    toHeading("Summary"),
    review.summary,
    "",
    toHeading("Acceptance criteria")
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
    toHeading("Follow-up actions"),
    ...formatFollowUps(review.followUps),
    "",
    `run_id: ${runId}`
  );

  return lines.join("\n").trim();
}