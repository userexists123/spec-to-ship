"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PullRequestSummary, RecentPrSummary, RecentPrdSummary, RepositorySummary, WorkspaceSettings } from "../types/workspace";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7071/api";

interface WorkspaceResponse {
  ok: boolean;
  workspace: WorkspaceSettings | null;
  recentPrs?: RecentPrSummary[];
  recentPrds?: RecentPrdSummary[];
  error?: string;
}

interface ReposResponse {
  ok: boolean;
  repos: RepositorySummary[];
  error?: string;
}

interface PullRequestsResponse {
  ok: boolean;
  repo: {
    id: string;
    name: string;
  };
  pullRequests: PullRequestSummary[];
  error?: string;
}

interface SelectPrResponse {
  ok: boolean;
  workspace: WorkspaceSettings;
  recentPrs: RecentPrSummary[];
  recentPrds?: RecentPrdSummary[];
  error?: string;
}

function formatDateTime(value: string | undefined): string {
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

export default function DashboardPage() {
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [recentPrs, setRecentPrs] = useState<RecentPrSummary[]>([]);
  const [recentPrds, setRecentPrds] = useState<RecentPrdSummary[]>([]);
  const [repos, setRepos] = useState<RepositorySummary[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [selectedPrId, setSelectedPrId] = useState("");
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingPrs, setIsLoadingPrs] = useState(false);
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [error, setError] = useState("");

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === selectedRepoId) || null,
    [repos, selectedRepoId]
  );

  const selectedPr = useMemo(
    () => pullRequests.find((pr) => String(pr.prId) === selectedPrId) || null,
    [pullRequests, selectedPrId]
  );

  useEffect(() => {
    async function loadWorkspace() {
      setIsLoadingWorkspace(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/workspace`);

        if (!response.ok) {
          throw new Error(await readError(response, "Could not load workspace."));
        }

        const data = (await response.json()) as WorkspaceResponse;

        if (!data.ok) {
          throw new Error(data.error || "Could not load workspace.");
        }

        setWorkspace(data.workspace);
        setRecentPrs(data.recentPrs || []);
        setRecentPrds(data.recentPrds || []);
        setSelectedRepoId(data.workspace?.selectedRepoId || "");
        setSelectedPrId(data.workspace?.lastPrId ? String(data.workspace.lastPrId) : "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load workspace.");
      } finally {
        setIsLoadingWorkspace(false);
      }
    }

    loadWorkspace();
  }, []);

  useEffect(() => {
    async function loadRepos() {
      if (!workspace) {
        return;
      }

      setIsLoadingRepos(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/repos`);

        if (!response.ok) {
          throw new Error(await readError(response, "Could not load repositories."));
        }

        const data = (await response.json()) as ReposResponse;

        if (!data.ok) {
          throw new Error(data.error || "Could not load repositories.");
        }

        setRepos(data.repos);

        if (!selectedRepoId && workspace.selectedRepoId) {
          setSelectedRepoId(workspace.selectedRepoId);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load repositories.");
      } finally {
        setIsLoadingRepos(false);
      }
    }

    loadRepos();
  }, [workspace, selectedRepoId]);

  useEffect(() => {
    async function loadPullRequests() {
      if (!selectedRepoId) {
        setPullRequests([]);
        return;
      }

      setIsLoadingPrs(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/repos/${encodeURIComponent(selectedRepoId)}/pull-requests`
        );

        if (!response.ok) {
          throw new Error(await readError(response, "Could not load pull requests."));
        }

        const data = (await response.json()) as PullRequestsResponse;

        if (!data.ok) {
          throw new Error(data.error || "Could not load pull requests.");
        }

        setPullRequests(data.pullRequests);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load pull requests.");
      } finally {
        setIsLoadingPrs(false);
      }
    }

    loadPullRequests();
  }, [selectedRepoId]);

  async function saveSelection() {
    if (!workspace || !selectedRepo || !selectedPr) {
      return;
    }

    setIsSavingSelection(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/workspace/selection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          repoId: selectedRepo.id,
          repoName: selectedRepo.name,
          prId: selectedPr.prId,
          prTitle: selectedPr.title
        })
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Could not save selection."));
      }

      const data = (await response.json()) as SelectPrResponse;

      if (!data.ok) {
        throw new Error(data.error || "Could not save selection.");
      }

      setWorkspace(data.workspace);
      setRecentPrs(data.recentPrs || []);
      setRecentPrds(data.recentPrds || []);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save selection.");
    } finally {
      setIsSavingSelection(false);
    }
  }

  if (isLoadingWorkspace) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading workspace...</p>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">Set up your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Save your Azure DevOps organization and project before selecting repositories, pull requests, or PRDs.
        </p>
        <Link
          href="/workspace"
          className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Open workspace settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pilot dashboard</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Spec-to-Ship PM Workspace
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Select the saved Azure DevOps repo and PR context, then move into PRD analysis and backlog drafting.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/workspace"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Workspace settings
            </Link>
            <Link href="/prd" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              Analyze PRD
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Workspace summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-slate-500">Organization</dt>
              <dd className="mt-1 break-all text-slate-950">{workspace.orgUrl}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Project</dt>
              <dd className="mt-1 text-slate-950">{workspace.project}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Work item types</dt>
              <dd className="mt-1 text-slate-950">
                {workspace.epicWorkItemType} / {workspace.issueWorkItemType}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Default branch</dt>
              <dd className="mt-1 text-slate-950">{workspace.defaultBranch}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Last used PR</h2>
          {workspace.lastPrId ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Repository</dt>
                <dd className="mt-1 text-slate-950">{workspace.selectedRepoName || workspace.selectedRepoId}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Pull request</dt>
                <dd className="mt-1 text-slate-950">
                  #{workspace.lastPrId} {workspace.lastPrTitle}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              No PR selected yet. Select a repository and pull request below.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Last used PRD</h2>
          {recentPrds.length ? (
            <div className="mt-4 space-y-3">
              {recentPrds.slice(0, 1).map((prd) => (
                <div key={prd.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="font-medium text-slate-950">{prd.title || prd.prdId}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(prd.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              No PRD analyzed yet. Use the PRD page to generate the first saved draft.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Repo and PR selection</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose from live Azure DevOps repositories and pull requests. The selected context is saved.
            </p>
          </div>
          <button
            type="button"
            onClick={saveSelection}
            disabled={!selectedRepo || !selectedPr || isSavingSelection}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSavingSelection ? "Saving..." : "Save selection"}
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Repository</span>
            <select
              value={selectedRepoId}
              onChange={(event) => {
                setSelectedRepoId(event.target.value);
                setSelectedPrId("");
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="">{isLoadingRepos ? "Loading repositories..." : "Select repository"}</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Pull request</span>
            <select
              value={selectedPrId}
              onChange={(event) => setSelectedPrId(event.target.value)}
              disabled={!selectedRepoId || isLoadingPrs}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
            >
              <option value="">{isLoadingPrs ? "Loading pull requests..." : "Select pull request"}</option>
              {pullRequests.map((pr) => (
                <option key={pr.prId} value={pr.prId}>
                  #{pr.prId} {pr.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedPr ? (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-950">
              #{selectedPr.prId} {selectedPr.title}
            </div>
            <div className="mt-2 grid gap-2 lg:grid-cols-3">
              <div>Status: {selectedPr.status}</div>
              <div>Author: {selectedPr.author}</div>
              <div>
                {selectedPr.sourceBranch} → {selectedPr.targetBranch}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Recent pull requests</h2>
          {recentPrs.length ? (
            <div className="mt-4 space-y-3">
              {recentPrs.map((pr) => (
                <div key={pr.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="font-medium text-slate-950">
                    #{pr.prId} {pr.prTitle}
                  </div>
                  <div className="mt-1 text-slate-500">{pr.repoName || pr.repoId}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDateTime(pr.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">No recent PR selections yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Recent PRDs</h2>
          {recentPrds.length ? (
            <div className="mt-4 space-y-3">
              {recentPrds.map((prd) => (
                <div key={prd.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="font-medium text-slate-950">{prd.title || prd.prdId}</div>
                  <div className="mt-1 break-all text-slate-500">PRD ID: {prd.prdId}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDateTime(prd.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">No PRDs analyzed yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}