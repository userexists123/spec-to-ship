"use client";

import { ReactNode, useMemo, useState } from "react";
import {
  PullRequestChangedFile,
  ReviewAssessmentRecord,
  ReviewCriterionStatus,
  ReviewRunRecord
} from "../../types/review";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7071/api";

interface ReviewResponse {
  ok: boolean;
  review?: ReviewRunRecord;
  error?: string;
}

function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red" | "purple";
}) {
  const toneClassName = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700"
  }[tone];

  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClassName}`}>{children}</span>;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

function statusTone(status: ReviewCriterionStatus): "green" | "amber" | "red" | "blue" {
  if (status === "met") {
    return "green";
  }

  if (status === "partial") {
    return "amber";
  }

  if (status === "not_evident") {
    return "red";
  }

  return "blue";
}

function statusLabel(status: ReviewCriterionStatus): string {
  if (status === "not_evident") {
    return "Not evident";
  }

  if (status === "not_applicable") {
    return "Not applicable";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function confidenceTone(confidence: string): "green" | "amber" | "red" {
  if (confidence === "High") {
    return "green";
  }

  if (confidence === "Medium") {
    return "amber";
  }

  return "red";
}

function SectionCard({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {typeof count === "number" ? <Badge>{count}</Badge> : null}
      </div>
      {children}
    </section>
  );
}

function PrMetadataCard({ review }: { review: ReviewRunRecord }) {
  return (
    <SectionCard title="Pull request metadata">
      <dl className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Repository</dt>
          <dd className="mt-1 text-slate-950">{review.repoName || review.repoId}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Pull request</dt>
          <dd className="mt-1 text-slate-950">
            #{review.prId} {review.prTitle}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Status</dt>
          <dd className="mt-1">
            <Badge>{review.prStatus || "Unknown"}</Badge>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Author</dt>
          <dd className="mt-1 text-slate-950">{review.prAuthor || "Unknown"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Source branch</dt>
          <dd className="mt-1 break-all text-slate-950">{review.sourceBranch || "Unknown"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Target branch</dt>
          <dd className="mt-1 break-all text-slate-950">{review.targetBranch || "Unknown"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Review run</dt>
          <dd className="mt-1 break-all text-slate-700">{review.id}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Created</dt>
          <dd className="mt-1 text-slate-950">{formatDateTime(review.createdAt)}</dd>
        </div>
      </dl>

      {review.prUrl ? (
        <a
          href={review.prUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Open PR in Azure DevOps
        </a>
      ) : null}
    </SectionCard>
  );
}

function ReviewSummaryCards({ review }: { review: ReviewRunRecord }) {
  const counts = useMemo(() => {
    return {
      met: review.assessments.filter((item) => item.status === "met").length,
      partial: review.assessments.filter((item) => item.status === "partial").length,
      notEvident: review.assessments.filter((item) => item.status === "not_evident").length,
      notApplicable: review.assessments.filter((item) => item.status === "not_applicable").length
    };
  }, [review.assessments]);

  return (
    <section className="grid gap-4 md:grid-cols-4">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
        <div className="text-3xl font-bold text-green-800">{counts.met}</div>
        <div className="mt-1 text-sm font-medium text-green-700">Met</div>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="text-3xl font-bold text-amber-800">{counts.partial}</div>
        <div className="mt-1 text-sm font-medium text-amber-700">Partial</div>
      </div>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="text-3xl font-bold text-red-800">{counts.notEvident}</div>
        <div className="mt-1 text-sm font-medium text-red-700">Not evident</div>
      </div>
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <div className="text-3xl font-bold text-blue-800">{counts.notApplicable}</div>
        <div className="mt-1 text-sm font-medium text-blue-700">Not applicable</div>
      </div>
    </section>
  );
}

function LinkedWorkItemsCard({ review }: { review: ReviewRunRecord }) {
  const localItems = Array.from(
    new Map(
      review.assessments.map((assessment) => [
        assessment.localBacklogItemId,
        {
          localBacklogItemId: assessment.localBacklogItemId,
          workItemId: assessment.workItemId,
          title: assessment.workItemTitle,
          requirementIds: assessment.requirementIds
        }
      ])
    ).values()
  ).filter((item) => item.localBacklogItemId || item.workItemId);

  return (
    <SectionCard title="Linked work items" count={review.linkedWorkItemIds.length}>
      {review.linkedWorkItemIds.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {review.linkedWorkItemIds.map((id) => (
            <Badge key={id} tone="blue">
              ADO {id}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No linked Azure DevOps work items were found on this pull request.
        </div>
      )}

      {localItems.length > 0 ? (
        <div className="grid gap-3">
          {localItems.map((item) => (
            <article key={`${item.workItemId}-${item.localBacklogItemId}`} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {item.workItemId ? <Badge tone="blue">ADO {item.workItemId}</Badge> : null}
                {item.localBacklogItemId ? <Badge>{item.localBacklogItemId}</Badge> : null}
                {item.requirementIds.map((requirementId) => (
                  <Badge key={requirementId} tone="purple">
                    {requirementId}
                  </Badge>
                ))}
              </div>
              <h3 className="mt-3 font-semibold text-slate-950">{item.title || "Mapped backlog item"}</h3>
            </article>
          ))}
        </div>
      ) : review.linkedWorkItemIds.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Linked work items exist, but none matched saved Spec-to-Ship mappings with acceptance criteria.
        </div>
      ) : null}
    </SectionCard>
  );
}

function ChangedFilesCard({ files }: { files: PullRequestChangedFile[] }) {
  return (
    <SectionCard title="Changed files" count={files.length}>
      {files.length > 0 ? (
        <div className="grid gap-3">
          {files.map((file) => (
            <article key={`${file.path}-${file.changeType}`} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{file.changeType}</Badge>
              </div>
              <h3 className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">{file.path}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{file.summary}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No changed files were returned by Azure DevOps.
        </div>
      )}
    </SectionCard>
  );
}

function AssessmentCard({ assessment }: { assessment: ReviewAssessmentRecord }) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{assessment.acceptanceCriterionId}</Badge>
        <Badge tone={statusTone(assessment.status)}>{statusLabel(assessment.status)}</Badge>
        <Badge tone={confidenceTone(assessment.confidence)}>{assessment.confidence} confidence</Badge>
        {assessment.localBacklogItemId ? <Badge>{assessment.localBacklogItemId}</Badge> : null}
        {assessment.workItemId ? <Badge tone="blue">ADO {assessment.workItemId}</Badge> : null}
      </div>

      <p className="mt-3 text-sm font-medium leading-6 text-slate-950">{assessment.acceptanceCriterionText}</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence found</h4>
          {assessment.evidence.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-slate-700">
              {assessment.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No evidence found.</p>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing evidence</h4>
          {assessment.missingEvidence.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-slate-700">
              {assessment.missingEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No missing evidence recorded.</p>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rationale</h4>
          <p className="mt-2 text-sm leading-6 text-slate-700">{assessment.rationale}</p>
        </div>
      </div>
    </article>
  );
}

function AssessmentsTable({ assessments }: { assessments: ReviewAssessmentRecord[] }) {
  return (
    <SectionCard title="Criterion-by-criterion review" count={assessments.length}>
      {assessments.length > 0 ? (
        <div className="grid gap-4">
          {assessments.map((assessment) => (
            <AssessmentCard key={assessment.id} assessment={assessment} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No acceptance criteria were available for this review. Confirm the PR has linked work items and that those work
          items were created from a Spec-to-Ship draft with saved mappings.
        </div>
      )}
    </SectionCard>
  );
}

function CommentPreviewPanel({
  review,
  onPreview,
  onPost,
  isPreviewing,
  isPosting
}: {
  review: ReviewRunRecord;
  onPreview: () => void;
  onPost: () => void;
  isPreviewing: boolean;
  isPosting: boolean;
}) {
  return (
    <SectionCard title="PR comment preview">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={isPreviewing}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 hover:bg-slate-50"
        >
          {isPreviewing ? "Generating preview..." : "Preview comment"}
        </button>

        <button
          type="button"
          onClick={onPost}
          disabled={isPosting || review.commentPosted}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPosting ? "Posting..." : review.commentPosted ? "Comment already posted" : "Post comment"}
        </button>

        {review.commentPosted ? <Badge tone="green">Posted</Badge> : <Badge tone="amber">Not posted</Badge>}
      </div>

      {review.commentPreview ? (
        <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-slate-50">
          {review.commentPreview}
        </pre>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No comment has been posted yet. Generate a preview before posting to Azure DevOps.
        </div>
      )}

      {review.commentUrl ? (
        <a
          href={review.commentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
        >
          Open posted PR thread
        </a>
      ) : null}
    </SectionCard>
  );
}

export default function ReviewPage() {
  const [review, setReview] = useState<ReviewRunRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function startReview() {
    setIsCreating(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/reviews`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Could not create PR review."));
      }

      const data = (await response.json()) as ReviewResponse;

      if (!data.ok || !data.review) {
        throw new Error(data.error || "Could not create PR review.");
      }

      setReview(data.review);
      setNotice("PR review generated from the selected repository and pull request.");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not create PR review.");
    } finally {
      setIsCreating(false);
    }
  }

  async function previewComment() {
    if (!review) {
      return;
    }

    setIsPreviewing(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(review.id)}/comment-preview`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Could not preview PR comment."));
      }

      const data = (await response.json()) as ReviewResponse;

      if (!data.ok || !data.review) {
        throw new Error(data.error || "Could not preview PR comment.");
      }

      setReview(data.review);
      setNotice("Comment preview generated. Nothing has been posted yet.");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not preview PR comment.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function postComment() {
    if (!review) {
      return;
    }

    setIsPosting(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(review.id)}/comment-post`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Could not post PR comment."));
      }

      const data = (await response.json()) as ReviewResponse;

      if (!data.ok || !data.review) {
        throw new Error(data.error || "Could not post PR comment.");
      }

      setReview(data.review);
      setNotice("Comment posted to Azure DevOps and duplicate posting is now blocked for this review run.");
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Could not post PR comment.");
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Saturday 7</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            PR review and evidence mapping
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Review the currently selected Azure DevOps pull request, map changed files to acceptance criteria, preview a
            PR summary comment, and post it only after explicit PM action.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startReview}
            disabled={isCreating}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isCreating ? "Reviewing selected PR..." : "Review selected PR"}
          </button>
          <span className="text-sm text-slate-500">
            Uses saved workspace repository and pull request selection.
          </span>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}
        {notice ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>
        ) : null}
      </section>

      {!review ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">No review run loaded</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Select a repository and pull request from the dashboard first. Then return here and click Review selected PR.
            The review workflow does not require manual raw repository or PR IDs.
          </p>
        </section>
      ) : (
        <section className="space-y-6">
          <ReviewSummaryCards review={review} />
          <PrMetadataCard review={review} />
          <LinkedWorkItemsCard review={review} />
          <ChangedFilesCard files={review.changedFiles} />
          <AssessmentsTable assessments={review.assessments} />
          <CommentPreviewPanel
            review={review}
            onPreview={previewComment}
            onPost={postComment}
            isPreviewing={isPreviewing}
            isPosting={isPosting}
          />
        </section>
      )}
    </div>
  );
}