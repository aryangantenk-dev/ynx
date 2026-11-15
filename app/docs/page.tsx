import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck, Terminal } from "lucide-react";

export const metadata: Metadata = {
  title: "Setup & security",
  description: "How Yanzx AI reads provider credentials, and how to deploy it safely.",
};

const ENV_ROWS = [
  {
    key: "AI_API_KEY",
    required: "Required for live generation",
    detail:
      "Server-only bearer token for an OpenAI-compatible chat-completions endpoint. Never prefix it with NEXT_PUBLIC_.",
  },
  {
    key: "AI_BASE_URL",
    required: "Required for live generation",
    detail: "Base URL including the version segment, e.g. https://api.openai.com/v1.",
  },
  {
    key: "AI_MODEL",
    required: "Optional",
    detail:
      "Deployment default model. Must be one of the ids in lib/models.ts; an unknown id silently falls back to the catalog default.",
  },
  {
    key: "YANZX_API_KEY",
    required: "Legacy alias",
    detail: "Read only if AI_API_KEY is absent. Prefer AI_API_KEY.",
  },
  {
    key: "AI_DEMO_MODE",
    required: "Optional",
    detail: 'Set to "demo" to force the built-in offline generator.',
  },
  {
    key: "SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY",
    required: "Optional",
    detail:
      "Enable cloud-saved projects through /api/projects. Without them the workspace persists in localStorage only.",
  },
];

export default function DocsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to the workspace
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Setup & security</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Yanzx AI ships with a working offline generator, so the product is usable
        the moment it is deployed. Add one provider key to switch to live model
        generation — no other change required.
      </p>

      <section className="glass mt-8 rounded-xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-[var(--accent)]" aria-hidden="true" />
          Rotate before you deploy
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Any API key pasted into a chat, an issue or a commit message should be
          considered public. Revoke it in the provider dashboard, generate a new
          one, and store it only as a server-side environment variable — in
          Vercel that means <span className="font-mono text-[var(--foreground)]">Project → Settings → Environment Variables</span>{" "}
          with the <em>Production</em> and <em>Preview</em> targets.
        </p>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--muted)]">
          <li className="flex gap-2">
            <KeyRound className="mt-0.5 size-3.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
            <span>
              The key is read inside <span className="font-mono text-[var(--foreground)]">app/api/generate/route.ts</span>,
              which is a Node.js route handler. It never crosses into a client
              component.
            </span>
          </li>
          <li className="flex gap-2">
            <Terminal className="mt-0.5 size-3.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
            <span>
              <span className="font-mono text-[var(--foreground)]">/api/health</span> reports
              only whether a key exists — never its value.
            </span>
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
            <span>
              Generated markup renders inside an iframe with{" "}
              <span className="font-mono text-[var(--foreground)]">sandbox</span> (no{" "}
              <span className="font-mono">allow-same-origin</span>) and scripts are
              stripped from the preview document.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Environment variables</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full border-collapse text-start text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-semibold">Variable</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ENV_ROWS.map((row) => (
                <tr key={row.key} className="border-t border-[var(--border)] align-top">
                  <th scope="row" className="px-3 py-2.5 text-start font-mono font-normal text-[var(--foreground)]">
                    {row.key}
                  </th>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{row.required}</td>
                  <td className="px-3 py-2.5 leading-5 text-[var(--muted)]">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Models</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
          The picker in the workspace header sends a <em>preference</em>, never an
          instruction: <span className="font-mono text-[var(--foreground)]">POST /api/generate</span>{" "}
          only forwards ids present in{" "}
          <span className="font-mono text-[var(--foreground)]">lib/models.ts</span>. Anything
          else is replaced by the deployment default and the response says so.
        </p>
        <p className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-3 text-[11px] leading-5 text-[var(--warning)]">
          Advertised ≠ served. On the currently configured provider only{" "}
          <span className="font-mono">free/gpt-6-luna</span> answered a probe; the
          others returned 502/503 or timed out. That is why the default model is
          the verified one and the rest are marked <em>unavailable</em> in the picker.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-semibold">Endpoint</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">Returns</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--border)] align-top">
                <th scope="row" className="px-3 py-2.5 text-start font-mono font-normal text-[var(--foreground)]">
                  GET /api/models
                </th>
                <td className="px-3 py-2.5 leading-5 text-[var(--muted)]">
                  Catalog, allowlist and the deployment default. No secret values.
                </td>
              </tr>
              <tr className="border-t border-[var(--border)] align-top">
                <th scope="row" className="px-3 py-2.5 text-start font-mono font-normal text-[var(--foreground)]">
                  GET /api/models?probe=1
                </th>
                <td className="px-3 py-2.5 leading-5 text-[var(--muted)]">
                  Pings each model with a 1-token completion and reports which are
                  reachable. Use it after rotating keys to confirm the provider is
                  actually serving what it advertises.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Local development</h2>
        <pre className="scroll-area mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 font-mono text-xs leading-6 text-[#C7D0E4]">{`cp .env.example .env.local   # add AI_API_KEY + AI_BASE_URL
npm install
npm run dev                 # http://localhost:3000
curl localhost:3000/api/models?probe=1   # which models actually respond`}</pre>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          Without a key the app runs in demo mode: the assistant streams a real,
          download-ready scaffold generated locally, and the UI says so plainly.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Optional Supabase persistence</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
          Run <span className="font-mono text-[var(--foreground)]">supabase/schema.sql</span> in
          the SQL editor, then set{" "}
          <span className="font-mono text-[var(--foreground)]">SUPABASE_URL</span> and{" "}
          <span className="font-mono text-[var(--foreground)]">SUPABASE_SERVICE_ROLE_KEY</span>.
          The table has row-level security enabled with no public policies; only
          the server route can read it.
        </p>
      </section>
    </main>
  );
}
