import "server-only";
import type { ProjectFile } from "./types";

/**
 * Optional Supabase persistence via the PostgREST API.
 *
 * Uses `fetch` instead of the SDK so the service-role key never appears in a
 * client bundle and the app still runs with zero database configuration.
 * Required env (server-side only):
 *   SUPABASE_URL               (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const TABLE = "yanzx_projects";

export interface ProjectRecord {
  id: string;
  title: string;
  prompt: string | null;
  files: ProjectFile[];
  created_at: string;
  updated_at: string;
}

export function supabaseConfig() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { configured: Boolean(url && key), url, key };
}

async function request(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error("Supabase is not configured.");

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${response.status}: ${detail.slice(0, 300)}`);
  }
  if (response.status === 204) return null;
  return (await response.json()) as unknown;
}

export async function listProjects(limit = 20): Promise<ProjectRecord[]> {
  const rows = await request(
    `${TABLE}?select=id,title,prompt,files,created_at,updated_at&order=updated_at.desc&limit=${limit}`
  );
  return Array.isArray(rows) ? (rows as ProjectRecord[]) : [];
}

export async function saveProject(input: {
  id?: string;
  title: string;
  prompt: string;
  files: ProjectFile[];
}): Promise<ProjectRecord> {
  const payload = {
    title: input.title.slice(0, 120),
    prompt: input.prompt.slice(0, 8_000),
    files: input.files,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const rows = await request(`${TABLE}?id=eq.${encodeURIComponent(input.id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const row = Array.isArray(rows) ? (rows[0] as ProjectRecord | undefined) : undefined;
    if (row) return row;
  }

  const rows = await request(TABLE, { method: "POST", body: JSON.stringify(payload) });
  const row = Array.isArray(rows) ? (rows[0] as ProjectRecord | undefined) : undefined;
  if (!row) throw new Error("Supabase did not return the saved row.");
  return row;
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const rows = await request(
    `${TABLE}?id=eq.${encodeURIComponent(id)}&select=id,title,prompt,files,created_at,updated_at&limit=1`
  );
  return Array.isArray(rows) ? ((rows[0] as ProjectRecord | undefined) ?? null) : null;
}
