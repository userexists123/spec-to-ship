"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  PullRequestSummary,
  RecentPrSummary,
  RepositorySummary,
  WorkspaceSettings
} from "../types/workspace";

interface WorkspaceResponse {
  ok: boolean;
  workspace: WorkspaceSettings | null;
  recentPrs?: RecentPrSummary[];
}

interface ReposResponse {
  ok: boolean;
  repos: RepositorySummary[];
}

interface PullRequestsResponse {
  ok: boolean;
  repoId: string;
  pullRequests: PullRequestSummary[];
  recentPrs: RecentPrSummary[];
}

const emptyWorkspace: WorkspaceSettings = {
  orgUrl: "",
  project: "",
  defaultRepo: "",
  selectedRepoId: "",
  selectedRepoName: "",
  lastPrId: null,
  lastPrTitle: "",
  epicWorkItemType: "Epic",
  issueWorkItemType: "Issue",
  defaultBranch: "main"
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function HomePage() {
  const [workspace, setWorkspace] = useState<WorkspaceSettings>(emptyWorkspace);
  const [repos, setRepos] = useState<RepositorySummary[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>([]);
  const [recentPrs, setRecentPrs] = useState<RecentPrSummary[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [selectedPrId, setSelectedPrId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingPrs, setLoadingPrs] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasWorkspace = Boolean(workspace.orgUrl && workspace.project);

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === selectedRepoId),
    [repos, selectedRepoId]
  );

  const selectedPr = useMemo(
    () => pullRequests.find((pullRequest) => String(pullRequest.prId) === selectedPrId),
    [pullRequests, selectedPrId]
  );

  async function loadWorkspace() {
    setLoadingWorkspace(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch<WorkspaceResponse>("/workspace");
      const currentWorkspace = response.workspace || emptyWorkspace;

      setWorkspace(currentWorkspace);
      setRecentPrs(response.recentPrs || []);
      setSelectedRepoId(currentWorkspace.selectedRepoId || "");
      setSelectedPrId(currentWorkspace.lastPrId ? String(currentWorkspace.lastPrId) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workspace.");
    } finally {
      setLoadingWorkspace(false);
    }
  }

  async function loadRepos() {
    setLoadingRepos(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch<ReposResponse>("/repos");
      setRepos(response.repos);

      if (!selectedRepoId && workspace.selectedRepoId) {
        setSelectedRepoId(workspace.selectedRepoId);
      }

      if (!selectedRepoId && !workspace.selectedRepoId && response.repos.length > 0) {
        const defaultRepo =
          response.repos.find((repo) => repo.name === workspace.defaultRepo) || response.repos[0];

        setSelectedRepoId(defaultRepo.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load repositories.");
    } finally {
      setLoadingRepos(false);
    }
  }

  async function loadPullRequests(repoId: string) {
    if (!repoId) {
      setPullRequests([]);
      return;
    }

    setLoadingPrs(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch<PullRequestsResponse>(
        `/repos/${encodeURIComponent(repoId)}/pull-requests?status=${encodeURIComponent(
          statusFilter
        )}&top=25`
      );

      setPullRequests(response.pullRequests);
      setRecentPrs(response.recentPrs || []);

      if (workspace.lastPrId) {
        const matchingPr = response.pullRequests.find(
          (pullRequest) => pullRequest.prId === workspace.lastPrId
        );

        if (matchingPr) {
          setSelectedPrId(String(matchingPr.prId));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pull requests.");
    } finally {
      setLoadingPrs(false);
    }
  }

  async function saveSelection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const repo = selectedRepo;
    const pullRequest = selectedPr;

    if (!repo) {
      setError("Select a repo before saving.");
      return;
    }

    setSavingSelection(true);
    setError("");
    setMessage("");

    try {
      const updatedWorkspace: WorkspaceSettings = {
        ...workspace,
        selectedRepoId: repo.id,
        selectedRepoName: repo.name,
        defaultRepo: workspace.defaultRepo || repo.name,
        lastPrId: pullRequest?.prId ?? null,
        lastPrTitle: pullRequest?.title ?? ""
      };

      const response = await apiFetch<WorkspaceResponse>("/workspace", {
        method: "PUT",
        body: JSON.stringify(updatedWorkspace)
      });

      const savedWorkspace = response.workspace || updatedWorkspace;
      setWorkspace(savedWorkspace);
      setRecentPrs(response.recentPrs || []);
      setSelectedRepoId(savedWorkspace.selectedRepoId || "");
      setSelectedPrId(savedWorkspace.lastPrId ? String(savedWorkspace.lastPrId) : "");
      setMessage("Repo and PR selection saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save selection.");
    } finally {
      setSavingSelection(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (hasWorkspace) {
      void loadRepos();
    }
  }, [hasWorkspace]);

  useEffect(() => {
    if (selectedRepoId) {
      void loadPullRequests(selectedRepoId);
    }
  }, [selectedRepoId, statusFilter]);

  if (loadingWorkspace) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-600">Loading workspace...</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Saturday 2 pilot dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Saved repo and PR context
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Choose a repository and pull request from live Azure DevOps data. The selected context is
              saved so later PRD, backlog, review, and traceability workflows do not need manual raw IDs.
            </p>
          </div>
          <a
            href="/workspace"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit workspace
          </a>
        </div>
      </section>

      {!hasWorkspace ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-950">Workspace setup required</h2>
          <p className="mt-2 text-sm text-amber-900">
            Save your Azure DevOps org URL and project on the workspace page before selecting repos
            and pull requests.
          </p>
          <a
            href="/workspace"
            className="mt-4 inline-block rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Go to workspace
          </a>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      {message ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </section>
      ) : null}

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            {workspace.project || "No project saved"}
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-slate-500">Org URL</dt>
              <dd className="break-all text-slate-900">{workspace.orgUrl || "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Work item mapping</dt>
              <dd className="text-slate-900">
                {workspace.epicWorkItemType} / {workspace.issueWorkItemType}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Default branch</dt>
              <dd className="text-slate-900">{workspace.defaultBranch || "-"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last used PR
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            {workspace.lastPrTitle || "No PR selected yet"}
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-slate-500">Repo</dt>
              <dd className="text-slate-900">{workspace.selectedRepoName || "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">PR ID</dt>
              <dd className="text-slate-900">{workspace.lastPrId ?? "-"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last used PRD
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">Not available yet</h2>
          <p className="mt-4 text-sm text-slate-600">
            Saturday 3 adds PRD upload, analysis, and saved backlog draft history.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Quick actions</h2>
        <p className="mt-1 text-sm text-slate-600">
          These actions become active as each Saturday workflow is implemented.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <a
            href="/workspace"
            className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Workspace settings
          </a>
          <button
            disabled
            className="rounded-xl border border-slate-200 p-4 text-left text-sm font-semibold text-slate-400"
          >
            Analyze PRD - Saturday 3
          </button>
          <button
            disabled
            className="rounded-xl border border-slate-200 p-4 text-left text-sm font-semibold text-slate-400"
          >
            Review PR - Saturday 7
          </button>
          <button
            disabled
            className="rounded-xl border border-slate-200 p-4 text-left text-sm font-semibold text-slate-400"
          >
            Traceability - Saturday 8
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Repo and PR selector</h2>
            <p className="mt-1 text-sm text-slate-600">
              Select live Azure DevOps context and save it for later workflows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRepos()}
            disabled={!hasWorkspace || loadingRepos}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingRepos ? "Loading repos..." : "Refresh repos"}
          </button>
        </div>

        <form onSubmit={(event) => void saveSelection(event)} className="mt-6 space-y-5">
          <div className="grid gap-5 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Repository</span>
              <select
                value={selectedRepoId}
                onChange={(event) => {
                  setSelectedRepoId(event.target.value);
                  setSelectedPrId("");
                }}
                disabled={!hasWorkspace || loadingRepos}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Select a repo</option>
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">PR status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                disabled={!selectedRepoId || loadingPrs}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
                <option value="all">All recent</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Pull request</span>
              <select
                value={selectedPrId}
                onChange={(event) => setSelectedPrId(event.target.value)}
                disabled={!selectedRepoId || loadingPrs}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Select a PR</option>
                {pullRequests.map((pullRequest) => (
                  <option key={pullRequest.prId} value={pullRequest.prId}>
                    #{pullRequest.prId} - {pullRequest.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadPullRequests(selectedRepoId)}
              disabled={!selectedRepoId || loadingPrs}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPrs ? "Loading PRs..." : "Refresh PRs"}
            </button>
            <button
              type="submit"
              disabled={!selectedRepoId || savingSelection}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSelection ? "Saving..." : "Save repo and PR context"}
            </button>
          </div>
        </form>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">PR</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Branches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pullRequests.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500" colSpan={4}>
                    {selectedRepoId
                      ? "No pull requests loaded for this repo/status."
                      : "Select a repo to load pull requests."}
                  </td>
                </tr>
              ) : (
                pullRequests.map((pullRequest) => (
                  <tr key={pullRequest.prId}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">#{pullRequest.prId}</div>
                      <div className="text-slate-600">{pullRequest.title}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{pullRequest.status}</td>
                    <td className="px-4 py-3 text-slate-700">{pullRequest.author}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {pullRequest.sourceBranch || "-"} → {pullRequest.targetBranch || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Recent PR selections</h2>
        {recentPrs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No recent PR selections yet.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {recentPrs.map((recentPr) => (
              <div key={recentPr.id} className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-950">
                  #{recentPr.prId} - {recentPr.prTitle || "Untitled pull request"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {recentPr.repoName || recentPr.repoId} · {formatDate(recentPr.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}