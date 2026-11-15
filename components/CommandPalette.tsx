"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

export default function CommandPalette({
  open,
  commands,
  onClose,
}: {
  open: boolean;
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        c.hint?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setIndex(0);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/65 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="glass w-full max-w-lg overflow-hidden rounded-xl shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
          <Search className="size-4 text-[var(--muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((i) => (results.length ? (i + 1) % results.length : 0));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const command = results[index];
                if (command) {
                  command.run();
                  onClose();
                }
              }
            }}
            placeholder="Search files and commands…"
            aria-label="Search files and commands"
            className="w-full bg-transparent py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <ul className="scroll-area max-h-[52vh] overflow-y-auto p-1.5" role="listbox" aria-label="Commands">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-[var(--muted)]">
              Nothing matches “{query}”.
            </li>
          )}
          {results.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => setIndex(i)}
                onClick={() => {
                  command.run();
                  onClose();
                }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-start text-xs transition-colors ${
                  i === index
                    ? "bg-[color-mix(in_srgb,var(--primary)_22%,transparent)] text-white"
                    : "text-[var(--muted)]"
                }`}
              >
                <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide opacity-70">
                  {command.group}
                </span>
                <span className="truncate">{command.label}</span>
                {i === index && (
                  <CornerDownLeft className="ms-auto size-3 shrink-0" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
