"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AcceptanceCriterion,
  BacklogBundle,
  BacklogDraftRecord,
  DraftAmbiguityWarning,
  Epic,
  PrdDocumentRecord,
  Requirement,
  Risk,
  Story,
  TrustMetadata
} from "../../types/backlog";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7071/api";

interface CreatePrdResponse {
  ok: boolean;
  prd?: PrdDocumentRecord;
  error?: string;
}

interface AnalyzePrdResponse {
  ok: boolean;
  prd?: PrdDocumentRecord;
  draft?: BacklogDraftRecord;
  error?: string;
}

interface DraftResponse {
  ok: boolean;
  draft?: BacklogDraftRecord;
  error?: string;
}

interface DraftViewState {
  prd: PrdDocumentRecord | null;
  draft: BacklogDraftRecord | null;
}

const examplePrd = `# Smart Support Workspace

## Problem
Support teams need a better way to manage customer issues.

## Requirements
- The system should make issue handling faster and easier.
- Users should be able to see important customer problems.
- The workspace should support follow ups as needed.
- Improve visibility for managers.

## Dependencies
- Depends on CRM data and notification services.`;

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getDraftIdFromUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("draftId") || "";
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

function countTrustItems(backlog: BacklogBundle): {
  explicit: number;
  inferred: number;
  high: number;
  medium: number;
  low: number;
  warningItems: number;
} {
  const trustItems: TrustMetadata[] = [
    ...backlog.requirements.map((item) => item.trust),
    ...backlog.epics.map((item) => item.trust),
    ...backlog.stories.map((item) => item.trust),
    ...backlog.stories.flatMap((story) => story.acceptance_criteria.map((criterion) => criterion.trust)),
    ...backlog.risks.map((item) => item.trust)
  ];

  return {
    explicit: trustItems.filter((item) => item.evidence_label === "explicit").length,
    inferred: trustItems.filter((item) => item.evidence_label === "inferred").length,
    high: trustItems.filter((item) => item.confidence === "High").length,
    medium: trustItems.filter((item) => item.confidence === "Medium").length,
    low: trustItems.filter((item) => item.confidence === "Low").length,
    warningItems: trustItems.filter((item) => item.warnings.length > 0).length
  };
}

function trustCardClassName(trust: TrustMetadata): string {
  if (trust.confidence === "Low" || trust.warnings.length > 0) {
    return "rounded-xl border border-amber-300 bg-amber-50/40 p-4";
  }

  return "rounded-xl border border-slate-200 p-4";
}

