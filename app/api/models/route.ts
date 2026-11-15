import { NextResponse } from "next/server";
import {
  ALLOWED_MODEL_IDS,
  DEFAULT_MODEL_ID,
  MODEL_CATALOG,
  isAllowedModel,
} from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Resolves the server-side provider config without leaking any value. */
function readProvider() {
  const apiKey = process.env.AI_API_KEY ?? process.env.YANZX_API_KEY ?? "";
  const baseUrl = (process.env.AI_BASE_URL ?? "").replace(/\/+$/, "");
  const configuredModel = process.env.AI_MODEL ?? "";
  const defaultModel = isAllowedModel(configuredModel) ? configuredModel : DEFAULT_MODEL_ID;
  return {
    apiKey,
    baseUrl,
    defaultModel,
    configured: Boolean(apiKey && baseUrl),
  };
}

interface ProbeResult {
  id: string;
  ok: boolean;
  latencyMs: number;
  status?: number;
  error?: string;
}

/**
 * Sends a 1-token completion to the provider so the UI (and deployments) can
 * verify which models are actually reachable. Runs server-side only.
 */
async function probeModel(
  id: string,
  apiKey: string,
  baseUrl: string,
  timeoutMs = 12_000
): Promise<ProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: id,
        max_tokens: 1,
        stream: false,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - started;
    if (response.ok) return { id, ok: true, latencyMs, status: response.status };

    let detail = "";
    try {
      const json = (await response.json()) as { error?: { message?: string } | string };
      detail =
        typeof json.error === "string" ? json.error : (json.error?.message ?? "");
    } catch {
      /* non-JSON error body */
    }
    return {
      id,
      ok: false,
      latencyMs,
      status: response.status,
      error: (detail || response.statusText || "request failed").slice(0, 160),
    };
  } catch (error) {
    return {
      id,
      ok: false,
      latencyMs: Date.now() - started,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "timed out"
          : "network error",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/models
 *   → catalog + configured default. Never returns the key or the base URL value.
 *
 * GET /api/models?probe=1
 *   → additionally pings every model and reports which ones respond. Used by the
 *     picker's "Test models" action and by deployment smoke tests.
 */
export async function GET(request: Request) {
  const provider = readProvider();
  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") === "1";

  const base = {
    models: MODEL_CATALOG,
    allowlist: ALLOWED_MODEL_IDS,
    defaultModel: provider.defaultModel,
    providerConfigured: provider.configured,
  };

  if (!probe) {
    return NextResponse.json(base, { headers: { "Cache-Control": "no-store" } });
  }

  if (!provider.configured) {
    return NextResponse.json(
      {
        ...base,
        probe: { skipped: "Provider is not configured on this deployment." },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Bound the fan-out so a slow provider cannot hold the request open for long.
  const targets = url.searchParams.get("model")
    ? ALLOWED_MODEL_IDS.filter((id) => id === url.searchParams.get("model"))
    : ALLOWED_MODEL_IDS;

  const results = await Promise.all(
    targets.map((id) => probeModel(id, provider.apiKey, provider.baseUrl))
  );

  return NextResponse.json(
    {
      ...base,
      probe: {
        checkedAt: new Date().toISOString(),
        results,
        reachable: results.filter((r) => r.ok).map((r) => r.id),
        unreachable: results.filter((r) => !r.ok).map((r) => r.id),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
