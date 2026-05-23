"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { TraceabilityChain, TraceabilitySnapshotRecord } from "../../types/traceability";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7071/api";

interface TraceabilityResponse {
  ok: boolean;
  snapshot?: TraceabilitySnapshotRecord;
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

function statusTone(status: TraceabilityChain["status"]): "green" | "amber" | "red" | "blue" {
  if (status === "covered") {
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

function statusLabel(status: TraceabilityChain["status"]): string {
  return status.replace(/_/g, " ");
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

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function NotesPanel({ title, value }: { title: string; value: string }) {
  return (
    <SectionCard title={title}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void copyText(value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Copy
        </button>
      </div>
      <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-slate-50">
        {value}
      </pre>
    </SectionCard>
  );
}

function SnapshotSummary({ snapshot }: { snapshot: TraceabilitySnapshotRecord }) {
  return (
    <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-slate-950">{snapshot.sourceCounts.requirements}</div>
        <div className="mt-1 text-sm text-slate-500">Requirements</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-slate-950">{snapshot.sourceCounts.epics}</div>
        <div className="mt-1 text-sm text-slate-500">Epics</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-slate-950">{snapshot.sourceCounts.issues}</div>
        <div className="mt-1 text-sm text-slate-500">Issues</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-slate-950">{snapshot.sourceCounts.acceptanceCriteria}</div>
        <div className="mt-1 text-sm text-slate-500">Criteria</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-slate-950">{snapshot.sourceCounts.mappedWorkItems}</div>
        <div className="mt-1 text-sm text-slate-500">ADO mappings</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-slate-950">{snapshot.sourceCounts.reviewAssessments}</div>
        <div className="mt-1 text-sm text-slate-500">Assessments</div>
      </div>
    </section>
  );
}

function TraceabilityTable({ chains }: { chains: TraceabilityChain[] }) {
  return (
    <SectionCard title="Traceability table" count={chains.length}>
      {chains.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Requirement</th>
                <th className="px-3 py-2">Epics</th>
                <th className="px-3 py-2">Issues</th>
                <th className="px-3 py-2">ADO</th>
                <th className="px-3 py-2">Criteria</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {chains.map((chain) => (
                <tr key={chain.requirementId} className="bg-slate-50">
                  <td className="rounded-l-xl px-3 py-3 align-top">
                    <div className="font-semibold text-slate-950">{chain.requirementId}</div>
                    <div className="mt-1 max-w-sm text-slate-600">{chain.requirementTitle}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-slate-700">{chain.epicLocalIds.join(", ") || "-"}</td>
                  <td className="px-3 py-3 align-top text-slate-700">{chain.issueLocalIds.join(", ") || "-"}</td>
                  <td className="px-3 py-3 align-top text-slate-700">{chain.adoWorkItemIds.join(", ") || "-"}</td>
                  <td className="px-3 py-3 align-top text-slate-700">{chain.acceptanceCriteria.length}</td>
                  <td className="rounded-r-xl px-3 py-3 align-top">
                    <Badge tone={statusTone(chain.status)}>{statusLabel(chain.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No traceability chains are available yet. Create a backlog draft and Azure DevOps mappings first.
        </div>
      )}
    </SectionCard>
  );
}

function ChainDetail({ chains }: { chains: TraceabilityChain[] }) {
  return (
    <SectionCard title="Expandable chain detail" count={chains.length}>
      {chains.length > 0 ? (
        <div className="space-y-3">
          {chains.map((chain) => (
            <details key={chain.requirementId} className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-semibold text-slate-950">
                {chain.requirementId} - {chain.requirementTitle}
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{chain.requirementSummary}</p>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <h3 className="text-sm font-semibold text-slate-800">Acceptance criteria</h3>
                  {chain.acceptanceCriteria.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-slate-700">
                      {chain.acceptanceCriteria.map((criterion) => (
                        <li key={`${criterion.issueLocalId}-${criterion.id}`}>
                          {criterion.id} ({criterion.issueLocalId}): {criterion.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No acceptance criteria found.</p>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <h3 className="text-sm font-semibold text-slate-800">Review evidence</h3>
                  {chain.reviewAssessments.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {chain.reviewAssessments.map((assessment) => (
                        <div key={`${assessment.acceptanceCriterionId}-${assessment.localBacklogItemId}`} className="rounded-lg bg-white p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={assessment.status === "met" ? "green" : assessment.status === "partial" ? "amber" : "red"}>
                              {assessment.status.replace(/_/g, " ")}
                            </Badge>
                            <Badge>{assessment.confidence}</Badge>
                          </div>
                          <p className="mt-2 leading-6 text-slate-700">{assessment.rationale}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No PR review assessment found.</p>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600">No chain detail available.</p>
      )}
    </SectionCard>
  );
}

export default function TraceabilityPage() {
  const [snapshot, setSnapshot] = useState<TraceabilitySnapshotRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const exportJson = useMemo(() => (snapshot ? JSON.stringify(snapshot, null, 2) : ""), [snapshot]);

  async function loadTraceability(refresh: boolean) {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_BASE_URL}/traceability${refresh ? "?refresh=true" : ""}`);

      if (!response.ok) {
        throw new Error(await readError(response, "Could not load traceability."));
      }

      const data = (await response.json()) as TraceabilityResponse;

      if (!data.ok || !data.snapshot) {
        throw new Error(data.error || "Could not load traceability.");
      }

      setSnapshot(data.snapshot);
      setNotice(refresh ? "Traceability snapshot generated from the latest real pilot data." : "Traceability snapshot loaded.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load traceability.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadTraceability(false);
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Saturday 8</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Traceability and pilot candidate</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Generate a release-ready traceability snapshot from saved PRD drafts, Azure DevOps mappings, and PR review evidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadTraceability(true)}
              disabled={isRefreshing}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isRefreshing ? "Generating..." : "Generate traceability"}
            </button>
            <button
              type="button"
              disabled={!snapshot}
              onClick={() => void copyText(exportJson)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 hover:bg-slate-50"
            >
              Copy JSON
            </button>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div> : null}
      </section>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">Loading traceability...</div>
      ) : null}

      {!isLoading && !snapshot ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">No traceability snapshot available</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Complete the browser workflow first: save workspace, analyze a PRD, create Azure DevOps items, select a PR, review it, preview/post a comment, then generate traceability.
          </p>
        </section>
      ) : null}

      {snapshot ? (
        <section className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{snapshot.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{snapshot.summary}</p>
              </div>
              <Badge tone="blue">{formatDateTime(snapshot.createdAt)}</Badge>
            </div>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="font-medium text-slate-500">Latest draft</dt>
                <dd className="mt-1 text-slate-950">{snapshot.latestDraft ? `${snapshot.latestDraft.title} (${snapshot.latestDraft.status})` : "None"}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="font-medium text-slate-500">Latest review</dt>
                <dd className="mt-1 text-slate-950">{snapshot.latestReview ? `PR ${snapshot.latestReview.prId}: ${snapshot.latestReview.prTitle}` : "None"}</dd>
              </div>
            </dl>
          </section>

          <SnapshotSummary snapshot={snapshot} />
          <div className="grid gap-6 lg:grid-cols-2">
            <NotesPanel title="Customer-facing release notes" value={snapshot.customerReleaseNotes} />
            <NotesPanel title="Internal-facing release notes" value={snapshot.internalReleaseNotes} />
          </div>
          <TraceabilityTable chains={snapshot.chains} />
          <ChainDetail chains={snapshot.chains} />
        </section>
      ) : null}
    </div>
  );
}