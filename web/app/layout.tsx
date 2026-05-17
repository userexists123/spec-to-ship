import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spec-to-Ship PM Workspace",
  description: "Single-PM pilot workspace for PRD to Azure DevOps workflows"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-lg font-semibold text-slate-950">
                Spec-to-Ship
              </Link>
              <nav className="flex gap-4 text-sm font-medium text-slate-600">
                <Link href="/workspace" className="hover:text-slate-950">
                  Workspace
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}