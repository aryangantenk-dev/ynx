import type { ProjectFile } from "./types";

/**
 * Offline, deterministic project generator.
 *
 * Yanzx AI's live mode calls an OpenAI-compatible provider. When no provider is
 * configured (or the provider is rate-limited) this generator keeps the whole
 * product usable: it derives an entity, a form and a REST handler from the
 * prompt and emits real, copy-pasteable files.
 */

interface Blueprint {
  title: string;
  tagline: string;
  model: string;
  table: string;
  fields: { name: string; type: string; sql: string; input: string; label: string }[];
  needsAuth: boolean;
}

const THEMES: { match: RegExp; blueprint: Blueprint }[] = [
  {
    match: /task|todo|kanban|project|team/i,
    blueprint: {
      title: "Task Workspace",
      tagline: "Plan work, assign owners and track every task in one board.",
      model: "Task",
      table: "tasks",
      fields: [
        { name: "title", type: "String", sql: "text not null", input: "text", label: "Task title" },
        { name: "status", type: "String", sql: "text not null default 'todo'", input: "text", label: "Status" },
        { name: "assignee", type: "String?", sql: "text", input: "text", label: "Assignee" },
      ],
      needsAuth: false,
    },
  },
  {
    match: /shop|store|product|ecommerce|cart|market/i,
    blueprint: {
      title: "Storefront",
      tagline: "A catalogue, a cart API and a product schema you can ship today.",
      model: "Product",
      table: "products",
      fields: [
        { name: "name", type: "String", sql: "text not null", input: "text", label: "Product name" },
        { name: "price", type: "Int", sql: "integer not null default 0", input: "number", label: "Price (cents)" },
        { name: "sku", type: "String", sql: "text not null unique", input: "text", label: "SKU" },
      ],
      needsAuth: false,
    },
  },
  {
    match: /blog|article|post|cms|content/i,
    blueprint: {
      title: "Editorial Hub",
      tagline: "Draft, publish and index articles with a typed content pipeline.",
      model: "Article",
      table: "articles",
      fields: [
        { name: "title", type: "String", sql: "text not null", input: "text", label: "Article title" },
        { name: "slug", type: "String", sql: "text not null unique", input: "text", label: "Slug" },
        { name: "published", type: "Boolean", sql: "boolean not null default false", input: "checkbox", label: "Published" },
      ],
      needsAuth: false,
    },
  },
  {
    match: /contact|lead|crm|customer|client/i,
    blueprint: {
      title: "Lead Console",
      tagline: "Capture enquiries, score them and reply from one console.",
      model: "Lead",
      table: "leads",
      fields: [
        { name: "email", type: "String", sql: "text not null", input: "email", label: "Work email" },
        { name: "company", type: "String?", sql: "text", input: "text", label: "Company" },
        { name: "score", type: "Int", sql: "integer not null default 0", input: "number", label: "Score" },
      ],
      needsAuth: false,
    },
  },
];

const DEFAULT_BLUEPRINT: Blueprint = {
  title: "SaaS Dashboard",
  tagline: "Metrics, a signup API and a Postgres schema generated from one prompt.",
  model: "Workspace",
  table: "workspaces",
  fields: [
    { name: "name", type: "String", sql: "text not null", input: "text", label: "Workspace name" },
    { name: "plan", type: "String", sql: "text not null default 'free'", input: "text", label: "Plan" },
    { name: "seats", type: "Int", sql: "integer not null default 1", input: "number", label: "Seats" },
  ],
  needsAuth: true,
};

function pickBlueprint(prompt: string): Blueprint {
  const themed = THEMES.find((t) => t.match.test(prompt));
  const blueprint = themed ? { ...themed.blueprint } : { ...DEFAULT_BLUEPRINT };
  blueprint.needsAuth = blueprint.needsAuth || /auth|login|sign ?up|account/i.test(prompt);
  return blueprint;
}

function slug(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["build", "create", "generate", "make", "with", "that", "and", "for", "the"].includes(w))
    .slice(0, 3);
  return words.length ? words.join("-") : "yanzx-app";
}

