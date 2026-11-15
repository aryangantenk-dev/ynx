"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CircleStop,
  CornerDownLeft,
  History,
  Loader2,
  SendHorizonal,
  Sparkles,
  User,
} from "lucide-react";
import type { ChatMessage, Checkpoint } from "@/lib/types";
import { modelLabel } from "@/lib/models";

const QUICK_ACTIONS = [
  "Add authentication",
  "Create database table",
  "Add an API route",
  "Fix the styling",
  "Make it responsive",
] as const;

const STATUS_META: Record<
  NonNullable<ChatMessage["status"]>,
  { label: string; className: string }
> = {
  streaming: { label: "Streaming", className: "text-[var(--accent)]" },
  done: { label: "Complete", className: "text-[var(--success)]" },
  error: { label: "Failed", className: "text-[var(--danger)]" },
};

function timeLabel(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AssistantPanel({
  messages,
  isGenerating,
  mode,
  model,
  notice,
  error,
  checkpoints,
  onSend,
  onStop,
  onRestore,
  onClearError,
  onDownloadAll,
}: {
  messages: ChatMessage[];
  isGenerating: boolean;
  mode: "live" | "demo" | null;
  /** Model id the last generation actually used, if any. */
  model: string | null;
  notice: string | null;
  error: string | null;
  checkpoints: Checkpoint[];
  onSend: (prompt: string) => void;
  onStop: () => void;
  onRestore: (checkpoint: Checkpoint) => void;
  onClearError: () => void;
  onDownloadAll: () => void;
}) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 160;
    if (nearBottom || isGenerating) {
      node.scrollTo({ top: node.scrollHeight, behavior: isGenerating ? "auto" : "smooth" });
    }
  }, [messages, isGenerating]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <aside
      aria-label="Yanzx AI assistant"
      className="pane flex min-h-0 w-full flex-col border-[var(--border)] lg:w-[360px] lg:border-s xl:w-[400px]"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <Bot className="size-4 text-[var(--accent)]" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Yanzx AI Assistant</h2>
        <span
          role="status"
          className="ms-auto flex items-center gap-1.5 text-[11px] font-medium"
        >
          <span
            className={`size-1.5 rounded-full ${
              isGenerating
                ? "animate-pulse bg-[var(--accent)]"
                : mode === "live"
                  ? "bg-[var(--success)]"
                  : "bg-[var(--muted)]"
            }`}
            aria-hidden="true"
          />
          <span className={isGenerating ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
            {isGenerating
              ? "Streaming…"
              : mode === "live" && model
                ? modelLabel(model)
                : mode === "demo"
                  ? "Demo mode"
                  : "Ready"}
          </span>
        </span>
      </header>

      {mode === "demo" && (
        <p className="flex items-start gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-4 py-2 text-[11px] leading-4 text-[var(--warning)]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Demo generator active — no AI provider key is configured on this
            deployment. Files are still real and downloadable.
          </span>
        </p>
      )}

      {notice && (
        <p className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[11px] leading-4 text-[var(--muted)]">
          {notice}
        </p>
      )}

      <div
        ref={listRef}
        className="scroll-area min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.length === 0 && (
          <div className="px-2 py-10 text-center">
            <Sparkles className="mx-auto size-7 text-[var(--muted)]" aria-hidden="true" />
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              Ask for anything — components, API routes, database schemas. Start
              with one of the suggestions below.
            </p>
          </div>
        )}

        {messages.map((message) => {
          const status = message.status ? STATUS_META[message.status] : null;
          const isUser = message.role === "user";
          const isSystem = message.role === "system";

          if (isSystem) {
            return (
              <p
                key={message.id}
                className="mx-auto w-fit rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[10px] text-[var(--muted)]"
              >
                {message.content}
              </p>
            );
          }

          return (
            <article
              key={message.id}
              className={`animate-rise rounded-lg border p-3 ${
                isUser
                  ? "border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface-2))]"
                  : "border-[var(--border)] bg-[var(--surface-2)]"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                {isUser ? (
                  <User className="size-3 text-[var(--primary)]" aria-hidden="true" />
                ) : (
                  <Bot className="size-3 text-[var(--accent)]" aria-hidden="true" />
                )}
                <span className={isUser ? "text-[var(--primary)]" : "text-[var(--accent)]"}>
                  {isUser ? "You" : "Yanzx AI"}
                </span>
                <time className="text-[10px] font-normal text-[var(--muted)]">
                  {timeLabel(message.createdAt)}
                </time>
                {status && (
                  <span className={`ms-auto flex items-center gap-1 ${status.className}`}>
                    {message.status === "streaming" && (
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    )}
                    {message.status === "done" && (
                      <Check className="size-3" aria-hidden="true" />
                    )}
                    {message.status === "error" && (
                      <AlertCircle className="size-3" aria-hidden="true" />
                    )}
                    {status.label}
                    {typeof message.fileCount === "number" && message.fileCount > 0 && (
                      <span className="text-[var(--muted)]">· {message.fileCount} files</span>
                    )}
                  </span>
                )}
              </div>
              <p
                className={`whitespace-pre-wrap break-words text-xs leading-5 text-[#C7D0E4] ${
                  message.status === "streaming" ? "caret" : ""
                }`}
              >
                {message.content || (message.status === "streaming" ? "Thinking…" : "")}
              </p>
            </article>
          );
        })}
      </div>

      {checkpoints.length > 0 && (
        <section className="shrink-0 border-t border-[var(--border)] px-3 py-2">
          <h3 className="label mb-1.5 flex items-center gap-1.5">
            <History className="size-3" aria-hidden="true" />
            Checkpoints
          </h3>
          <ul className="scroll-area flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
            {checkpoints.map((checkpoint) => (
              <li key={checkpoint.id}>
                <button
                  type="button"
                  onClick={() => onRestore(checkpoint)}
                  title={`Restore ${checkpoint.files.length} files from ${new Date(
                    checkpoint.timestamp
                  ).toLocaleTimeString()}`}
                  className="chip max-w-[10rem] truncate"
                >
                  {checkpoint.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2 text-[11px] leading-4 text-[var(--danger)]"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="break-words">{error}</span>
          <button
            type="button"
            onClick={onClearError}
            className="ms-auto shrink-0 cursor-pointer underline decoration-dotted"
          >
            dismiss
          </button>
        </div>
      )}

      <form
        className="shrink-0 border-t border-[var(--border)] p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
      >
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick actions">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              disabled={isGenerating}
              onClick={() => submit(action)}
              className="chip !text-[10px] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {action}
            </button>
          ))}
        </div>

        <div className="relative">
          <label htmlFor="assistant-input" className="sr-only">
            Prompt Yanzx AI
          </label>
          <textarea
            ref={inputRef}
            id="assistant-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(input);
              }
            }}
            rows={3}
            placeholder="Describe what to build or change…"
            className="field scroll-area resize-none !pe-12 leading-5"
          />
          <div className="absolute bottom-2 end-2 flex items-center gap-1">
            {isGenerating ? (
              <button
                type="button"
                onClick={onStop}
                className="btn-ghost !px-2.5 !py-1.5 !text-[11px]"
                aria-label="Stop generating"
              >
                <CircleStop className="size-3.5" aria-hidden="true" />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="grid size-8 cursor-pointer place-items-center rounded-md bg-[var(--primary)] text-white transition-colors hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send prompt"
              >
                <SendHorizonal className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-3" aria-hidden="true" />
            Enter to send · Shift+Enter for a new line
          </span>
          <button
            type="button"
            onClick={onDownloadAll}
            className="cursor-pointer underline decoration-dotted hover:text-[var(--foreground)]"
          >
            Export .md
          </button>
        </div>
      </form>
    </aside>
  );
}
