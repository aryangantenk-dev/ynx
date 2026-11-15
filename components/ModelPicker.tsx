"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleDot,
  Loader2,
  PlugZap,
  Sparkles,
  X,
} from "lucide-react";
import { MODEL_CATALOG, modelLabel, modelOption, type ModelOption } from "@/lib/models";

type ProbeState =
  | { status: "idle" }
  | { status: "running" }
  | {
      status: "done";
      reachable: string[];
      unreachable: string[];
      skipped?: string;
      error?: string;
    };

const TIER_LABEL: Record<ModelOption["tier"], string> = {
  flagship: "Flagship",
  balanced: "Balanced",
  code: "Code",
  fast: "Fast",
};

export default function ModelPicker({
  value,
  onChange,
  disabled,
  activeModel,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** The model the last generation actually ran on, if known. */
  activeModel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [probe, setProbe] = useState<ProbeState>({ status: "idle" });
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => modelOption(value), [value]);

  /* Close on outside click / Escape. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = MODEL_CATALOG.findIndex((m) => m.id === value);
    setCursor(index === -1 ? 0 : index);
  }, [open, value]);

  const runProbe = async () => {
    setProbe({ status: "running" });
    try {
      const response = await fetch("/api/models?probe=1", { cache: "no-store" });
      const json = (await response.json()) as {
        probe?: {
          skipped?: string;
          reachable?: string[];
          unreachable?: string[];
          results?: { id: string; error?: string }[];
        };
        error?: string;
      };
      if (json.probe?.skipped) {
        setProbe({
          status: "done",
          reachable: [],
          unreachable: [],
          skipped: json.probe.skipped,
        });
        return;
      }
      setProbe({
        status: "done",
        reachable: json.probe?.reachable ?? [],
        unreachable: json.probe?.unreachable ?? [],
        error: json.error,
      });
    } catch {
      setProbe({
        status: "done",
        reachable: [],
        unreachable: [],
        error: "Could not reach /api/models.",
      });
    }
  };

  const probeFor = (id: string): "ok" | "fail" | "unknown" => {
    if (probe.status !== "done") return "unknown";
    if (probe.reachable.includes(id)) return "ok";
    if (probe.unreachable.includes(id)) return "fail";
    return "unknown";
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Model: ${selected?.label ?? value}. Change model`}
        className="btn-ghost !py-1.5 !text-[11px] disabled:opacity-50"
      >
        <Sparkles className="size-3.5 text-[var(--accent)]" aria-hidden="true" />
        <span className="max-w-[9rem] truncate">{selected?.label ?? value}</span>
        <ChevronDown
          className={`size-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="glass animate-rise absolute end-0 top-[calc(100%+6px)] z-50 w-[22rem] overflow-hidden rounded-xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <h3 className="label">Model</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={runProbe}
                disabled={probe.status === "running"}
                className="btn-ghost !px-2 !py-1 !text-[10px]"
              >
                {probe.status === "running" ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <PlugZap className="size-3" aria-hidden="true" />
                )}
                Test models
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-icon !size-6"
                aria-label="Close model picker"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
          </div>

          <ul
            role="listbox"
            aria-label="Available models"
            className="scroll-area max-h-[19rem] overflow-y-auto p-1.5"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((i) => (i + 1) % MODEL_CATALOG.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((i) => (i - 1 + MODEL_CATALOG.length) % MODEL_CATALOG.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                onChange(MODEL_CATALOG[cursor].id);
                setOpen(false);
              }
            }}
            tabIndex={-1}
          >
            {MODEL_CATALOG.map((option, index) => {
              const isSelected = option.id === value;
              const health = probeFor(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-start transition-colors duration-150 ${
                      index === cursor
                        ? "bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
                        : "hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <Check className="size-3.5 text-[var(--accent)]" aria-label="Selected" />
                      ) : (
                        <CircleDot
                          className={`size-3.5 ${
                            health === "ok"
                              ? "text-[var(--success)]"
                              : health === "fail"
                                ? "text-[var(--danger)]"
                                : "text-[var(--border)]"
                          }`}
                          aria-label={
                            health === "ok"
                              ? "Reachable"
                              : health === "fail"
                                ? "Unreachable"
                                : "Not tested"
                          }
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-[var(--foreground)]">
                          {option.label}
                        </span>
                        <span className="kbd shrink-0 !text-[9px]">
                          {TIER_LABEL[option.tier]}
                        </span>
                        {option.recommended && (
                          <span className="shrink-0 text-[9px] font-semibold uppercase text-[var(--accent)]">
                            default
                          </span>
                        )}
                        {option.knownDown && (
                          <span
                            className="shrink-0 text-[9px] font-semibold uppercase text-[var(--warning)]"
                            title="Last probe failed for this model on the configured provider"
                          >
                            unavailable
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-[var(--muted)]">
                        {option.blurb}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[9px] text-[var(--muted)]/70">
                        {option.id}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-[var(--border)] px-3 py-2 text-[10px] leading-4 text-[var(--muted)]">
            {probe.status === "idle" && (
              <p>
                “Test models” pings each model once to show which ones your
                provider actually serves.
              </p>
            )}
            {probe.status === "running" && (
              <p className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                Probing models…
              </p>
            )}
            {probe.status === "done" && probe.skipped && (
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-[var(--warning)]" aria-hidden="true" />
                {probe.skipped}
              </p>
            )}
            {probe.status === "done" && !probe.skipped && (
              <p className="flex items-start gap-1.5">
                {probe.unreachable.length > 0 ? (
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-[var(--warning)]" aria-hidden="true" />
                ) : (
                  <Check className="mt-0.5 size-3 shrink-0 text-[var(--success)]" aria-hidden="true" />
                )}
                <span>
                  {probe.reachable.length} of {MODEL_CATALOG.length} models reachable
                  {probe.unreachable.length > 0 && (
                    <span className="text-[var(--warning)]">
                      {" "}
                      · {probe.unreachable.map((id) => modelLabel(id)).join(", ")} failed
                    </span>
                  )}
                  {probe.error ? ` · ${probe.error}` : ""}
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
