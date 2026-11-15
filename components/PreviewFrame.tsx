"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ProjectFile } from "@/lib/types";
import { buildPreviewHtml } from "@/lib/parse-stream";

export default function PreviewFrame({
  files,
  width,
}: {
  files: ProjectFile[];
  width: string;
}) {
  const [nonce, setNonce] = useState(0);
  const [failed, setFailed] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(() => buildPreviewHtml(files), [files]);

  useEffect(() => {
    setFailed(false);
  }, [html, nonce]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-2">
      <div className="flex w-full items-center gap-2 px-1">
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
          <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
          Sandboxed preview
        </span>
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="btn-icon ms-auto !size-6"
          aria-label="Reload the preview"
          title="Reload preview"
        >
          <RefreshCw className="size-3" aria-hidden="true" />
        </button>
      </div>

      {failed ? (
        <div
          role="status"
          className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-6 text-center"
        >
          <AlertTriangle className="size-6 text-[var(--warning)]" aria-hidden="true" />
          <p className="max-w-xs text-xs leading-5 text-[var(--muted)]">
            The preview could not render. Switch to the Code tab to inspect the
            generated markup.
          </p>
        </div>
      ) : (
        <iframe
          ref={frameRef}
          key={nonce}
          title="Live preview of the generated project"
          // No allow-same-origin: generated markup can never reach this app's
          // storage, cookies or DOM.
          sandbox="allow-scripts allow-forms allow-popups"
          referrerPolicy="no-referrer"
          srcDoc={html}
          onError={() => setFailed(true)}
          className="h-full min-h-[320px] rounded-lg border border-[var(--border)] bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] transition-[width] duration-200 ease-out"
          style={{ width }}
        />
      )}
    </div>
  );
}
