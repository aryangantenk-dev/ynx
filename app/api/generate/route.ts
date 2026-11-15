import { NextResponse } from "next/server";
import { SYSTEM_PROMPT, EDIT_HINT } from "@/lib/prompt";
import { streamDemoProject } from "@/lib/demo-generator";
import type { ChatMessage, ProjectFile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_PROMPT_CHARS = 8_000;
const MAX_CONTEXT_FILES = 40;
const MAX_FILE_CHARS = 24_000;

/* ─────────────────────────── config resolution ─────────────────────────── */

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  demo: boolean;
}

/**
 * Reads provider settings from the server environment only.
 * The key is never referenced in a module that ships to the browser.
 */
function readConfig(): ProviderConfig {
  const apiKey = process.env.AI_API_KEY ?? process.env.YANZX_API_KEY ?? "";
  const baseUrl = (process.env.AI_BASE_URL ?? "").replace(/\/+$/, "");
  const model = process.env.AI_MODEL ?? "yanzx-builder-v1";
  const forcedDemo = process.env.AI_DEMO_MODE === "demo";
  return { apiKey, baseUrl, model, demo: forcedDemo || !apiKey || !baseUrl };
}

/* ─────────────────────────────── rate limit ─────────────────────────────── */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > MAX_REQUESTS;
}

/* ──────────────────────────────── streaming ─────────────────────────────── */

const encoder = new TextEncoder();

function sse(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function makeStream(handler: (send: (payload: unknown) => void, signal: AbortSignal) => Promise<void>) {
  const abort = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(sse(payload));
        } catch {
          /* controller already closed */
        }
      };
      try {
        await handler(send, abort.signal);
        send("[DONE]");
      } catch (error) {
        const message =
          error instanceof Error && error.name === "AbortError"
            ? "Generation cancelled."
            : "The generation stream failed.";
        send({ error: message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Re-emits an upstream OpenAI-compatible SSE stream as normalised frames. */
async function pipeUpstream(
  upstream: Response,
  send: (payload: unknown) => void,
  signal: AbortSignal
): Promise<void> {
  const contentType = upstream.headers.get("content-type") ?? "";

  // Some gateways ignore `stream: true` and return a single JSON object.
  if (!contentType.includes("text/event-stream")) {
    const json = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (json.error?.message) {
      send({ error: `AI provider error: ${json.error.message}` });
      return;
    }
    const content = json.choices?.[0]?.message?.content ?? "";
    if (content) send({ delta: content });
    return;
  }

  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      if (signal.aborted) {
        await reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue; // heartbeat
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload) as {
            choices?: {
              delta?: { content?: string | null };
              message?: { content?: string };
              finish_reason?: string | null;
            }[];
            error?: { message?: string };
          };
          if (json.error?.message) {
            send({ error: `AI provider error: ${json.error.message}` });
            return;
          }
          const choice = json.choices?.[0];
          const delta = choice?.delta?.content ?? choice?.message?.content ?? "";
          if (delta) send({ delta });
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/* ────────────────────────────────── route ───────────────────────────────── */

interface GenerateBody {
  prompt?: unknown;
  files?: unknown;
  history?: unknown;
}

function sanitiseFiles(input: unknown): ProjectFile[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (f): f is ProjectFile =>
        !!f && typeof f === "object" && typeof (f as ProjectFile).path === "string" && typeof (f as ProjectFile).content === "string"
    )
    .slice(0, MAX_CONTEXT_FILES)
    .map((f) => ({ ...f, content: f.content.slice(0, MAX_FILE_CHARS) }));
}

function sanitiseHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === "object" &&
        typeof (m as ChatMessage).content === "string" &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant")
    )
    .slice(-8)
    .map((m) => ({ ...m, content: m.content.slice(0, 4_000) }));
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many generations in the last minute. Please wait a moment." },
      { status: 429 }
    );
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 422 });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { error: `Prompt is too long (max ${MAX_PROMPT_CHARS} characters).` },
      { status: 413 }
    );
  }

  const files = sanitiseFiles(body.files);
  const history = sanitiseHistory(body.history);
  const config = readConfig();

  /* ── demo mode: no provider configured, everything still works ── */
  if (config.demo) {
    return makeStream(async (send, signal) => {
      send({ mode: "demo" });
      for await (const chunk of streamDemoProject(prompt)) {
        if (signal.aborted) return;
        send({ delta: chunk });
      }
    });
  }

  const projectContext =
    files.length > 0
      ? `\n\nCurrent project files (paths only, already in the workspace):\n${files
          .map((f) => `- ${f.path}`)
          .join("\n")}\n\n${EDIT_HINT}`
      : "";

  const upstreamMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: `${prompt}${projectContext}` },
  ];

  let upstream: Response;
  try {
    upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        // Server-to-server only: this header never reaches the browser bundle.
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        temperature: 0.35,
        messages: upstreamMessages,
      }),
    });
  } catch {
    // Network failure: degrade to the local generator instead of a dead end.
    return makeStream(async (send, signal) => {
      send({ mode: "demo", notice: "AI provider unreachable — using the local generator." });
      for await (const chunk of streamDemoProject(prompt)) {
        if (signal.aborted) return;
        send({ delta: chunk });
      }
    });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = upstream.status === 401 || upstream.status === 403 ? "invalid API key" : `status ${upstream.status}`;
    return makeStream(async (send) => {
      send({ mode: "demo", notice: `AI provider rejected the request (${detail}) — using the local generator.` });
      for await (const chunk of streamDemoProject(prompt)) {
        send({ delta: chunk });
      }
    });
  }

  return makeStream(async (send, signal) => {
    send({ mode: "live", model: config.model });
    await pipeUpstream(upstream, send, signal);
  });
}

export async function GET() {
  const config = readConfig();
  return NextResponse.json({
    endpoint: "/api/generate",
    method: "POST",
    mode: config.demo ? "demo" : "live",
    model: config.demo ? "local-generator" : config.model,
    providerConfigured: !config.demo,
  });
}
