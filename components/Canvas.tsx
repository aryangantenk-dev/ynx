"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Code2,
  Columns2,
  Database,
  Eye,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Terminal,
} from "lucide-react";
import type { ProjectFile } from "@/lib/types";
import CodeView from "./CodeView";
import PreviewFrame from "./PreviewFrame";
import SchemaVisualizer from "./SchemaVisualizer";

type CanvasTab = "preview" | "code" | "schema";
type Viewport = "desktop" | "tablet" | "mobile";

const TABS: { id: CanvasTab; label: string; icon: typeof Eye }[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "code", label: "Code", icon: Code2 },
  { id: "schema", label: "Schema", icon: Database },
];

const VIEWPORTS: { id: Viewport; label: string; icon: typeof Monitor; width: string }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: "100%" },
  { id: "tablet", label: "Tablet", icon: Tablet, width: "768px" },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: "390px" },
];

export default function Canvas({
  files,
  activeFile,
  isGenerating,
  onSelectFile,
}: {
  files: ProjectFile[];
  activeFile: string | null;
  isGenerating: boolean;
  onSelectFile: (path: string) => void;
}) {
  const [tab, setTab] = useState<CanvasTab>("preview");
  const [split, setSplit] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");

  const current = useMemo(
    () => files.find((file) => file.path === activeFile) ?? files[0] ?? null,
    [files, activeFile]
  );

  // Keep the explorer and the code pane in sync when a new file streams in.
  useEffect(() => {
    if (current && current.path !== activeFile) onSelectFile(current.path);
  }, [current, activeFile, onSelectFile]);

  const width = VIEWPORTS.find((v) => v.id === viewport)?.width ?? "100%";
  const empty = files.length === 0;

  return (
    <section
      aria-label="Workspace canvas"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <div
          role="tablist"
          aria-label="Canvas view"
          className="flex gap-1 rounded-lg bg-[var(--surface-2)] p-1"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id && !split}
              onClick={() => {
                setTab(id);
                setSplit(false);
              }}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                tab === id && !split
                  ? "bg-[color-mix(in_srgb,var(--primary)_28%,transparent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={split}
            aria-label="Split view: preview and code side by side"
            title="Split view"
            onClick={() => setSplit((value) => !value)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
              split
                ? "bg-[color-mix(in_srgb,var(--primary)_28%,transparent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Columns2 className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Split</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isGenerating && (
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--accent)]">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              Writing files…
            </span>
          )}
          <div
            role="group"
            aria-label="Preview viewport"
            className="flex gap-0.5 rounded-lg bg-[var(--surface-2)] p-1"
          >
            {VIEWPORTS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewport(id)}
                aria-pressed={viewport === id}
                aria-label={`${label} viewport`}
                title={label}
                className="btn-icon !size-6"
                data-active={viewport === id}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {empty && !isGenerating && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <Terminal className="size-9 text-[var(--muted)]" aria-hidden="true" />
            <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
              The canvas is empty. Describe what you want to build in the
              assistant panel and every generated file lands here.
            </p>
          </div>
        )}

        {isGenerating && empty && (
          <div
            className="h-full space-y-3 p-6"
            aria-busy="true"
            aria-label="Generating project"
          >
            {[82, 64, 91, 48, 72].map((w, index) => (
              <div
                key={index}
                className="shimmer h-3.5 rounded"
                style={{ width: `${w}%` }}
              />
            ))}
            <p className="flex items-center gap-2 pt-2 text-xs text-[var(--accent)]">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Yanzx AI is writing files…
            </p>
          </div>
        )}

        {!empty && (
          <div
            className={`grid h-full min-h-0 ${
              split ? "grid-rows-2 xl:grid-cols-2 xl:grid-rows-1" : "grid-rows-1"
            }`}
          >
            {(split || tab === "preview") && (
              <div className="min-h-0 min-w-0 overflow-auto bg-[#05070d] p-3">
                <PreviewFrame files={files} width={width} />
              </div>
            )}

            {(split || tab === "code") && (
              <div
                className={`min-h-0 min-w-0 ${
                  split ? "border-t border-[var(--border)] xl:border-s xl:border-t-0" : ""
                }`}
              >
                {current ? (
                  <CodeView file={current} />
                ) : (
                  <p className="p-6 text-sm text-[var(--muted)]">
                    Select a file in the explorer to read its source.
                  </p>
                )}
              </div>
            )}

            {!split && tab === "schema" && (
              <div className="min-h-0 min-w-0">
                <SchemaVisualizer files={files} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
