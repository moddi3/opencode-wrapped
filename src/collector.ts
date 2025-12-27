// Data collector - reads Pi/Codex/Claude/OpenCode session files

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { DataSource, SessionData, MessageData, ProjectData } from "./types";

const DATA_PATHS: Record<DataSource, string> = {
  pi: join(homedir(), ".pi/agent/sessions"),
  codex: join(homedir(), ".codex/sessions"),
  claude: join(homedir(), ".claude/projects"),
  opencode: join(homedir(), ".local/share/opencode/storage"),
};

export function getDataPath(source: DataSource): string {
  return DATA_PATHS[source];
}

export async function checkDataExists(source: DataSource): Promise<boolean> {
  try {
    await readdir(DATA_PATHS[source]);
    return true;
  } catch {
    return false;
  }
}

export async function getAvailableSources(): Promise<DataSource[]> {
  const sources: DataSource[] = [];
  for (const source of ["opencode", "claude", "codex", "pi"] as DataSource[]) {
    if (await checkDataExists(source)) {
      sources.push(source);
    }
  }
  return sources;
}

function parseTimestamp(ts: string | number): number {
  if (typeof ts === "number") return ts;
  return new Date(ts).getTime();
}

// ============ Pi format (JSONL with session + messages) ============

interface PiSessionLine {
  type: "session";
  id: string;
  timestamp: string | number;
  cwd: string;
  provider: string;
  modelId: string;
}

interface PiMessageLine {
  type: "message";
  timestamp: string | number;
  message: {
    role: "user" | "assistant" | "toolResult";
    provider?: string;
    model?: string;
    usage?: {
      input: number;
      output: number;
      cacheRead?: number;
      cacheWrite?: number;
      cost?: { total: number };
    };
  };
}

async function parsePiFile(
  filePath: string,
  year?: number
): Promise<{ session: SessionData | null; messages: MessageData[] }> {
  const messages: MessageData[] = [];
  let session: SessionData | null = null;

  try {
    const content = await Bun.file(filePath).text();
    const lines = content.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);

        if (parsed.type === "session") {
          const raw = parsed as PiSessionLine;
          const timestamp = parseTimestamp(raw.timestamp);

          if (year && new Date(timestamp).getFullYear() !== year) {
            return { session: null, messages: [] };
          }

          session = {
            id: raw.id,
            timestamp,
            cwd: raw.cwd,
            provider: raw.provider,
            modelId: raw.modelId,
            source: "pi",
          };
        } else if (parsed.type === "message") {
          const raw = parsed as PiMessageLine;
          const timestamp = parseTimestamp(raw.timestamp);

          if (year && new Date(timestamp).getFullYear() !== year) {
            continue;
          }

          messages.push({
            sessionId: session?.id ?? "",
            role: raw.message.role,
            timestamp,
            provider: raw.message.provider,
            modelId: raw.message.model,
            usage: raw.message.usage,
            source: "pi",
          });
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Skip unreadable files
  }

  return { session, messages };
}

// ============ Claude Code format (JSONL with type: user/assistant) ============

