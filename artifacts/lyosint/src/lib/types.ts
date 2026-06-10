export interface SearchProgress {
  phase: string;
  phaseIndex: number;
  totalPhases: number;
  percentage: number;
  platformsChecked: number;
  platformsTotal: number;
}

export interface SearchStatusResponse {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  type: string;
  query: string;
  progress: SearchProgress | null;
  timingMs: Record<string, number | null> | null;
  platformsSearched: number | null;
  platformsTotal: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PlatformTiming {
  platformName: string;
  responseTimeMs: number;
  status: string;
}
