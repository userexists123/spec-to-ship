import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Saturday 1</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
          PM workspace foundation
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
          Save your Azure DevOps workspace once, then use it as the source of truth for live repo
          loading and future PRD, backlog, PR review, and traceability workflows.
        </p>
        <div className="mt-6">
          <Link
            href="/workspace"
            className="inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Configure workspace
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["No auth", "Single-user pilot only, matching the build plan."],
          ["Real data", "Repository loading calls Azure DevOps through the saved workspace."],
          ["Preview-first", "Risky Azure DevOps writes stay behind existing backend safeguards."]
        ].map(([title, copy]) => (
          <div key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
          </div>
        ))}
      </section>
    </div>
  );
}