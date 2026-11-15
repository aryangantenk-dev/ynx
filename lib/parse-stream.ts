import type { FileLanguage, ProjectFile } from "./types";

const FILE_OPEN = /<yanzx-file\s+path="([^"]+)"\s*>/g;
const FILE_CLOSE = "</yanzx-file>";

export function detectLanguage(path: string): FileLanguage {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return "tsx";
  if (path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".mjs")) return "ts";
  if (path.endsWith(".prisma")) return "prisma";
  if (path.endsWith(".sql")) return "sql";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".md") || path.endsWith(".mdx")) return "md";
  return "html";
}

/** Normalises a model-emitted path: strips leading "./", "/" and "../". */
export function normalizePath(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/^(\.\/|\/|\.\.\/)+/, "")
    .replace(/\\/g, "/");
}

export interface ExtractResult {
  files: ProjectFile[];
  /** Paths seen in the raw buffer, including ones still streaming. */
  seenPaths: string[];
  /** True when the stream ended inside a file block. */
  unterminated: boolean;
}

/**
 * Incrementally extracts `<yanzx-file path="...">…</yanzx-file>` blocks from a
 * growing raw buffer. Safe to call on every streamed chunk: unfinished trailing
 * blocks are returned as partial files so the UI can preview code as it lands.
 */
export function extractFiles(raw: string, opts: { partial?: boolean } = {}): ExtractResult {
  const includePartial = opts.partial ?? true;
  const files: ProjectFile[] = [];
  const seenPaths: string[] = [];
  let unterminated = false;

  let cursor = 0;
  for (;;) {
    FILE_OPEN.lastIndex = cursor;
    const open = FILE_OPEN.exec(raw);
    if (!open) break;

    const path = normalizePath(open[1]);
    const bodyStart = open.index + open[0].length;
    const closeIdx = raw.indexOf(FILE_CLOSE, bodyStart);
    const closed = closeIdx !== -1;
    const bodyEnd = closed ? closeIdx : raw.length;
    const content = raw.slice(bodyStart, bodyEnd).replace(/^\r?\n/, "").replace(/\r?\n$/, "");

    if (path) {
      seenPaths.push(path);
      if (!closed) unterminated = true;
      if (closed || includePartial) {
        files.push({ path, content, language: detectLanguage(path) });
      }
    }
    cursor = closed ? closeIdx + FILE_CLOSE.length : raw.length;
    if (!closed) break;
  }

  return { files, seenPaths, unterminated };
}

