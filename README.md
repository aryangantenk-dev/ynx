# Yanzx AI — AI Full-Stack Website Builder

Describe a product once. Yanzx AI writes the **frontend, the API routes and the
database schema** as real files, streams them into a tri-pane IDE workspace, and
renders a live preview immediately.

```
┌──────────────┬──────────────────────────────┬───────────────────────┐
│  Explorer    │            Canvas            │  Yanzx AI Assistant   │
│  file tree   │  Preview · Code · Schema     │  streaming chat       │
│  checkpoints │  desktop / tablet / mobile   │  quick actions        │
└──────────────┴──────────────────────────────┴───────────────────────┘
```

## Why it is different

- **Demo mode is a first-class citizen.** With no provider key the app still
  generates a complete, downloadable project locally and labels it as demo mode.
  No dead ends, no fake "generating…" spinner.
- **Streaming, not waiting.** File blocks are parsed incrementally on every
  frame, so the file tree, the editor and the preview fill in as tokens arrive.
- **Credentials stay server-side.** The provider key is read only inside a Node
  route handler; `/api/health` reports booleans, never values.
- **Sandboxed preview.** Generated markup renders in an iframe with `sandbox`
  (no `allow-same-origin`) and scripts stripped, so it cannot touch the host app.
- **Keyboard first.** `⌘K` command palette, `⌘/` new build, `⌘.` stop.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript, strict |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Icons | Lucide |
| Fonts | Space Grotesk · Inter · JetBrains Mono (self-hosted variable fonts) |
| Persistence | localStorage by default · optional Supabase Postgres |
| AI | Any OpenAI-compatible `/chat/completions` endpoint |

## Design tokens

| Token | Value |
| --- | --- |
| Background | `#090D16` |
| Surface / Surface-2 | `#111827` / `#161F31` |
| Border | `#253048` |
| Foreground / Muted | `#E7EBF4` / `#94A0BC` |
| Primary | `#6366F1` |
| Accent / CTA | `#06B6D4` |
| Motion | 150–250 ms ease-out, `prefers-reduced-motion` respected |
| Direction | logical properties (`ms`/`me`/`ps`/`pe`) throughout |

## Project map

```
app/
  layout.tsx                 fonts, metadata, viewport
  page.tsx                   workspace shell
  globals.css                tokens, components, utilities, motion
  docs/page.tsx              setup & security notes
  api/generate/route.ts      streaming generator (provider → normalised SSE)
  api/health/route.ts        liveness + config probe (no secret values)
  api/projects/route.ts      optional Supabase persistence
components/
  Workspace.tsx              tri-pane shell, shortcuts, onboarding funnel
  Canvas.tsx                 preview / code / schema tabs + viewports
  AssistantPanel.tsx         streaming chat, quick actions, checkpoints
  PreviewFrame.tsx           sandboxed srcDoc iframe
  SchemaVisualizer.tsx       Prisma model cards (keys, relations, types)
  CodeView.tsx               tokenizer, line numbers, copy & download
  FileTree.tsx               grouped explorer with changed-file markers
  OnboardingModal.tsx        first-run funnel with focus trap
  CommandPalette.tsx         ⌘K search over files and actions
lib/
  types.ts                   shared domain types
  parse-stream.ts            <yanzx-file> parser + preview assembler
  prompt.ts                  the protocol system prompt
  demo-generator.ts          offline project generator (demo mode)
  use-generation.ts          stream client, checkpoints, persistence
  supabase.ts                server-only PostgREST helpers
supabase/schema.sql          optional persistence schema
```

## Getting started

```bash
cp .env.example .env.local     # add AI_API_KEY + AI_BASE_URL for live mode
npm install
npm run dev                    # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_API_KEY` | for live mode | Bearer token, server-side only |
| `AI_BASE_URL` | for live mode | e.g. `https://api.openai.com/v1` |
| `AI_MODEL` | optional | Deployment default model — must exist in `lib/models.ts` |
| `YANZX_API_KEY` | legacy | Read only if `AI_API_KEY` is absent |
| `AI_DEMO_MODE` | optional | `demo` forces the offline generator |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | optional | Cloud-saved projects |

> **Security:** any key pasted into a chat, issue or commit should be treated as
> public. Revoke it at the provider, issue a new one, and store it only as a
> server-side environment variable (Vercel → Settings → Environment Variables).
> Never put a model key in a `NEXT_PUBLIC_*` variable.

## The file protocol

The model must answer with file blocks and nothing else meaningful:

```text
<yanzx-file path="src/app/page.tsx">
export default function Page() { … }
</yanzx-file>
```

`lib/parse-stream.ts` extracts these blocks from a growing buffer, tolerates
partially streamed blocks, normalises paths and merges the result into the
project by path. A reply without blocks is surfaced as a real error.

## API

```bash
curl -N -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Build a task manager with teams"}'
```

```text
data: {"mode":"demo"}
data: {"delta":"<yanzx-file path=\"src/app/page.tsx\">\n…"}
data: [DONE]
```

`GET /api/generate` describes the configured mode; `GET /api/health` returns
liveness plus `providerConfigured` / `demoMode` booleans.

### Models

The catalog lives in [`lib/models.ts`](lib/models.ts) — shared by the server and
the picker, with no secrets in it. The picker in the header selects a model per
request; `POST /api/generate` forwards a model id **only** if it is in the
catalog, so a client can express a preference but never dictate an arbitrary
upstream call.

```bash
curl /api/models            # catalog + deployment default
curl /api/models?probe=1    # 1-token ping per model: which ones really answer
```

Probing matters: a provider can advertise models it does not serve. If the
chosen model fails, the stream falls back to the local generator and the notice
name the model that failed — it never silently pretends to be live.

## Deploy

Vercel auto-detects Next.js — no build overrides needed.

1. Import the repository, framework preset **Next.js**.
2. Add `AI_API_KEY` and `AI_BASE_URL` for Production and Preview.
3. Deploy. Without those variables the deployment runs in demo mode and says so.

## Roadmap

- [ ] Multi-file diff review before applying a generation
- [ ] Download the project as a `.zip` / open a PR with it
- [ ] Streaming into a real sandboxed runtime (WebContainer) instead of `srcDoc`
- [ ] Team workspaces backed by Supabase Auth + RLS

---

Built with care. No emoji icons, no neon gradients, no colour-only status.
