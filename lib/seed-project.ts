import type { ProjectFile } from "./types";

export const SEED_FILES: ProjectFile[] = [
  {
    path: "src/app/page.tsx",
    language: "tsx",
    content: `export default function Home() {
  return (
    <main className="min-h-screen p-10">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Yanzx AI workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Welcome to your project
        </h1>
        <p className="mt-2 text-slate-600">
          This is a seed preview. Ask Yanzx AI in the right panel to build a
          full-stack app and every generated file will replace this canvas.
        </p>
        <div className="mt-6 flex gap-3">
          <span className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            Frontend
          </span>
          <span className="rounded-full border px-4 py-2 text-sm font-semibold text-slate-900">
            Backend
          </span>
          <span className="rounded-full border px-4 py-2 text-sm font-semibold text-slate-900">
            Database
          </span>
        </div>
      </div>
    </main>
  );
}`,
  },
  {
    path: "prisma/schema.prisma",
    language: "prisma",
    content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Project {
  id        String   @id @default(cuid())
  name      String
  ownerId   String
  createdAt DateTime @default(now())
}`,
  },
];

export const SEED_CHECKPOINT_LABEL = "Seed project";
