import { NextResponse } from "next/server";
import { ALLOWED_MODEL_IDS, DEFAULT_MODEL_ID, isAllowedModel } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + configuration probe. Reports only booleans about secrets —
 * never the values themselves.
 */
export async function GET() {
  const apiKey = process.env.AI_API_KEY ?? process.env.YANZX_API_KEY ?? "";
  const baseUrl = process.env.AI_BASE_URL ?? "";
  const configuredModel = process.env.AI_MODEL ?? "";
  const modelAllowed = configuredModel === "" || isAllowedModel(configuredModel);

  return NextResponse.json({
    ok: true,
    service: "yanzx-ai",
    time: new Date().toISOString(),
    generator: {
      providerConfigured: Boolean(apiKey && baseUrl),
      baseUrlHost: baseUrl ? safeHost(baseUrl) : null,
      // Reports only whether AI_MODEL is valid, not the key or token itself.
      model: isAllowedModel(configuredModel) ? configuredModel : DEFAULT_MODEL_ID,
      modelAllowed,
      allowlistSize: ALLOWED_MODEL_IDS.length,
      demoMode: process.env.AI_DEMO_MODE === "demo" || !apiKey || !baseUrl,
    },
  });
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
