"use client";

import { useMemo } from "react";
import { Database, KeyRound, Link2, ListTree } from "lucide-react";
import type { ProjectFile } from "@/lib/types";

interface ParsedField {
  name: string;
  type: string;
  attributes: string;
}

interface ParsedModel {
  name: string;
  fields: ParsedField[];
}

/** Minimal Prisma schema reader: enough for model cards and key detection. */
export function parsePrisma(schema: string): ParsedModel[] {
  const models: ParsedModel[] = [];
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRe.exec(schema)) !== null) {
    const fields = match[2]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
      .map((line) => {
        const [name, type, ...rest] = line.split(/\s+/);
        return { name, type: type ?? "", attributes: rest.join(" ") };
      })
      .filter((field) => field.name && field.type);

    models.push({ name: match[1], fields });
  }
  return models;
}

const TYPE_TONE: Record<string, string> = {
  String: "text-[#7DD3A8]",
  Int: "text-[#8B8FF6]",
  Float: "text-[#8B8FF6]",
  Boolean: "text-[var(--warning)]",
  DateTime: "text-[var(--muted)]",
  Json: "text-[#7DD3A8]",
};

export default function SchemaVisualizer({ files }: { files: ProjectFile[] }) {
  const schemaFile = useMemo(
    () => files.find((f) => f.language === "prisma") ?? null,
    [files]
  );
  const models = useMemo(
    () => (schemaFile ? parsePrisma(schemaFile.content) : []),
    [schemaFile]
  );

  if (!schemaFile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Database className="size-9 text-[var(--muted)]" aria-hidden="true" />
        <p className="max-w-xs text-xs leading-5 text-[var(--muted)]">
          No <code className="font-mono text-[var(--foreground)]">schema.prisma</code> yet.
          Ask the assistant to “Create Database Table” and the schema will appear here.
        </p>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <ListTree className="size-9 text-[var(--muted)]" aria-hidden="true" />
        <p className="max-w-xs text-xs leading-5 text-[var(--muted)]">
          <code className="font-mono text-[var(--foreground)]">schema.prisma</code> has no
          models yet — ask the assistant to add tables.
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-area h-full overflow-y-auto p-3">
      <p className="mb-2 px-1 text-[11px] text-[var(--muted)]">
        {models.length} model{models.length === 1 ? "" : "s"} ·{" "}
        {models.reduce((sum, m) => sum + m.fields.length, 0)} fields
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {models.map((model) => (
          <article
            key={model.name}
            className="animate-rise overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"
          >
            <header className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <Database className="size-3.5 text-[var(--accent)]" aria-hidden="true" />
              <h3 className="font-mono text-xs font-semibold text-white">{model.name}</h3>
              <span className="ms-auto text-[10px] text-[var(--muted)]">
                {model.fields.length} cols
              </span>
            </header>
            <ul className="divide-y divide-[var(--border)]">
              {model.fields.map((field) => {
                const isKey = field.attributes.includes("@id");
                const isRelation = field.attributes.includes("@relation");
                const baseType = field.type.replace(/[?[\]]/g, "");
                return (
                  <li
                    key={field.name}
                    className="flex items-center gap-2 px-3 py-1.5 font-mono text-[11px]"
                  >
                    {isKey ? (
                      <KeyRound
                        className="size-3 shrink-0 text-[var(--accent)]"
                        aria-label="Primary key"
                      />
                    ) : isRelation ? (
                      <Link2
                        className="size-3 shrink-0 text-[var(--primary)]"
                        aria-label="Relation"
                      />
                    ) : (
                      <span className="size-3 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate text-white">{field.name}</span>
                    <span
                      className={`ms-auto shrink-0 ${TYPE_TONE[baseType] ?? "text-[var(--muted)]"}`}
                    >
                      {field.type}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