interface ClaudeLine {
  type: "user" | "assistant";
  sessionId: string;
  cwd: string;
  timestamp: string;
  message: {
    role: string;
    model?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  costUSD?: number;
}

async function parseClaudeFile(
  filePath: string,
  year?: number
): Promise<{ sessions: Map<string, SessionData>; messages: MessageData[] }> {
  const sessions = new Map<string, SessionData>();
  const messages: MessageData[] = [];

  try {
    const content = await Bun.file(filePath).text();
    const lines = content.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line) as ClaudeLine;
        if (!parsed.type || !parsed.sessionId) continue;

        const timestamp = parseTimestamp(parsed.timestamp);
        if (year && new Date(timestamp).getFullYear() !== year) continue;

        // Track session
        if (!sessions.has(parsed.sessionId)) {
          sessions.set(parsed.sessionId, {
            id: parsed.sessionId,
            timestamp,
            cwd: parsed.cwd,
            provider: "anthropic",
            modelId: parsed.message?.model || "claude",
            source: "claude",
          });
        }

        // Track message
        if (parsed.type === "user" || parsed.type === "assistant") {
          const usage = parsed.message?.usage;
          messages.push({
            sessionId: parsed.sessionId,
            role: parsed.type,
            timestamp,
            provider: "anthropic",
            modelId: parsed.message?.model,
            usage: usage
              ? {
                  input: usage.input_tokens || 0,
                  output: usage.output_tokens || 0,
                  cacheRead: usage.cache_read_input_tokens,
                  cacheWrite: usage.cache_creation_input_tokens,
                }
              : undefined,
            source: "claude",
          });
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Skip unreadable files
  }

  return { sessions, messages };
}

// ============ Codex CLI format (JSONL with session_meta, response_item, event_msg) ============

interface CodexSessionMeta {
  type: "session_meta";
  timestamp: string;
  payload: {
    id: string;
    cwd: string;
    model_provider: string;
  };
}

interface CodexResponseItem {
  type: "response_item";
  timestamp: string;
  payload: {
    role: "user" | "assistant";
  };
}

interface CodexTokenCount {
  type: "event_msg";
  timestamp: string;
  payload: {
    type: "token_count";
    info?: {
      last_token_usage?: {
        input_tokens: number;
        output_tokens: number;
        reasoning_output_tokens?: number;
      };
    };
  };
}

async function parseCodexFile(
  filePath: string,
  year?: number
): Promise<{ session: SessionData | null; messages: MessageData[] }> {
  let session: SessionData | null = null;
  const messages: MessageData[] = [];

  try {
    const content = await Bun.file(filePath).text();
    const lines = content.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);

        if (parsed.type === "session_meta") {
          const raw = parsed as CodexSessionMeta;
          const timestamp = parseTimestamp(raw.timestamp);

          if (year && new Date(timestamp).getFullYear() !== year) {
            return { session: null, messages: [] };
          }

          session = {
            id: raw.payload.id,
            timestamp,
            cwd: raw.payload.cwd,
            provider: raw.payload.model_provider || "openai",
            modelId: "codex",
            source: "codex",
          };
        } else if (parsed.type === "response_item") {
          const raw = parsed as CodexResponseItem;
          const timestamp = parseTimestamp(raw.timestamp);

          if (year && new Date(timestamp).getFullYear() !== year) continue;

          messages.push({
            sessionId: session?.id ?? "",
            role: raw.payload.role,
            timestamp,
            provider: session?.provider || "openai",
            modelId: "codex",
            source: "codex",
          });
        } else if (parsed.type === "event_msg" && parsed.payload?.type === "token_count") {
          const raw = parsed as CodexTokenCount;
          const usage = raw.payload.info?.last_token_usage;

          // Update the last assistant message with usage
          if (usage) {
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].role === "assistant" && !messages[i].usage) {
                messages[i].usage = {
                  input: usage.input_tokens || 0,
                  output: usage.output_tokens || 0,
                };
                break;
              }
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Skip unreadable files
  }

  return { session, messages };
}

// ============ OpenCode format (separate JSON files for sessions and messages) ============

interface OpenCodeSession {
  id: string;
  projectID: string;
  directory: string;
  time: { created: number; updated: number };
}

interface OpenCodeMessage {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  modelID?: string;
  providerID?: string;
  tokens?: {
    input: number;
    output: number;
    reasoning?: number;
    cache?: { read: number; write: number };
  };
  cost?: number;
  time: { created: number };
}

