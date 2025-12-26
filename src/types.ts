// Types for CLI Wrapped

export type DataSource = "opencode" | "claude" | "codex" | "pi";

export interface SessionData {
  id: string;
  timestamp: number; // epoch ms
  cwd: string;
  provider: string;
  modelId: string;
  source: DataSource;
}

export interface MessageData {
  sessionId: string;
  role: "user" | "assistant" | "toolResult";
  timestamp: number;
  provider?: string;
  modelId?: string;
  usage?: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
    cost?: {
      total: number;
    };
  };
  source: DataSource;
}

export interface ProjectData {
  path: string;
  sessionCount: number;
  source: DataSource;
}

export interface ModelStats {
  id: string;
  name: string;
  providerId: string;
  count: number;
  percentage: number;
}

export interface ProviderStats {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export interface WrappedStats {
  year: number;
  source: DataSource;

  // Time-based
  firstSessionDate: Date;
  daysSinceFirstSession: number;

  // Counts
  totalSessions: number;
  totalMessages: number;
  totalProjects: number;

  // Tokens
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;

  // Cost
  totalCost: number;

  // Models (sorted by usage)
  topModels: ModelStats[];

  // Providers (sorted by usage)
  topProviders: ProviderStats[];

  // Streak
  maxStreak: number;
  currentStreak: number;
  maxStreakDays: Set<string>;

  // Activity heatmap (for the year)
  dailyActivity: Map<string, number>;

  // Most active day
  mostActiveDay: {
    date: string;
    count: number;
    formattedDate: string;
  } | null;

  // Weekday activity distribution (0=Sunday, 6=Saturday)
  weekdayActivity: WeekdayActivity;
}

// Keep OpenCodeStats as alias for compatibility
export type OpenCodeStats = WrappedStats;

export interface WeekdayActivity {
  counts: [number, number, number, number, number, number, number];
  mostActiveDay: number;
  mostActiveDayName: string;
  maxCount: number;
}

export interface CliArgs {
  year?: number;
  source?: DataSource;
  help?: boolean;
}