/** Extracts only the prose the assistant wrote outside file blocks. */
export function extractProse(raw: string): string {
  return raw
    .replace(/<yanzx-file[\s\S]*?(?:<\/yanzx-file>|$)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Merges freshly extracted files into an existing project, by path. */
export function mergeFiles(base: ProjectFile[], incoming: ProjectFile[]): ProjectFile[] {
  if (incoming.length === 0) return base;
  const map = new Map(base.map((f) => [f.path, f]));
  for (const file of incoming) map.set(file.path, file);
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function languageLabel(language: FileLanguage): string {
  switch (language) {
    case "tsx":
      return "TSX";
    case "ts":
      return "TS";
    case "prisma":
      return "Prisma";
    case "sql":
      return "SQL";
    case "json":
      return "JSON";
    case "css":
      return "CSS";
    case "md":
      return "MD";
    default:
      return "HTML";
  }
}

/* ──────────────────────────── Live preview ──────────────────────────── */

/** Very small, deterministic HTML sanitiser for the sandboxed preview iframe. */
function stripExecutable(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function tsxToHtml(content: string): string {
  const marker = content.lastIndexOf("return");
  let body = content;
  if (marker !== -1) {
    const paren = content.indexOf("(", marker);
    const rest = paren !== -1 ? content.slice(paren + 1) : content.slice(marker + "return".length);
    body = stripTrailing(rest);
  }
  return body
    .replace(/\bclassName=/g, "class=")
    .replace(/\bhtmlFor=/g, "for=")
    .replace(/\{`([^`]*)`\}/g, "$1")
    .replace(/\{"([^"]*)"\}/g, "$1")
    .replace(/\{'(.*?)'\}/g, "$1");
}

/** Removes the dangling `);` / `}` that closes a component's return block. */
function stripTrailing(source: string): string {
  let out = source.trim();
  for (let i = 0; i < 4; i += 1) {
    if (/\)\s*;?\s*\}?\s*$/.test(out)) out = out.replace(/\)\s*;?\s*\}?\s*$/, "");
    else if (/\}\s*;?\s*$/.test(out)) out = out.replace(/\}\s*;?\s*$/, "");
    else break;
  }
  return out.trim();
}

function findPage(files: ProjectFile[]): ProjectFile | null {
  const exact = files.find((f) => f.path === "src/app/page.tsx" || f.path === "app/page.tsx");
  if (exact) return exact;
  return (
    files.find((f) => /(^|\/)page\.(tsx|jsx|html)$/.test(f.path)) ??
    files.find((f) => f.language === "html") ??
    null
  );
}

const PREVIEW_BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#F8FAFC;color:#0F172A;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55}
img,svg{max-width:100%;height:auto}
button,input,select,textarea{font:inherit}
`;

/**
 * Assembles a renderable HTML document from generated files for the Live
 * Preview iframe. Stylesheets generated by the model are inlined; Tailwind
 * utility classes are approximated by a small compatibility stylesheet so the
 * preview never depends on an external CDN.
 */
export function buildPreviewHtml(files: ProjectFile[]): string {
  const page = findPage(files);
  const css = files
    .filter((f) => f.language === "css")
    .map((f) => f.content.replace(/@tailwind\s+\w+;?/g, ""))
    .join("\n");

  const fallback = `<main style="padding:2rem"><h1 style="margin:0 0 .5rem">Preview canvas</h1>
<p style="margin:0;color:#475569">Generated markup renders here once Yanzx AI writes a page.</p></main>`;

  if (!page) {
    return shell(fallback, css);
  }

  const body =
    page.language === "html"
      ? stripExecutable(page.content)
      : stripExecutable(tsxToHtml(page.content));

  return shell(body || fallback, css);
}

function shell(body: string, css: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${PREVIEW_BASE_CSS}</style>
<style>${TW_SHIM}</style>
<style>${css}</style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * A tiny subset of Tailwind utilities, hand-written so the preview has no
 * network dependency. Covers the classes the generator uses most.
 */
const TW_SHIM = `
.container{margin-inline:auto;max-width:1120px;padding-inline:1rem}
.mx-auto{margin-inline:auto}.mt-auto{margin-top:auto}
.flex{display:flex}.inline-flex{display:inline-flex}.grid{display:grid}.block{display:block}.hidden{display:none}
.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}
.items-center{align-items:center}.items-start{align-items:flex-start}.items-end{align-items:flex-end}
.justify-center{justify-content:center}.justify-between{justify-content:space-between}.justify-end{justify-content:flex-end}
.gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-6{gap:1.5rem}.gap-8{gap:2rem}
.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.p-2{padding:.5rem}.p-3{padding:.75rem}.p-4{padding:1rem}.p-6{padding:1.5rem}.p-8{padding:2rem}.p-10{padding:2.5rem}
.px-2{padding-inline:.5rem}.px-3{padding-inline:.75rem}.px-4{padding-inline:1rem}.px-6{padding-inline:1.5rem}
.py-1{padding-block:.25rem}.py-2{padding-block:.5rem}.py-3{padding-block:.75rem}.py-4{padding-block:1rem}
.mt-1{margin-top:.25rem}.mt-2{margin-top:.5rem}.mt-4{margin-top:1rem}.mt-6{margin-top:1.5rem}.mt-8{margin-top:2rem}
.mb-2{margin-bottom:.5rem}.mb-4{margin-bottom:1rem}.mb-6{margin-bottom:1.5rem}.mb-8{margin-bottom:2rem}
.min-h-screen{min-height:100vh}.h-full{height:100%}.w-full{width:100%}
.max-w-sm{max-width:24rem}.max-w-md{max-width:28rem}.max-w-lg{max-width:32rem}.max-w-2xl{max-width:42rem}
.rounded{border-radius:.375rem}.rounded-md{border-radius:.375rem}.rounded-lg{border-radius:.5rem}
.rounded-xl{border-radius:.75rem}.rounded-2xl{border-radius:1rem}.rounded-full{border-radius:9999px}
.border{border-width:1px;border-style:solid;border-color:#E2E8F0}
.border-b{border-bottom:1px solid #E2E8F0}
.shadow{box-shadow:0 1px 3px rgb(15 23 42 / .12)}
.shadow-lg{box-shadow:0 10px 30px -12px rgb(15 23 42 / .35)}
.text-xs{font-size:.75rem}.text-sm{font-size:.875rem}.text-base{font-size:1rem}
.text-lg{font-size:1.125rem}.text-xl{font-size:1.25rem}.text-2xl{font-size:1.5rem}
.text-3xl{font-size:1.875rem}.text-4xl{font-size:2.25rem}
.font-medium{font-weight:500}.font-semibold{font-weight:600}.font-bold{font-weight:700}
.text-center{text-align:center}.text-white{color:#fff}
.text-slate-400{color:#94A3B8}.text-slate-500{color:#64748B}.text-slate-600{color:#475569}
.text-slate-900{color:#0F172A}.text-gray-500{color:#6B7280}.text-indigo-600{color:#4F46E5}
.bg-white{background-color:#fff}.bg-slate-50{background-color:#F8FAFC}.bg-slate-100{background-color:#F1F5F9}
.bg-indigo-600{background-color:#4F46E5}.bg-indigo-500{background-color:#6366F1}
.bg-\\[\\#090D16\\]{background-color:#090D16}
.uppercase{text-transform:uppercase}.tracking-wide{letter-spacing:.025em}
.space-y-2>*+*{margin-top:.5rem}.space-y-3>*+*{margin-top:.75rem}.space-y-4>*+*{margin-top:1rem}
.space-y-6>*+*{margin-top:1.5rem}
`;
