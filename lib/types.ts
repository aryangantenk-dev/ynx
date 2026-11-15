export type FileLanguage =
  | "tsx"
  | "ts"
  | "sql"
  | "prisma"
  | "json"
  | "css"
  | "html"
  | "md";

export interface ProjectFile {
  path: string;
  content: string;
  language: FileLanguage;
}

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "streaming" | "done" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  /** Number of project files touched by this turn (assistant messages only). */
  fileCount?: number;
  createdAt?: number;
}

export interface Checkpoint {
  id: string;
  label: string;
  timestamp: number;
  files: ProjectFile[];
}

export interface GenerationState {
  isGenerating: boolean;
  activeFile: string | null;
  error: string | null;
}

/** Minimal Supabase project shape shared by the API route and the client. */
export interface SupabaseProjectSummary {
  project_ref: string;
  name: string;
  region: string;
  status: string;
}