export function demoProjectFiles(prompt: string): ProjectFile[] {
  const bp = pickBlueprint(prompt);
  const route = bp.table.replace(/s$/, "");
  const inputs = bp.fields
    .map(
      (f) => `          <label className="block text-sm font-medium text-slate-700" htmlFor="${f.name}">
            ${f.label}
            <input
              id="${f.name}"
              name="${f.name}"
              type="${f.input}"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="${f.label}"
            />
          </label>`
    )
    .join("\n");

  const page = `export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          ${bp.model} · generated by Yanzx AI
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">${bp.title}</h1>
        <p className="mt-2 text-slate-600">${bp.tagline}</p>

        <form
          action="/api/${route}"
          method="post"
          className="mt-8 space-y-4 rounded-2xl border bg-white p-6 shadow-lg"
        >
${inputs}
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Create ${bp.model.toLowerCase()}
          </button>
        </form>
      </div>
    </main>
  );
}`;

  const apiRoute = `import { NextResponse } from "next/server";

interface ${bp.model}Input {
${bp.fields
  .map((f) => `  ${f.name}?: ${f.type.replace("?", "") === "Int" ? "number" : f.type.replace("?", "") === "Boolean" ? "boolean" : "string"};`)
  .join("\n")}
}

export async function POST(request: Request) {
  let body: ${bp.model}Input;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const errors: string[] = [];
${bp.fields
  .filter((f) => f.type === "String" || f.type === "Int")
  .map((f) => `  if (body.${f.name} === undefined || body.${f.name} === "") errors.push("${f.name} is required.");`)
  .join("\n")}

  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 422 });
  }

  // TODO: replace with prisma.${bp.table.replace(/s$/, "")}.create({ data: body })
  return NextResponse.json({ ok: true, ${route}: body }, { status: 201 });
}
`;

  const schema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model ${bp.model} {
  id        String   @id @default(cuid())
${bp.fields.map((f) => `  ${f.name.padEnd(9)} ${f.type}`).join("\n")}
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}`;

  const sql = `-- Generated by Yanzx AI · initial migration
create table if not exists ${bp.table} (
  id uuid primary key default gen_random_uuid(),
${bp.fields.map((f) => `  ${f.name} ${f.sql},`).join("\n")}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ${bp.table}_created_at_idx on ${bp.table} (created_at desc);
`;

  const files: ProjectFile[] = [
    { path: "src/app/page.tsx", content: page, language: "tsx" },
    { path: "src/app/api/" + route + "/route.ts", content: apiRoute, language: "ts" },
    { path: "prisma/schema.prisma", content: schema, language: "prisma" },
    { path: "prisma/migrations/init.sql", content: sql, language: "sql" },
    {
      path: "src/app/layout.tsx",
      content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${bp.title} · built with Yanzx AI",
  description: "${bp.tagline}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
      language: "tsx",
    },
    {
      path: "src/app/globals.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}`,
      language: "css",
    },
  ];

  if (bp.needsAuth) {
    files.push({
      path: "src/app/api/auth/session/route.ts",
      content: `import { NextResponse } from "next/server";

export async function GET() {
  // Wire this to your auth provider; never trust a client-supplied user id.
  return NextResponse.json({ user: null }, { status: 200 });
}
`,
      language: "ts",
    });
  }

  return files;
}

function toBlocks(files: ProjectFile[]): string[] {
  return files.map(
    (f) => `<yanzx-file path="${f.path}">\n${f.content.trim()}\n</yanzx-file>\n`
  );
}

/** Streams the demo project in chunks so the UI exercises the real pipeline. */
export async function* streamDemoProject(prompt: string): AsyncGenerator<string> {
  const bp = pickBlueprint(prompt);
  const heading = `Demo mode — no AI provider is configured, so Yanzx AI generated a ${bp.title} scaffold locally.\n\n`;
  const chunks = [heading, ...toBlocks(demoProjectFiles(prompt))];

  for (const chunk of chunks) {
    const step = 42;
    for (let i = 0; i < chunk.length; i += step) {
      yield chunk.slice(i, i + step);
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
  }
}
