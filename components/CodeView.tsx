"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { languageLabel } from "@/lib/parse-stream";
import type { ProjectFile } from "@/lib/types";

const KEYWORDS =
  /\b(import|export|default|from|const|let|var|function|return|if|else|for|while|async|await|new|class|extends|interface|type|enum|model|datasource|generator|create|table|select|insert|into|values|not|null|true|false|undefined|void|try|catch|finally|throw|switch|case|break|continue|as|typeof|instanceof|declare|readonly|public|private|protected|static|implements)\b/gi;

const TOKEN_RE =
  /(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\/\/[^\n]*|--[^\n]*)|\b(\d+(?:\.\d+)?)\b/g;

function renderPlain(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  KEYWORDS.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = KEYWORDS.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(
      <span key={`${keyBase}-k${match.index}`} className="text-[#8B8FF6]">
        {match[0]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Lightweight, dependency-free tokenizer: strings → comments → keywords. */
function highlight(line: string, lineIndex: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let tokenIndex = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(...renderPlain(line.slice(last, match.index), `${lineIndex}-${tokenIndex++}`));
    }
    const [value] = match;
    const isComment = Boolean(match[2]) || value.startsWith("//") || value.startsWith("--");
    parts.push(
      <span
        key={`${lineIndex}-t${tokenIndex++}`}
        className={isComment ? "italic text-[#5B6884]" : "text-[#7DD3A8]"}
      >
        {value}
      </span>
    );
    last = match.index + value.length;
    if (isComment) break; // nothing meaningful after a comment
  }

  if (last < line.length) {
    parts.push(...renderPlain(line.slice(last), `${lineIndex}-${tokenIndex}`));
  }
  return parts.length > 0 ? parts : [" "];
}

export default function CodeView({ file }: { file: ProjectFile }) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => file.content.split("\n"), [file.content]);
  const highlighted = useMemo(() => lines.map((line, i) => highlight(line, i)), [lines]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard permission denied — non-fatal */
    }
  };

  const download = () => {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.path.split("/").pop() ?? "file.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--background)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
        <span
          className="truncate font-mono text-xs text-[var(--muted)]"
          title={file.path}
        >
          {file.path}
        </span>
        <span className="ms-auto flex shrink-0 items-center gap-1.5">
          <span className="kbd uppercase">{languageLabel(file.language)}</span>
          <span className="kbd">{lines.length} ln</span>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "File copied to clipboard" : "Copy file contents"}
            className="btn-ghost !px-2 !py-1 !text-[11px]"
          >
            {copied ? (
              <Check className="size-3.5 text-[var(--accent)]" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={download}
            aria-label={`Download ${file.path}`}
            className="btn-icon"
          >
            <Download className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      </div>

      <pre
        tabIndex={0}
        aria-label={`Source code of ${file.path}`}
        className="scroll-area min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-6 text-[#C7D0E4]"
      >
        <code>
          {highlighted.map((line, index) => (
            <div key={index} className="flex">
              <span
                aria-hidden="true"
                className="me-4 w-8 shrink-0 select-none text-end text-[#3D4A66]"
              >
                {index + 1}
              </span>
              <span className="whitespace-pre-wrap break-words">{line}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
