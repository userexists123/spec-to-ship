"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { RecentPrSummary, RepositorySummary, WorkspaceSettings } from "../../types/workspace";

interface WorkspaceResponse {
  ok: boolean;
  workspace: WorkspaceSettings | null;
  recentPrs?: RecentPrSummary[];
}

interface ReposResponse {
  ok: boolean;
  repos: RepositorySummary[];
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

export default function WorkspacePage() {
  const [workspace, setWorkspace] = useState<WorkspaceSettings>(emptyWorkspace);
  const [repos, setRepos] = useState<RepositorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadWorkspace() {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch<WorkspaceResponse>("/workspace");
      setWorkspace(response.workspace || emptyWorkspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workspace.");
    } finally {
      setLoading(false);
    }
  }

  async function saveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch<WorkspaceResponse>("/workspace", {
        method: "PUT",
        body: JSON.stringify(workspace)
      });

      setWorkspace(response.workspace || workspace);
      setMessage("Workspace saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save workspace.");
    } finally {
      setSaving(false);
    }
  }

  async function loadRepos() {
    setLoadingRepos(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch<ReposResponse>("/repos");
      setRepos(response.repos);
      setMessage("Live Azure DevOps repos loaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load repositories.");
    } finally {
      setLoadingRepos(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-600">Loading workspace...</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Workspace settings
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Azure DevOps context
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Save the org and project once. The pilot uses this context to load repos, pull requests,
          PRDs, backlog drafts, and traceability data without typing raw IDs.
        </p>
      </section>

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

      <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <form
          onSubmit={(event) => void saveWorkspace(event)}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-slate-950">Settings</h2>
          <div className="mt-6 grid gap-5">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Azure DevOps org URL</span>
              <input
                value={workspace.orgUrl}
                onChange={(event) =>
                  setWorkspace((current) => ({ ...current, orgUrl: event.target.value }))
                }
                placeholder="https://dev.azure.com/your-org"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Project</span>
              <input
                value={workspace.project}
                onChange={(event) =>
                  setWorkspace((current) => ({ ...current, project: event.target.value }))
                }
                placeholder="Azure DevOps project name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Default repo</span>
              <input
                value={workspace.defaultRepo}
                onChange={(event) =>
                  setWorkspace((current) => ({ ...current, defaultRepo: event.target.value }))
                }
                placeholder="Optional default repo name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Epic work item type</span>
                <input
                  value={workspace.epicWorkItemType}
                  onChange={(event) =>
                    setWorkspace((current) => ({
                      ...current,
                      epicWorkItemType: event.target.value
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Issue work item type</span>
                <input
                  value={workspace.issueWorkItemType}
                  onChange={(event) =>
                    setWorkspace((current) => ({
                      ...current,
                      issueWorkItemType: event.target.value
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Default branch</span>
              <input
                value={workspace.defaultBranch}
                onChange={(event) =>
                  setWorkspace((current) => ({ ...current, defaultBranch: event.target.value }))
                }
                placeholder="main"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Saved repo / PR context</h3>
              <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">Selected repo</dt>
                  <dd className="text-slate-900">{workspace.selectedRepoName || "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Selected repo ID</dt>
                  <dd className="break-all text-slate-900">{workspace.selectedRepoId || "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Last PR</dt>
                  <dd className="text-slate-900">
                    {workspace.lastPrId ? `#${workspace.lastPrId}` : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Last PR title</dt>
                  <dd className="text-slate-900">{workspace.lastPrTitle || "-"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                Repo and PR selection is managed from the dashboard to avoid manual raw ID entry.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save workspace"}
            </button>
            <a
              href="/"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Go to dashboard
            </a>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Current workspace</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Org URL</dt>
                <dd className="break-all text-slate-900">{workspace.orgUrl || "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Project</dt>
                <dd className="text-slate-900">{workspace.project || "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Default repo</dt>
                <dd className="text-slate-900">{workspace.defaultRepo || "-"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Live repo test</h2>
            <p className="mt-2 text-sm text-slate-600">
              This calls Azure DevOps through Railway using the saved workspace settings.
            </p>
            <button
              type="button"
              onClick={() => void loadRepos()}
              disabled={loadingRepos}
              className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingRepos ? "Loading..." : "Load repos"}
            </button>

            <div className="mt-5 space-y-3">
              {repos.length === 0 ? (
                <p className="text-sm text-slate-500">No repos loaded yet.</p>
              ) : (
                repos.map((repo) => (
                  <div key={repo.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="text-sm font-semibold text-slate-950">{repo.name}</div>
                    <div className="mt-1 break-all text-xs text-slate-500">{repo.id}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Default branch: {repo.defaultBranch || "-"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}