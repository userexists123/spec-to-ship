"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AcceptanceCriterion,
  BacklogBundle,
  BacklogDraftRecord,
  BacklogExecutionResult,
  BacklogPreview,
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
  validation?: {
    ok: boolean;
    errors: string[];
  };
}

interface PreviewResponse extends DraftResponse {
  preview?: BacklogPreview;
}

interface ExecuteResponse extends DraftResponse {
  outcome?: string;
  result?: BacklogExecutionResult;
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

function defaultTrust(rationale: string): TrustMetadata {
  return {
    evidence_label: "inferred",
    confidence: "Medium",
    rationale,
    warnings: []
  };
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

function getDraftIdFromUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("draftId") || "";
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; validation?: { errors?: string[] } };
    const validationErrors = body.validation?.errors?.length ? ` ${body.validation.errors.join(" ")}` : "";
    return `${body.error || fallback}${validationErrors}`;
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

function cloneBacklog(backlog: BacklogBundle): BacklogBundle {
  return JSON.parse(JSON.stringify(backlog)) as BacklogBundle;
}

function nextIssueId(stories: Story[]): string {
  const maxNumber = stories.reduce((maxValue, story) => {
    const match = story.id.match(/ISS-(\d+)/i);
    return match ? Math.max(maxValue, Number(match[1])) : maxValue;
  }, 0);

  return `ISS-${String(maxNumber + 1).padStart(3, "0")}`;
}

function nextCriterionId(story: Story): string {
  const maxNumber = story.acceptance_criteria.reduce((maxValue, criterion) => {
    const match = criterion.id.match(/AC-(\d+)/i);
    return match ? Math.max(maxValue, Number(match[1])) : maxValue;
  }, 0);

  return `AC-${String(maxNumber + 1).padStart(3, "0")}`;
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

  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClassName}`}>{children}</span>;
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

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</label>;
}

function TextInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
    />
  );
}

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-500"
    />
  );
}

function SectionCard({ title, count, children }: { title: string; count: number; children: ReactNode }) {
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

function AmbiguityPanel({ warnings }: { warnings: DraftAmbiguityWarning[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Trust layer</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Ambiguity panel</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Warnings explain where the generated backlog may need PM review before Azure DevOps creation.
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
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{requirement.id}</Badge>
        <Badge>{requirement.priority}</Badge>
        <EvidenceBadge trust={requirement.trust} />
        <ConfidenceBadge trust={requirement.trust} />
      </div>
      <h3 className="mt-3 font-semibold text-slate-950">{requirement.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{requirement.summary}</p>
    </article>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{risk.id}</Badge>
        <Badge>{risk.severity}</Badge>
        <EvidenceBadge trust={risk.trust} />
        <ConfidenceBadge trust={risk.trust} />
      </div>
      <h3 className="mt-3 font-semibold text-slate-950">{risk.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{risk.mitigation_note}</p>
    </article>
  );
}

function PreviewPanel({ preview, execution }: { preview: BacklogPreview | null; execution: BacklogExecutionResult | null }) {
  if (!preview && !execution) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Azure DevOps</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Preview and execution result</h2>
        </div>
        {preview ? <Badge tone="blue">{preview.itemCount} preview items</Badge> : null}
      </div>

      {preview ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-2xl font-bold text-slate-950">{preview.epicCount}</div>
              <div className="text-slate-500">Epics</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-2xl font-bold text-slate-950">{preview.issueCount}</div>
              <div className="text-slate-500">Issues</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="truncate text-sm font-semibold text-slate-950">{preview.runId}</div>
              <div className="text-slate-500">Run ID</div>
            </div>
          </div>

          {preview.items.map((item) => (
            <article key={item.localId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{item.workItemType}</Badge>
                <Badge>{item.localId}</Badge>
                {item.parentLocalId ? <Badge tone="blue">Parent {item.parentLocalId}</Badge> : null}
              </div>
              <h3 className="mt-3 font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      ) : null}

      {execution ? (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">Created {execution.createdCount} Azure DevOps items</h3>
          <div className="mt-3 space-y-2">
            {execution.createdItems.map((item) => (
              <a
                key={`${item.localId}-${item.adoWorkItemId}`}
                href={item.adoUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-green-200 bg-white p-3 text-sm text-green-900 hover:bg-green-50"
              >
                {item.workItemType} {item.adoWorkItemId}: {item.localId}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EditableDraft({
  backlog,
  onChange
}: {
  backlog: BacklogBundle;
  onChange: (backlog: BacklogBundle) => void;
}) {
  function updateEpic(epicId: string, patch: Partial<Epic>) {
    const next = cloneBacklog(backlog);
    next.epics = next.epics.map((epic) => (epic.id === epicId ? { ...epic, ...patch } : epic));
    onChange(next);
  }

  function updateStory(storyId: string, patch: Partial<Story>) {
    const next = cloneBacklog(backlog);
    next.stories = next.stories.map((story) => (story.id === storyId ? { ...story, ...patch } : story));
    onChange(next);
  }

  function updateCriterion(storyId: string, criterionId: string, text: string) {
    const next = cloneBacklog(backlog);
    next.stories = next.stories.map((story) => {
      if (story.id !== storyId) {
        return story;
      }

      return {
        ...story,
        acceptance_criteria: story.acceptance_criteria.map((criterion) =>
          criterion.id === criterionId ? { ...criterion, text } : criterion
        )
      };
    });
    onChange(next);
  }

  function addCriterion(storyId: string) {
    const next = cloneBacklog(backlog);
    next.stories = next.stories.map((story) => {
      if (story.id !== storyId) {
        return story;
      }

      const criterion: AcceptanceCriterion = {
        id: nextCriterionId(story),
        story_id: story.id,
        text: "New acceptance criterion",
        trust: defaultTrust("Added manually by the PM in the editable draft workflow.")
      };

      return {
        ...story,
        acceptance_criteria: [...story.acceptance_criteria, criterion]
      };
    });
    onChange(next);
  }

  function deleteCriterion(storyId: string, criterionId: string) {
    const next = cloneBacklog(backlog);
    next.stories = next.stories.map((story) =>
      story.id === storyId
        ? { ...story, acceptance_criteria: story.acceptance_criteria.filter((criterion) => criterion.id !== criterionId) }
        : story
    );
    onChange(next);
  }

  function addIssue(epicId: string) {
    const firstRequirementId =
      backlog.epics.find((epic) => epic.id === epicId)?.requirement_ids[0] || backlog.requirements[0]?.id || "REQ-001";
    const issueId = nextIssueId(backlog.stories);
    const next = cloneBacklog(backlog);

    next.stories = [
      ...next.stories,
      {
        id: issueId,
        epic_id: epicId,
        title: "New issue",
        summary: "Describe the implementation work needed for this issue.",
        requirement_ids: [firstRequirementId],
        acceptance_criteria: [
          {
            id: "AC-001",
            story_id: issueId,
            text: "The issue has clear acceptance criteria before creation in Azure DevOps.",
            trust: defaultTrust("Added manually by the PM in the editable draft workflow.")
          }
        ],
        source_refs: [],
        trust: defaultTrust("Added manually by the PM in the editable draft workflow.")
      }
    ];

    onChange(next);
  }

  function deleteIssue(storyId: string) {
    const next = cloneBacklog(backlog);
    next.stories = next.stories.filter((story) => story.id !== storyId);
    onChange(next);
  }

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

      <SectionCard title="Editable Epics and Issues" count={backlog.epics.length}>
        <div className="grid gap-5">
          {backlog.epics.map((epic) => {
            const childStories = backlog.stories.filter((story) => story.epic_id === epic.id);

            return (
              <article key={epic.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{epic.id}</Badge>
                  <Badge>{childStories.length} issues</Badge>
                  <EvidenceBadge trust={epic.trust} />
                  <ConfidenceBadge trust={epic.trust} />
                </div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <FieldLabel>Epic title</FieldLabel>
                    <TextInput value={epic.title} onChange={(value) => updateEpic(epic.id, { title: value })} />
                  </div>
                  <div>
                    <FieldLabel>Epic summary</FieldLabel>
                    <TextArea value={epic.summary} onChange={(value) => updateEpic(epic.id, { summary: value })} />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => addIssue(epic.id)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Add issue
                  </button>
                </div>

                <div className="mt-4 grid gap-4">
                  {childStories.map((story) => (
                    <div key={story.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{story.id}</Badge>
                          <EvidenceBadge trust={story.trust} />
                          <ConfidenceBadge trust={story.trust} />
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteIssue(story.id)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Delete issue
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <div>
                          <FieldLabel>Issue title</FieldLabel>
                          <TextInput value={story.title} onChange={(value) => updateStory(story.id, { title: value })} />
                        </div>
                        <div>
                          <FieldLabel>Issue summary</FieldLabel>
                          <TextArea value={story.summary} onChange={(value) => updateStory(story.id, { summary: value })} />
                        </div>
                        <div>
                          <FieldLabel>Move issue to epic</FieldLabel>
                          <select
                            value={story.epic_id}
                            onChange={(event) => updateStory(story.id, { epic_id: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                          >
                            {backlog.epics.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.id} - {option.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-slate-800">Acceptance criteria</h4>
                          <button
                            type="button"
                            onClick={() => addCriterion(story.id)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                          >
                            Add criterion
                          </button>
                        </div>
                        <div className="mt-2 grid gap-2">
                          {story.acceptance_criteria.map((criterion) => (
                            <div key={criterion.id} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <Badge>{criterion.id}</Badge>
                                <button
                                  type="button"
                                  onClick={() => deleteCriterion(story.id, criterion.id)}
                                  className="text-xs font-medium text-red-700 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                              <TextArea
                                value={criterion.text}
                                rows={2}
                                onChange={(value) => updateCriterion(story.id, criterion.id, value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
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
  const [editableBacklog, setEditableBacklog] = useState<BacklogBundle | null>(null);
  const [approvalToken, setApprovalToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadedDraftId, setLoadedDraftId] = useState("");

  const canAnalyze = useMemo(() => prdText.trim().length > 0 && !isSubmitting, [prdText, isSubmitting]);
  const draft = state.draft;
  const trustStats = editableBacklog ? countTrustItems(editableBacklog) : null;
  const hasMappings = (draft?.mappings.length || 0) > 0;

  function applyDraft(nextDraft: BacklogDraftRecord, prd: PrdDocumentRecord | null = state.prd) {
    setState({ prd, draft: nextDraft });
    setEditableBacklog(cloneBacklog(nextDraft.draft));
    setLoadedDraftId(nextDraft.id);

    const url = new URL(window.location.href);
    url.searchParams.set("draftId", nextDraft.id);
    window.history.replaceState(null, "", url.toString());
  }

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

        setState({ prd: null, draft: data.draft });
        setEditableBacklog(cloneBacklog(data.draft.draft));
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
    setNotice("");

    try {
      const createResponse = await fetch(`${API_BASE_URL}/prds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), prdText })
      });

      if (!createResponse.ok) {
        throw new Error(await readError(createResponse, "Could not save PRD."));
      }

      const createData = (await createResponse.json()) as CreatePrdResponse;

      if (!createData.ok || !createData.prd) {
        throw new Error(createData.error || "Could not save PRD.");
      }

      const analyzeResponse = await fetch(`${API_BASE_URL}/prds/${encodeURIComponent(createData.prd.id)}/analyze`, {
        method: "POST"
      });

      if (!analyzeResponse.ok) {
        throw new Error(await readError(analyzeResponse, "Could not analyze PRD."));
      }

      const analyzeData = (await analyzeResponse.json()) as AnalyzePrdResponse;

      if (!analyzeData.ok || !analyzeData.draft) {
        throw new Error(analyzeData.error || "Could not analyze PRD.");
      }

      applyDraft(analyzeData.draft, analyzeData.prd || createData.prd);
      setNotice("Draft generated and loaded for editing.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not analyze PRD.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveEditedDraft() {
    if (!draft || !editableBacklog) {
      return;
    }

    setIsSavingDraft(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_BASE_URL}/backlog/drafts/${encodeURIComponent(draft.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backlog: editableBacklog })
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Could not save edited draft."));
      }

      const data = (await response.json()) as DraftResponse;

      if (!data.ok || !data.draft) {
        throw new Error(data.error || "Could not save edited draft.");
      }

      applyDraft(data.draft);
      setNotice("Edited draft saved. Previous preview was cleared because the draft changed.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save edited draft.");
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function previewItems() {
    if (!draft) {
      return;
    }

    setIsPreviewing(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_BASE_URL}/backlog/drafts/${encodeURIComponent(draft.id)}/preview`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Could not preview Azure DevOps items."));
      }

      const data = (await response.json()) as PreviewResponse;

      if (!data.ok || !data.draft) {
        throw new Error(data.error || "Could not preview Azure DevOps items.");
      }

      applyDraft(data.draft);
      setNotice("Azure DevOps item preview generated from the saved draft.");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not preview Azure DevOps items.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function executeItems() {
    if (!draft) {
      return;
    }

    setIsExecuting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_BASE_URL}/backlog/drafts/${encodeURIComponent(draft.id)}/execute`, {
        method: "POST",
        headers: { "x-approval-token": approvalToken }
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Could not create Azure DevOps items."));
      }

      const data = (await response.json()) as ExecuteResponse;

      if (!data.ok || !data.draft) {
        throw new Error(data.error || "Could not create Azure DevOps items.");
      }

      applyDraft(data.draft);
      setNotice("Azure DevOps items created and mappings saved.");
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Could not create Azure DevOps items.");
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Saturday 5</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Editable backlog draft and Azure DevOps creation
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Paste or upload a PRD, edit the generated Epic/Issue draft, preview the exact Azure DevOps items, then
            create real work items from the browser.
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
          {notice ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>
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
                  <dt className="font-medium text-slate-500">Last previewed</dt>
                  <dd className="mt-1 text-slate-950">{formatDateTime(draft.lastPreviewedAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Last executed</dt>
                  <dd className="mt-1 text-slate-950">{formatDateTime(draft.lastExecutedAt)}</dd>
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
            <h2 className="text-lg font-semibold text-slate-950">Draft actions</h2>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                disabled={!draft || !editableBacklog || isSavingDraft || hasMappings}
                onClick={saveEditedDraft}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 hover:bg-slate-50"
              >
                {isSavingDraft ? "Saving..." : "Save edited draft"}
              </button>
              <button
                type="button"
                disabled={!draft || isPreviewing || hasMappings}
                onClick={previewItems}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 hover:bg-slate-50"
              >
                {isPreviewing ? "Previewing..." : "Preview Azure DevOps items"}
              </button>
              <input
                value={approvalToken}
                onChange={(event) => setApprovalToken(event.target.value)}
                type="password"
                placeholder="Execute approval token"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <button
                type="button"
                disabled={!draft || !approvalToken || isExecuting || hasMappings}
                onClick={executeItems}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isExecuting ? "Creating..." : "Create items"}
              </button>
              {hasMappings ? (
                <p className="text-xs leading-5 text-amber-700">
                  This draft already has saved Azure DevOps mappings, so execution is locked to prevent duplicate work
                  item creation.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Generated shape</h2>
            {editableBacklog ? (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-2xl font-bold text-slate-950">{editableBacklog.requirements.length}</div>
                  <div className="text-slate-500">Requirements</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-2xl font-bold text-slate-950">{editableBacklog.epics.length}</div>
                  <div className="text-slate-500">Epics</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-2xl font-bold text-slate-950">{editableBacklog.stories.length}</div>
                  <div className="text-slate-500">Issues</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-2xl font-bold text-slate-950">{editableBacklog.risks.length}</div>
                  <div className="text-slate-500">Risks</div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">The analyzed draft will render here.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Trust metadata</h2>
            {editableBacklog && trustStats ? (
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

      {draft && editableBacklog ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Editable backlog draft</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">{editableBacklog.title}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Edit Epics, Issues, and acceptance criteria, save the draft, preview the exact ADO payload, then create
              items.
            </p>
          </div>

          <PreviewPanel preview={draft.preview} execution={draft.execution} />
          <EditableDraft backlog={editableBacklog} onChange={setEditableBacklog} />
        </section>
      ) : null}
    </div>
  );
}