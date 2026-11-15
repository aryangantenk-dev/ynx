import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + configuration probe. Reports only booleans about secrets —
 * never the values themselves.
 */
export async function GET() {
  const apiKey = process.env.AI_API_KEY ?? process.env.YANZX_API_KEY ?? "";
  const baseUrl = process.env.AI_BASE_URL ?? "";

  return NextResponse.json({
    ok: true,
    service: "yanzx-ai",
    time: new Date().toISOString(),
    generator: {
      providerConfigured: Boolean(apiKey && baseUrl),
      baseUrlHost: baseUrl ? safeHost(baseUrl) : null,
      model: process.env.AI_MODEL ?? null,
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
