"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Checkpoint, ProjectFile } from "./types";
import { extractFiles, extractProse, mergeFiles } from "./parse-stream";
import { SEED_FILES } from "./seed-project";
import { DEFAULT_MODEL_ID, isAllowedModel, modelLabel } from "./models";

const STORAGE_KEY = "yanzx-ai:workspace:v1";

export type GenerationMode = "live" | "demo" | null;

interface PersistedState {
  files: ProjectFile[];
  messages: ChatMessage[];
  checkpoints: Checkpoint[];
  prompt: string;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (!clean) return "Untitled project";
  const short = clean.length > 52 ? `${clean.slice(0, 52).trimEnd()}…` : clean;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

interface StreamEvent {
  delta?: string;
  error?: string;
  mode?: "live" | "demo";
  notice?: string;
  model?: string;
  modelLabel?: string;
  fallbackFrom?: string | null;
  rejectedModel?: boolean;
  requestedModel?: string;
}

const MODEL_STORAGE_KEY = "yanzx-ai:model:v1";

export function useGeneration() {
  const [files, setFiles] = useState<ProjectFile[]>(SEED_FILES);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(SEED_FILES[0]?.path ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [mode, setMode] = useState<GenerationMode>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_MODEL_ID);
  /** The model the last completed generation actually used. */
  const [activeModel, setActiveModel] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const filesRef = useRef<ProjectFile[]>(files);
  filesRef.current = files;

  /* ── hydrate from localStorage so a reload keeps the workspace ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (Array.isArray(parsed.files) && parsed.files.length > 0) {
          setFiles(parsed.files);
          setActiveFile(parsed.files[0].path);
        }
        if (Array.isArray(parsed.messages)) {
          setMessages(
            parsed.messages.map((m) => ({
              ...m,
              status: m.status === "streaming" ? "done" : m.status,
            }))
          );
        }
        if (Array.isArray(parsed.checkpoints)) setCheckpoints(parsed.checkpoints);
        if (typeof parsed.prompt === "string") setLastPrompt(parsed.prompt);
      }
    } catch {
      /* corrupt storage — fall back to the seed project */
    }
    try {
      const storedModel = localStorage.getItem(MODEL_STORAGE_KEY);
      if (isAllowedModel(storedModel)) setModel(storedModel);
    } catch {
      /* storage blocked — keep the default model */
    } finally {
      setHydrated(true);
    }
  }, []);

  /* Remember the user's model choice, and adopt the deployment default once. */
  useEffect(() => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch {
      /* ignore */
    }
  }, [model]);

  /* ── persist (best effort: a quota error never breaks the session) ── */
  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedState = {
      files,
      messages: messages.filter((m) => m.status !== "error").slice(-40),
      checkpoints,
      prompt: lastPrompt,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota exceeded — keep working in memory */
    }
  }, [files, messages, checkpoints, lastPrompt, hydrated]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const pushCheckpoint = useCallback((label: string, changed: ProjectFile[]) => {
    setCheckpoints((prev) => {
      const checkpoint: Checkpoint = {
        id: uid("cp"),
        label,
        timestamp: Date.now(),
        files: mergeFiles(filesRef.current, changed),
      };
      return [checkpoint, ...prev].slice(0, 8);
    });
  }, []);

  const generate = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      if (abortRef.current) return; // a generation is already running

      const userMessage: ChatMessage = {
        id: uid("msg"),
        role: "user",
        content: trimmed,
        status: "done",
        createdAt: Date.now(),
      };
      const assistantId = uid("msg");
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: Date.now(),
      };

      const snapshot = filesRef.current;
      const history = messages
        .filter((m) => m.role !== "system" && m.status !== "error")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2_000) }));

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setLastPrompt(trimmed);
      setIsGenerating(true);
      setError(null);
      setNotice(null);

      const controller = new AbortController();
      abortRef.current = controller;

      let firstPath: string | null = null;
      const patchAssistant = (patch: Partial<ChatMessage>) => {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)));
      };
      const applyStream = (rawBuffer: string) => {
        const { files: extracted, seenPaths } = extractFiles(rawBuffer);
        if (seenPaths.length === 0) return extracted;
        setFiles((prev) => mergeFiles(prev, extracted));
        if (!firstPath && seenPaths[0]) {
          firstPath = seenPaths[0];
          setActiveFile(seenPaths[0]);
        }
        return extracted;
      };

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            files: snapshot.map((f) => ({
              path: f.path,
              content: f.content.slice(0, 20_000),
              language: f.language,
            })),
            history,
            model,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(
            detail?.error ?? `Generation request failed (${response.status}).`
          );
        }
        if (!response.body) throw new Error("The server returned an empty stream.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let raw = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(payload) as StreamEvent;
            } catch {
              continue;
            }

            if (event.error) {
              setError(event.error);
              continue;
            }
            if (event.mode) setMode(event.mode);
            if (event.notice) setNotice(event.notice);
            if (event.mode === "live" && typeof event.model === "string") {
              setActiveModel(event.model);
              if (event.rejectedModel) {
                setNotice(
                  `That model is not in the allowlist — used ${event.modelLabel ?? modelLabel(event.model)} instead.`
                );
              }
            }
            if (event.mode === "demo" && typeof event.fallbackFrom === "string") {
              setActiveModel(null);
            }
            if (event.delta) {
              raw += event.delta;
              applyStream(raw);
            }
          }
        }

        const { files: finalFiles } = extractFiles(raw, { partial: false });
        const prose = extractProse(raw);

        if (finalFiles.length > 0) {
          setFiles((prev) => mergeFiles(prev, finalFiles));
          pushCheckpoint(titleFromPrompt(trimmed), finalFiles);
          setActiveFile(firstPath ?? finalFiles[0].path);
          patchAssistant({
            content:
              prose ||
              `Wrote ${finalFiles.length} file${finalFiles.length === 1 ? "" : "s"} to the workspace.`,
            status: "done",
            fileCount: finalFiles.length,
          });
        } else {
          const message =
            prose || "The model replied without file blocks. Try a more specific prompt.";
          setError("No <yanzx-file> blocks were found in the response.");
          patchAssistant({ content: message, status: "error" });
        }
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          patchAssistant({ status: "done", content: "Generation stopped by you." });
        } else {
          const message = caught instanceof Error ? caught.message : "Generation failed.";
          setError(message);
          patchAssistant({ status: "error", content: message });
        }
      } finally {
        abortRef.current = null;
        setIsGenerating(false);
      }
    },
    [messages, pushCheckpoint]
  );

  const restore = useCallback((checkpoint: Checkpoint) => {
    setFiles(checkpoint.files);
    setActiveFile(checkpoint.files[0]?.path ?? null);
    setError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: uid("msg"),
        role: "system",
        content: `Restored checkpoint “${checkpoint.label}”.`,
        status: "done",
        createdAt: Date.now(),
      },
    ]);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    setFiles(SEED_FILES);
    setActiveFile(SEED_FILES[0]?.path ?? null);
    setMessages([]);
    setCheckpoints([]);
    setLastPrompt("");
    setError(null);
    setNotice(null);
    setMode(null);
    setActiveModel(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    files,
    messages,
    checkpoints,
    activeFile,
    isGenerating,
    error,
    notice,
    mode,
    lastPrompt,
    hydrated,
    model,
    setModel,
    activeModel,
    setActiveFile,
    generate,
    stop,
    restore,
    reset,
    clearError: () => setError(null),
    clearNotice: () => setNotice(null),
  };
}