function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "purple" | "green" | "amber" | "red";
}) {
  const toneClassName = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700"
  }[tone];

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClassName}`}>
      {children}
    </span>
  );
}

function EvidenceBadge({ trust }: { trust: TrustMetadata }) {
  return (
    <Badge tone={trust.evidence_label === "explicit" ? "green" : "purple"}>
      {trust.evidence_label === "explicit" ? "Explicit" : "Inferred"}
    </Badge>
  );
}

function ConfidenceBadge({ trust }: { trust: TrustMetadata }) {
  const tone = trust.confidence === "High" ? "green" : trust.confidence === "Medium" ? "amber" : "red";

  return <Badge tone={tone}>{trust.confidence} confidence</Badge>;
}

function TrustDetails({ trust }: { trust: TrustMetadata }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
      <div>
        <span className="font-semibold text-slate-700">Basis: </span>
        {trust.rationale}
      </div>

      {trust.warnings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
          {trust.warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SectionCard({
  title,
  count,
  children
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <Badge>{count}</Badge>
      </div>
      {children}
    </section>
  );
}

function SourceRefs({ refs }: { refs: { section: string; excerpt: string }[] }) {
  if (!refs.length) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {refs.map((ref, index) => (
        <div key={`${ref.section}-${index}`} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">{ref.section}</div>
          <div className="mt-1">{ref.excerpt}</div>
        </div>
      ))}
    </div>
  );
}

function AmbiguityPanel({ warnings }: { warnings: DraftAmbiguityWarning[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Trust layer</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Ambiguity panel</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            These warnings explain where the generated backlog may need PM review before Azure DevOps creation.
          </p>
        </div>
        <Badge tone={warnings.length > 0 ? "amber" : "green"}>{warnings.length} warnings</Badge>
      </div>

      {warnings.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {warnings.map((warning) => (
            <article key={warning.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={warning.severity === "high" ? "red" : warning.severity === "medium" ? "amber" : "blue"}>
                  {warning.severity} severity
                </Badge>
                <Badge>{warning.category.replace(/_/g, " ")}</Badge>
              </div>
              <h3 className="mt-3 font-semibold text-slate-950">{warning.message}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{warning.evidence}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          No ambiguity warnings were detected for this draft.
        </div>
      )}
    </section>
  );
}

function RequirementCard({ requirement }: { requirement: Requirement }) {
  return (
    <article className={trustCardClassName(requirement.trust)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{requirement.id}</Badge>
        <Badge>{requirement.priority}</Badge>
        <EvidenceBadge trust={requirement.trust} />
        <ConfidenceBadge trust={requirement.trust} />
      </div>
      <h3 className="mt-3 font-semibold text-slate-950">{requirement.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{requirement.summary}</p>
      <TrustDetails trust={requirement.trust} />
      <SourceRefs refs={requirement.source_refs} />
    </article>
  );
}

function EpicCard({ epic, stories }: { epic: Epic; stories: Story[] }) {
  const childStories = stories.filter((story) => story.epic_id === epic.id);

  return (
    <article className={trustCardClassName(epic.trust)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{epic.id}</Badge>
        <Badge>{childStories.length} issues</Badge>
        <EvidenceBadge trust={epic.trust} />
        <ConfidenceBadge trust={epic.trust} />
      </div>
      <h3 className="mt-3 font-semibold text-slate-950">{epic.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{epic.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {epic.requirement_ids.map((id) => (
          <Badge key={id}>{id}</Badge>
        ))}
      </div>
      <TrustDetails trust={epic.trust} />
      <SourceRefs refs={epic.source_refs} />
    </article>
  );
}

function AcceptanceCriterionCard({ criterion }: { criterion: AcceptanceCriterion }) {
  return (
    <li className={trustCardClassName(criterion.trust)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{criterion.id}</Badge>
        <EvidenceBadge trust={criterion.trust} />
        <ConfidenceBadge trust={criterion.trust} />
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{criterion.text}</p>
      <TrustDetails trust={criterion.trust} />
    </li>
  );
}

function StoryCard({ story }: { story: Story }) {
  return (
    <article className={trustCardClassName(story.trust)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{story.id}</Badge>
        <Badge>Epic {story.epic_id}</Badge>
        <EvidenceBadge trust={story.trust} />
        <ConfidenceBadge trust={story.trust} />
      </div>
      <h3 className="mt-3 font-semibold text-slate-950">{story.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{story.summary}</p>
      <TrustDetails trust={story.trust} />

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-800">Acceptance criteria</h4>
        <ul className="mt-2 space-y-2">
          {story.acceptance_criteria.map((criterion) => (
            <AcceptanceCriterionCard key={criterion.id} criterion={criterion} />
          ))}
        </ul>
      </div>

      <SourceRefs refs={story.source_refs} />
    </article>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  return (
    <article className={trustCardClassName(risk.trust)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{risk.id}</Badge>
        <Badge>{risk.severity}</Badge>
        <EvidenceBadge trust={risk.trust} />
        <ConfidenceBadge trust={risk.trust} />
      </div>
      <h3 className="mt-3 font-semibold text-slate-950">{risk.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{risk.mitigation_note}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {risk.related_requirement_ids.map((id) => (
          <Badge key={id}>{id}</Badge>
        ))}
      </div>
      <TrustDetails trust={risk.trust} />
    </article>
  );
}

function DraftRenderer({ backlog }: { backlog: BacklogBundle }) {
  return (
    <div className="space-y-6">
      <AmbiguityPanel warnings={backlog.ambiguity_warnings} />

      <SectionCard title="Requirements" count={backlog.requirements.length}>
        <div className="grid gap-4">
          {backlog.requirements.map((requirement) => (
            <RequirementCard key={requirement.id} requirement={requirement} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Epics" count={backlog.epics.length}>
        <div className="grid gap-4">
          {backlog.epics.map((epic) => (
            <EpicCard key={epic.id} epic={epic} stories={backlog.stories} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Issues" count={backlog.stories.length}>
        <div className="grid gap-4">
          {backlog.stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Risks" count={backlog.risks.length}>
        <div className="grid gap-4">
          {backlog.risks.map((risk) => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default function PrdPage() {
  const [title, setTitle] = useState("");
  const [prdText, setPrdText] = useState("");
  const [state, setState] = useState<DraftViewState>({ prd: null, draft: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [error, setError] = useState("");
  const [loadedDraftId, setLoadedDraftId] = useState("");

  const canAnalyze = useMemo(() => prdText.trim().length > 0 && !isSubmitting, [prdText, isSubmitting]);
  const draft = state.draft;
  const trustStats = draft ? countTrustItems(draft.draft) : null;

  useEffect(() => {
    const draftId = getDraftIdFromUrl();

    if (!draftId) {
      return;
    }

    setLoadedDraftId(draftId);
    setIsLoadingDraft(true);
    setError("");

    fetch(`${API_BASE_URL}/backlog/drafts/${encodeURIComponent(draftId)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readError(response, "Could not load backlog draft."));
        }

        return (await response.json()) as DraftResponse;
      })
      .then((data) => {
        if (!data.ok || !data.draft) {
          throw new Error(data.error || "Could not load backlog draft.");
        }

        setState({
          prd: null,
          draft: data.draft
        });
        setTitle(data.draft.title);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load backlog draft.");
      })
      .finally(() => {
        setIsLoadingDraft(false);
      });
  }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.includes("text") && !file.name.endsWith(".md")) {
      setError("Upload a plain text or Markdown PRD file.");
      return;
    }

    const text = await file.text();
    setPrdText(text);

    if (!title.trim()) {
      setTitle(file.name.replace(/\.(txt|md)$/i, ""));
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const createResponse = await fetch(`${API_BASE_URL}/prds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title.trim(),
          prdText
        })
      });

      if (!createResponse.ok) {
        throw new Error(await readError(createResponse, "Could not save PRD."));
      }

      const createData = (await createResponse.json()) as CreatePrdResponse;

      if (!createData.ok || !createData.prd) {
        throw new Error(createData.error || "Could not save PRD.");
      }

      const analyzeResponse = await fetch(
        `${API_BASE_URL}/prds/${encodeURIComponent(createData.prd.id)}/analyze`,
        {
          method: "POST"
        }
      );

      if (!analyzeResponse.ok) {
        throw new Error(await readError(analyzeResponse, "Could not analyze PRD."));
      }

      const analyzeData = (await analyzeResponse.json()) as AnalyzePrdResponse;

      if (!analyzeData.ok || !analyzeData.draft) {
        throw new Error(analyzeData.error || "Could not analyze PRD.");
      }

      setState({
        prd: analyzeData.prd || createData.prd,
        draft: analyzeData.draft
      });

      setLoadedDraftId(analyzeData.draft.id);

      const url = new URL(window.location.href);
      url.searchParams.set("draftId", analyzeData.draft.id);
      window.history.replaceState(null, "", url.toString());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not analyze PRD.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Saturday 4</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            PRD trust layer and backlog confidence metadata
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Paste or upload a PRD, analyze it with the deterministic parser, and inspect ambiguity warnings,
            explicit/inferred labels, confidence, and rationale before trusting the generated backlog.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleAnalyze} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">PRD input</h2>
            <button
              type="button"
              onClick={() => {
                setTitle("Smart Support Workspace");
                setPrdText(examplePrd);
                setError("");
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Use vague sample
            </button>
          </div>

          <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="title">
            PRD title
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Example: Billing Workflow Improvements"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />

          <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="prd-file">
            Upload text or Markdown PRD
          </label>
          <input
            id="prd-file"
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={handleFileChange}
            className="mt-2 w-full rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600"
          />

          <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="prd-text">
            Paste PRD text
          </label>
          <textarea
            id="prd-text"
            value={prdText}
            onChange={(event) => setPrdText(event.target.value)}
            placeholder="Paste the complete PRD here..."
            rows={18}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-500"
          />

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canAnalyze}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Analyzing..." : "Analyze PRD"}
            </button>
            <span className="text-sm text-slate-500">{prdText.trim().length.toLocaleString()} characters</span>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Draft status</h2>

            {isLoadingDraft ? (
              <p className="mt-3 text-sm text-slate-600">Loading saved draft...</p>
            ) : draft ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-slate-500">Draft title</dt>
                  <dd className="mt-1 text-slate-950">{draft.title}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Status</dt>
                  <dd className="mt-1">
                    <Badge>{draft.status}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Created</dt>
                  <dd className="mt-1 text-slate-950">{formatDateTime(draft.createdAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Draft ID</dt>
                  <dd className="mt-1 break-all text-slate-700">{draft.id}</dd>
                </div>
                {loadedDraftId ? (
                  <div>
                    <dt className="font-medium text-slate-500">Reload URL</dt>
                    <dd className="mt-1 break-all text-slate-700">/prd?draftId={loadedDraftId}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                No draft loaded yet. Paste or upload a PRD and click Analyze.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Generated shape</h2>
            {draft ? (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-2xl font-bold text-slate-950">{draft.draft.requirements.length}</div>
                  <div className="text-slate-500">Requirements</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-2xl font-bold text-slate-950">{draft.draft.epics.length}</div>
                  <div className="text-slate-500">Epics</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-2xl font-bold text-slate-950">{draft.draft.stories.length}</div>
                  <div className="text-slate-500">Issues</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-2xl font-bold text-slate-950">{draft.draft.risks.length}</div>
                  <div className="text-slate-500">Risks</div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The analyzed draft will render requirements, epics, issues, acceptance criteria, and risks here.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Trust metadata</h2>
            {draft && trustStats ? (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-green-50 p-3">
                  <div className="text-2xl font-bold text-green-800">{trustStats.explicit}</div>
                  <div className="text-green-700">Explicit</div>
                </div>
                <div className="rounded-xl bg-purple-50 p-3">
                  <div className="text-2xl font-bold text-purple-800">{trustStats.inferred}</div>
                  <div className="text-purple-700">Inferred</div>
                </div>
                <div className="rounded-xl bg-green-50 p-3">
                  <div className="text-2xl font-bold text-green-800">{trustStats.high}</div>
                  <div className="text-green-700">High confidence</div>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <div className="text-2xl font-bold text-red-800">{trustStats.low}</div>
                  <div className="text-red-700">Low confidence</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <div className="text-2xl font-bold text-amber-800">{trustStats.medium}</div>
                  <div className="text-amber-700">Medium confidence</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <div className="text-2xl font-bold text-amber-800">{trustStats.warningItems}</div>
                  <div className="text-amber-700">Item warnings</div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                After analysis, this card shows explicit/inferred counts and confidence distribution.
              </p>
            )}
          </div>
        </aside>
      </section>

      {draft ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Generated backlog draft</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">{draft.draft.title}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Saved as draft <span className="font-medium text-slate-950">{draft.id}</span> with status{" "}
              <span className="font-medium text-slate-950">{draft.status}</span>.
            </p>
          </div>

          <DraftRenderer backlog={draft.draft} />
        </section>
      ) : null}
    </div>
  );
}