import { PullRequestReviewDraft } from "../schemas/review";
import { formatPrReviewComment } from "./prCommentFormatter";
import { PrReviewAdoClient } from "./prReviewAdoClient";
import { generateReviewDraft } from "./reviewGenerator";
import {
  createReviewRun,
  getReviewRun,
  getReviewWorkItemsForLinkedIds,
  getSelectedPrContext,
  ReviewRunRecord,
  saveCommentPreview,
  savePostedComment
} from "./prReviewStore";

function buildEmptyReview(params: {
  repoId: string;
  prId: number;
  linkedWorkItemIds: number[];
  reason: string;
}): PullRequestReviewDraft {
  return {
    repoId: params.repoId,
    prId: params.prId,
    summary: params.reason,
    linkedWorkItemIds: params.linkedWorkItemIds,
    requirementIds: [],
    checklist: [],
    findings: [
      {
        type: "gap",
        message: params.reason
      }
    ],
    possibleScopeCreep: [],
    followUps: [params.reason]
  };
}

export async function createReviewFromSelectedPr(): Promise<ReviewRunRecord> {
  const selected = await getSelectedPrContext();

  if (!selected) {
    throw new Error("No selected repository and pull request found. Select a repo and PR from the dashboard first.");
  }

  const client = new PrReviewAdoClient();
  const context = await client.getPullRequestContext({
    repoId: selected.repoId,
    repoName: selected.repoName,
    prId: selected.prId
  });

  const changes = await client.getPullRequestChanges({
    repoId: selected.repoId,
    prId: selected.prId
  });

  const linkedWorkItemIds = context.linkedWorkItemIds ?? [];
  const normalizedContext = {
    ...context,
    repoName: context.repoName ?? selected.repoName,
    prTitle: context.prTitle ?? context.title ?? selected.prTitle,
    prStatus: context.prStatus ?? context.status ?? "",
    prAuthor: context.prAuthor ?? context.createdBy?.displayName ?? context.createdBy?.uniqueName ?? "",
    sourceBranch: context.sourceBranch ?? context.sourceRefName ?? "",
    targetBranch: context.targetBranch ?? context.targetRefName ?? "",
    prUrl: context.prUrl ?? "",
    linkedWorkItemIds
  };

  const workItems = await getReviewWorkItemsForLinkedIds(linkedWorkItemIds);
  const review =
    workItems.length > 0
      ? generateReviewDraft({
          context: normalizedContext,
          changes,
          workItems
        })
      : buildEmptyReview({
          repoId: normalizedContext.repoId,
          prId: normalizedContext.prId,
          linkedWorkItemIds,
          reason:
            linkedWorkItemIds.length === 0
              ? "No linked Azure DevOps work items were found for this pull request."
              : "Linked work items were found, but none matched saved Spec-to-Ship work item mappings with acceptance criteria."
        });

  return createReviewRun({
    context: normalizedContext,
    changedFiles: changes.files,
    review
  });
}

export async function getExistingReview(reviewRunId: string): Promise<ReviewRunRecord> {
  const run = await getReviewRun(reviewRunId);

  if (!run) {
    throw new Error("Review run was not found.");
  }

  return run;
}

export async function previewReviewComment(reviewRunId: string): Promise<ReviewRunRecord> {
  const run = await getExistingReview(reviewRunId);

  const review: PullRequestReviewDraft = {
    repoId: run.repoId,
    prId: run.prId,
    summary: run.summary,
    linkedWorkItemIds: run.linkedWorkItemIds,
    requirementIds: Array.from(new Set(run.assessments.flatMap((assessment) => assessment.requirementIds))),
    checklist: run.assessments.map((assessment) => ({
      criterionId: assessment.acceptanceCriterionId,
      workItemId: assessment.workItemId,
      workItemTitle: assessment.workItemTitle,
      localBacklogItemId: assessment.localBacklogItemId,
      requirementIds: assessment.requirementIds,
      criterion: assessment.acceptanceCriterionText,
      status: assessment.status as PullRequestReviewDraft["checklist"][number]["status"],
      evidence: assessment.evidence,
      missingEvidence: assessment.missingEvidence,
      rationale: assessment.rationale,
      confidence: assessment.confidence as PullRequestReviewDraft["checklist"][number]["confidence"]
    })),
    findings: [],
    possibleScopeCreep: [],
    followUps: run.assessments
      .filter((assessment) => assessment.status !== "met" && assessment.status !== "not_applicable")
      .slice(0, 5)
      .map((assessment) => `Recheck ${assessment.acceptanceCriterionId}: ${assessment.rationale}`)
  };

  const comment = formatPrReviewComment(review, run.id);

  return saveCommentPreview({
    reviewRunId,
    comment
  });
}

export async function postReviewComment(reviewRunId: string): Promise<ReviewRunRecord> {
  const run = await getExistingReview(reviewRunId);

  if (run.commentPosted) {
    throw new Error("A comment was already posted for this review run.");
  }

  const commentBody =
    run.commentPreview ||
    formatPrReviewComment(
      {
        repoId: run.repoId,
        prId: run.prId,
        summary: run.summary,
        linkedWorkItemIds: run.linkedWorkItemIds,
        requirementIds: Array.from(new Set(run.assessments.flatMap((assessment) => assessment.requirementIds))),
        checklist: run.assessments.map((assessment) => ({
          criterionId: assessment.acceptanceCriterionId,
          workItemId: assessment.workItemId,
          workItemTitle: assessment.workItemTitle,
          localBacklogItemId: assessment.localBacklogItemId,
          requirementIds: assessment.requirementIds,
          criterion: assessment.acceptanceCriterionText,
          status: assessment.status as PullRequestReviewDraft["checklist"][number]["status"],
          evidence: assessment.evidence,
          missingEvidence: assessment.missingEvidence,
          rationale: assessment.rationale,
          confidence: assessment.confidence as PullRequestReviewDraft["checklist"][number]["confidence"]
        })),
        findings: [],
        possibleScopeCreep: [],
        followUps: run.assessments
          .filter((assessment) => assessment.status !== "met" && assessment.status !== "not_applicable")
          .slice(0, 5)
          .map((assessment) => `Recheck ${assessment.acceptanceCriterionId}: ${assessment.rationale}`)
      },
      run.id
    );

  const client = new PrReviewAdoClient();
  const posted = await client.postPullRequestComment({
    repoId: run.repoId,
    prId: run.prId,
    comment: commentBody
  });

  return savePostedComment({
    reviewRunId,
    repoId: run.repoId,
    prId: run.prId,
    commentBody,
    threadId: posted.threadId,
    threadUrl: posted.threadUrl
  });
}