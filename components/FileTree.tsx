"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Database,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Palette,
} from "lucide-react";
import type { ProjectFile } from "@/lib/types";

interface Group {
  dir: string;
  files: ProjectFile[];
}

function iconFor(file: ProjectFile) {
  switch (file.language) {
    case "prisma":
    case "sql":
      return Database;
    case "json":
      return FileJson;
    case "css":
      return Palette;
    case "md":
      return FileText;
    default:
      return FileCode2;
  }
}

/** Groups files by directory, ordered so src/app reads first. */
function groupFiles(files: ProjectFile[]): Group[] {
  const map = new Map<string, ProjectFile[]>();
  for (const file of files) {
    const cut = file.path.lastIndexOf("/");
    const dir = cut === -1 ? "/" : file.path.slice(0, cut);
    const bucket = map.get(dir);
    if (bucket) bucket.push(file);
    else map.set(dir, [file]);
  }
  return [...map.entries()]
    .map(([dir, dirFiles]) => ({
      dir,
      files: [...dirFiles].sort((a, b) => a.path.localeCompare(b.path)),
    }))
    .sort((a, b) => {
      if (a.dir === "/") return 1;
      if (b.dir === "/") return -1;
      return a.dir.localeCompare(b.dir);
    });
}

export default function FileTree({
  files,
  activeFile,
  onSelect,
  changedPaths,
}: {
  files: ProjectFile[];
  activeFile: string | null;
  onSelect: (path: string) => void;
  changedPaths?: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupFiles(files), [files]);

  const toggle = (dir: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });

  if (files.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs leading-5 text-[var(--muted)]">
        No files yet. Describe your product in the assistant panel and Yanzx AI
        will scaffold the project here.
      </p>
    );
  }

  return (
    <nav aria-label="Project files" className="scroll-area max-h-full overflow-y-auto pb-4">
      {groups.map(({ dir, files: dirFiles }) => {
        const isCollapsed = collapsed.has(dir);
        return (
          <div key={dir} className="mb-0.5">
            <button
              type="button"
              onClick={() => toggle(dir)}
              aria-expanded={!isCollapsed}
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-start text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ChevronRight
                className={`size-3 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
                aria-hidden="true"
              />
              {isCollapsed ? (
                <Folder className="size-3.5" aria-hidden="true" />
              ) : (
                <FolderOpen className="size-3.5" aria-hidden="true" />
              )}
              <span className="truncate normal-case tracking-normal" title={dir}>
                {dir === "/" ? "root" : dir}
              </span>
              <span className="ms-auto shrink-0 text-[10px] text-[var(--muted)]/70">
                {dirFiles.length}
              </span>
            </button>

            {!isCollapsed && (
              <ul>
                {dirFiles.map((file) => {
                  const Icon = iconFor(file);
                  const isActive = file.path === activeFile;
                  const isChanged = changedPaths?.has(file.path);
                  return (
                    <li key={file.path}>
                      <button
                        type="button"
                        onClick={() => onSelect(file.path)}
                        aria-current={isActive ? "true" : undefined}
                        title={file.path}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pe-2.5 ps-7 text-start text-xs transition-colors duration-150 ${
                          isActive
                            ? "bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-white"
                            : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <Icon
                          className={`size-3.5 shrink-0 ${isActive ? "text-[var(--accent)]" : ""}`}
                          aria-hidden="true"
                        />
                        <span className="truncate font-mono">
                          {file.path.split("/").pop()}
                        </span>
                        {isChanged && (
                          <span
                            className="ms-auto size-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                            title="Changed in the last generation"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