async function collectOpenCode(
  basePath: string,
  year?: number
): Promise<{
  sessions: SessionData[];
  messages: MessageData[];
  projects: ProjectData[];
}> {
  const sessions: SessionData[] = [];
  const allMessages: MessageData[] = [];
  const projectMap = new Map<string, number>();

  // Collect sessions
  const sessionsPath = join(basePath, "session");
  try {
    const projectDirs = await readdir(sessionsPath);
    await Promise.all(
      projectDirs.map(async (projectDir: string) => {
        const projectPath = join(sessionsPath, projectDir);
        try {
          const sessionFiles = await readdir(projectPath);
          await Promise.all(
            sessionFiles
              .filter((f: string) => f.endsWith(".json"))
              .map(async (sessionFile: string) => {
                try {
                  const raw = (await Bun.file(join(projectPath, sessionFile)).json()) as OpenCodeSession;
                  const timestamp = raw.time.created;

                  if (year && new Date(timestamp).getFullYear() !== year) return;

                  sessions.push({
                    id: raw.id,
                    timestamp,
                    cwd: raw.directory,
                    provider: "opencode",
                    modelId: "opencode",
                    source: "opencode",
                  });

                  projectMap.set(raw.directory, (projectMap.get(raw.directory) || 0) + 1);
                } catch {
                  // Skip invalid files
                }
              })
          );
        } catch {
          // Skip inaccessible directories
        }
      })
    );
  } catch {
    // Sessions directory doesn't exist
  }

  // Collect messages
  const messagesPath = join(basePath, "message");
  try {
    const sessionDirs = await readdir(messagesPath);
    await Promise.all(
      sessionDirs.map(async (sessionDir: string) => {
        const sessionPath = join(messagesPath, sessionDir);
        try {
          const messageFiles = await readdir(sessionPath);
          await Promise.all(
            messageFiles
              .filter((f: string) => f.endsWith(".json"))
              .map(async (messageFile: string) => {
                try {
                  const raw = (await Bun.file(join(sessionPath, messageFile)).json()) as OpenCodeMessage;
                  const timestamp = raw.time.created;

                  if (year && new Date(timestamp).getFullYear() !== year) return;

                  allMessages.push({
                    sessionId: raw.sessionID,
                    role: raw.role,
                    timestamp,
                    provider: raw.providerID,
                    modelId: raw.modelID,
                    usage: raw.tokens
                      ? {
                          input: raw.tokens.input || 0,
                          output: raw.tokens.output || 0,
                          cacheRead: raw.tokens.cache?.read,
                          cacheWrite: raw.tokens.cache?.write,
                        }
                      : undefined,
                    source: "opencode",
                  });
                } catch {
                  // Skip invalid files
                }
              })
          );
        } catch {
          // Skip inaccessible directories
        }
      })
    );
  } catch {
    // Messages directory doesn't exist
  }

  const projects: ProjectData[] = Array.from(projectMap.entries()).map(([path, sessionCount]) => ({
    path,
    sessionCount,
    source: "opencode",
  }));

  return { sessions, messages: allMessages, projects };
}

// ============ Main collection functions ============

async function findJsonlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string) {
    try {
      const entries = await readdir(currentDir);
      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            await walk(fullPath);
          } else if (entry.endsWith(".jsonl")) {
            files.push(fullPath);
          }
        } catch {
          // Skip inaccessible paths
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await walk(dir);
  return files;
}

export async function collectAll(
  source: DataSource,
  year?: number
): Promise<{
  sessions: SessionData[];
  messages: MessageData[];
  projects: ProjectData[];
}> {
  const basePath = DATA_PATHS[source];
  const sessions: SessionData[] = [];
  const allMessages: MessageData[] = [];
  const projectMap = new Map<string, number>();

  try {
    if (source === "opencode") {
      const result = await collectOpenCode(basePath, year);
      return result;
    }

    const jsonlFiles = await findJsonlFiles(basePath);

    if (source === "pi") {
      await Promise.all(
        jsonlFiles.map(async (filePath: string) => {
          const { session, messages } = await parsePiFile(filePath, year);

          if (session) {
            sessions.push(session);
            const projectPath = session.cwd;
            projectMap.set(projectPath, (projectMap.get(projectPath) || 0) + 1);
          }
          allMessages.push(...messages);
        })
      );
    } else if (source === "claude") {
      const allSessions = new Map<string, SessionData>();

      await Promise.all(
        jsonlFiles.map(async (filePath: string) => {
          const { sessions: fileSessions, messages } = await parseClaudeFile(filePath, year);

          for (const [id, session] of fileSessions) {
            if (!allSessions.has(id)) {
              allSessions.set(id, session);
              const projectPath = session.cwd;
              projectMap.set(projectPath, (projectMap.get(projectPath) || 0) + 1);
            }
          }
          allMessages.push(...messages);
        })
      );

      sessions.push(...allSessions.values());
    } else if (source === "codex") {
      await Promise.all(
        jsonlFiles.map(async (filePath: string) => {
          const { session, messages } = await parseCodexFile(filePath, year);

          if (session) {
            sessions.push(session);
            const projectPath = session.cwd;
            projectMap.set(projectPath, (projectMap.get(projectPath) || 0) + 1);
          }
          allMessages.push(...messages);
        })
      );
    }
  } catch {
    // Directory doesn't exist
  }

  const projects: ProjectData[] = Array.from(projectMap.entries()).map(([path, sessionCount]) => ({
    path,
    sessionCount,
    source,
  }));

  return { sessions, messages: allMessages, projects };
}
