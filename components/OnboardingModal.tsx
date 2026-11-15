"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Sparkles, X } from "lucide-react";
import Logo from "./Logo";

const EXAMPLES = [
  "Build a SaaS dashboard with user login and a Postgres schema",
  "Create a task manager for small teams with an assignees API",
  "Generate a landing page plus a signup API with email validation",
  "Build a product catalogue with a cart route and Prisma models",
];

const STEPS = [
  "Describe the product in one sentence.",
  "Yanzx AI writes frontend, API routes and schema.",
  "Preview it live, then copy the files you want.",
];

export default function OnboardingModal({
  open,
  onClose,
  onSubmit,
  isGenerating,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Focus trap: keep Tab cycling inside the dialog while it is open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isGenerating) {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, textarea, input, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, isGenerating, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050810]/80 p-4 backdrop-blur-md">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-desc"
        className="animate-rise w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] glow-primary"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div className="flex items-start gap-3">
            <Logo size={38} />
            <div>
              <h2 id="onboarding-title" className="text-lg font-semibold leading-tight">
                Build with Yanzx AI
              </h2>
              <p id="onboarding-desc" className="mt-1 text-sm leading-5 text-[var(--muted)]">
                Describe your product once. Frontend, backend and database come
                back as real files.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Close onboarding"
            className="btn-icon shrink-0"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <ol className="flex flex-col gap-1.5 px-5 pt-4 text-xs text-[var(--muted)]">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span
                className="grid size-4 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[9px] font-semibold text-[var(--muted)]"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <form
          className="p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim() && !isGenerating) onSubmit(value.trim());
          }}
        >
          <label htmlFor="onboard-prompt" className="label">
            Your first prompt
          </label>
          <textarea
            ref={textareaRef}
            id="onboard-prompt"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (value.trim() && !isGenerating) onSubmit(value.trim());
              }
            }}
            rows={3}
            placeholder="e.g. Build a SaaS dashboard with user login"
            className="field mt-1.5 resize-none leading-6"
          />

          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Example prompts">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setValue(example)}
                className="chip text-start"
              >
                {example}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!value.trim() || isGenerating}
            className="btn-accent mt-4 w-full !py-2.5"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Generating your project…
              </>
            ) : (
              <>
                <Sparkles className="size-4" aria-hidden="true" />
                Generate full-stack project
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
            No account needed · your workspace stays in this browser
          </p>
        </form>
      </div>
    </div>
  );
}
