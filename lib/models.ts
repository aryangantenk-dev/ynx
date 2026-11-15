/**
 * Model catalog for the Yanzx AI generator.
 *
 * This module is imported by BOTH the server route handlers and the client
 * picker, so it must stay free of secrets and side effects — it only describes
 * model ids and their display metadata. The API key never lives here.
 */

export interface ModelOption {
  /** Exact id sent to the provider in the `model` field. */
  id: string;
  label: string;
  /** One-line description shown in the picker. */
  blurb: string;
  /** Coarse capability hint used for the picker badge. */
  tier: "flagship" | "fast" | "code" | "balanced";
  /** Preferred default for full-project generation. */
  recommended?: boolean;
}

export const MODEL_CATALOG: readonly ModelOption[] = [
  {
    id: "free/Claude-Opus-5.5",
    label: "Claude Opus 5.5",
    blurb: "Strongest multi-file reasoning. Best for whole-project builds.",
    tier: "flagship",
    recommended: true,
  },
  {
    id: "free/gpt-6-luna",
    label: "GPT-6 Luna",
    blurb: "Balanced quality and speed for everyday edits.",
    tier: "balanced",
  },
  {
    id: "free/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    blurb: "Strong at code generation and refactors.",
    tier: "code",
  },
  {
    id: "free/claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    blurb: "Fastest responses. Good for small, targeted changes.",
    tier: "fast",
  },
  {
    id: "free/glm-5.3-flash",
    label: "GLM 5.3 Flash",
    blurb: "Low-latency option for quick iterations.",
    tier: "fast",
  },
  {
    id: "free/qwen3.8-flash",
    label: "Qwen 3.8 Flash",
    blurb: "Efficient generalist with broad language coverage.",
    tier: "fast",
  },
] as const;

/** Every id the server is willing to forward upstream. */
export const ALLOWED_MODEL_IDS: readonly string[] = MODEL_CATALOG.map((m) => m.id);

export const DEFAULT_MODEL_ID =
  MODEL_CATALOG.find((m) => m.recommended)?.id ?? MODEL_CATALOG[0].id;

/**
 * The server only ever forwards a model id that appears in the catalog. A
 * client-supplied id is treated as a preference, never as authority.
 */
export function isAllowedModel(id: unknown): id is string {
  return typeof id === "string" && ALLOWED_MODEL_IDS.includes(id);
}

export function modelLabel(id: string): string {
  return MODEL_CATALOG.find((m) => m.id === id)?.label ?? id;
}

export function modelOption(id: string): ModelOption | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}
