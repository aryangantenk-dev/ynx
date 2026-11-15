import { NextResponse } from "next/server";
import { listProjects, saveProject, supabaseConfig } from "@/lib/supabase";
import type { ProjectFile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 120;
const MAX_TOTAL_CHARS = 400_000;

function validFiles(input: unknown): ProjectFile[] | null {
  if (!Array.isArray(input)) return null;
  const files = input.filter(
    (f): f is ProjectFile =>
      !!f &&
      typeof f === "object" &&
      typeof (f as ProjectFile).path === "string" &&
      typeof (f as ProjectFile).content === "string"
  );
  if (files.length === 0 || files.length > MAX_FILES) return null;
  const total = files.reduce((sum, f) => sum + f.content.length, 0);
  if (total > MAX_TOTAL_CHARS) return null;
  return files;
}

export async function GET() {
  const { configured } = supabaseConfig();
  if (!configured) {
    return NextResponse.json({ configured: false, projects: [] });
  }
  try {
    const projects = await listProjects(20);
    return NextResponse.json({ configured: true, projects });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        projects: [],
        error: error instanceof Error ? error.message : "Could not read projects.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const { configured } = supabaseConfig();
  if (!configured) {
    return NextResponse.json(
      { configured: false, error: "Supabase is not configured on this deployment." },
      { status: 501 }
    );
  }

  let body: { id?: unknown; title?: unknown; prompt?: unknown; files?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const files = validFiles(body.files);
  if (!files) {
    return NextResponse.json(
      { error: "A project needs between 1 and 120 files, under 400k characters." },
      { status: 422 }
    );
  }

  try {
    const record = await saveProject({
      id: typeof body.id === "string" && body.id ? body.id : undefined,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled project",
      prompt: typeof body.prompt === "string" ? body.prompt : "",
      files,
    });
    return NextResponse.json({ configured: true, project: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the project." },
      { status: 502 }
    );
  }
}
