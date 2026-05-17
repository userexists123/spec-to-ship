"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { RepositorySummary, WorkspaceSettings } from "../../types/workspace";

const emptyWorkspace: WorkspaceSettings = {
  orgUrl: "",
  project: "",
  defaultRepo: "",
  epicWorkItemType: "Epic",
  issueWorkItemType: "Issue",
  defaultBranch: "main"
};

export default function WorkspacePage() {
  const [workspace, setWorkspace] = useState<WorkspaceSettings>(emptyWorkspace);
  const [savedWorkspace, setSavedWorkspace] = useState<WorkspaceSettings | null>(null);
  const [repos, setRepos] = useState<RepositorySummary[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === selectedRepoId),
    [repos, selectedRepoId]
  );

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const response = await apiFetch<{ ok: boolean; workspace: WorkspaceSettings | null }>(
          "/workspace"
        );

        if (response.workspace) {
          setWorkspace(response.workspace);
          setSavedWorkspace(response.workspace);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load workspace.");
      } finally {
        setLoading(false);
      }
    }

    void loadWorkspace();
  }, []);

  async function saveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch<{ ok: boolean; workspace: WorkspaceSettings }>(
        "/workspace",
        {
          method: "PUT",
          body: JSON.stringify(workspace)
        }
      );

      setWorkspace(response.workspace);
      setSavedWorkspace(response.workspace);
      setMessage("Workspace saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save workspace.");
    } finally {
      setSaving(false);
    }
  }

  async function loadRepos() {
    setLoadingRepos(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch<{ ok: boolean; repos: RepositorySummary[] }>("/repos");
      setRepos(response.repos);
      const defaultRepo = response.repos.find((repo) => repo.name === workspace.defaultRepo);
      setSelectedRepoId(defaultRepo?.id ?? response.repos[0]?.id ?? "");
      setMessage(`Loaded ${response.repos.length} live Azure DevOps repos.`);
    } catch (repoError) {
      setError(repoError instanceof Error ? repoError.message : "Failed to load repositories.");
    } finally {
      setLoadingRepos(false);
    }
  }

  function updateField(field: keyof WorkspaceSettings, value: string) {
    setWorkspace((current) => ({ ...current, [field]: value }));
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading workspace...</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Azure DevOps settings
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            These settings are persisted in Supabase Postgres through the Railway backend. The PAT
            stays server-side in Railway; the browser only stores org/project preferences.
          </p>
        </div>

        <form onSubmit={saveWorkspace} className="mt-6 space-y-5">
          <Field label="Azure DevOps org URL">
            <input
              value={workspace.orgUrl}
              onChange={(event) => updateField("orgUrl", event.target.value)}
              placeholder="https://dev.azure.com/your-org"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </Field>

          <Field label="Project">
            <input
              value={workspace.project}
              onChange={(event) => updateField("project", event.target.value)}
              placeholder="Spec to Ship Sandbox"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Default repo name">
              <input
                value={workspace.defaultRepo}
                onChange={(event) => updateField("defaultRepo", event.target.value)}
                placeholder="repo-name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </Field>

            <Field label="Default branch">
              <input
                value={workspace.defaultBranch}
                onChange={(event) => updateField("defaultBranch", event.target.value)}
                placeholder="main"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Epic work item type">
              <input
                value={workspace.epicWorkItemType}
                onChange={(event) => updateField("epicWorkItemType", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </Field>

            <Field label="Issue work item type">
              <input
                value={workspace.issueWorkItemType}
                onChange={(event) => updateField("issueWorkItemType", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Save workspace"}
            </button>
            <button
              type="button"
              onClick={loadRepos}
              disabled={loadingRepos || !savedWorkspace}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {loadingRepos ? "Loading repos..." : "Load live repos"}
            </button>
          </div>
        </form>

        {message ? (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-8 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-950">Live repo dropdown test</h2>
              <p className="mt-1 text-sm text-slate-600">
                This dropdown is populated only from the Azure DevOps REST API.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {repos.length} repos
            </span>
          </div>

          <select
            value={selectedRepoId}
            onChange={(event) => setSelectedRepoId(event.target.value)}
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
            disabled={!repos.length}
          >
            <option value="">No repos loaded</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </select>

          {selectedRepo ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Repo ID:</span> {selectedRepo.id}
              </p>
              <p>
                <span className="font-semibold">Default branch:</span>{" "}
                {selectedRepo.defaultBranch || "Not set"}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Current workspace</h2>
          {savedWorkspace ? (
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Org URL" value={savedWorkspace.orgUrl} />
              <SummaryRow label="Project" value={savedWorkspace.project} />
              <SummaryRow label="Default repo" value={savedWorkspace.defaultRepo || "Not set"} />
              <SummaryRow
                label="Work items"
                value={`${savedWorkspace.epicWorkItemType} / ${savedWorkspace.issueWorkItemType}`}
              />
              <SummaryRow label="Branch" value={savedWorkspace.defaultBranch} />
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">No workspace has been saved yet.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-950">{value}</dd>
    </div>
  );
}