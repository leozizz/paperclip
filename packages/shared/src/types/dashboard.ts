export interface DashboardRunActivityDay {
  date: string;
  succeeded: number;
  /**
   * True failures for the day, excluding process-loss/restart kills that were
   * later recovered by a successful retry (those are surfaced in `recovered`).
   */
  failed: number;
  /**
   * Runs that terminated in a failure state (failed/timed_out) but whose retry
   * chain eventually succeeded — e.g. restart-killed runs that recovered. Kept
   * out of `failed` so the headline failure count reflects true, unrecovered
   * failures.
   */
  recovered: number;
  other: number;
  total: number;
  /**
   * Per-error-code breakdown of the (true) `failed` count for the day, so a
   * spike can be attributed to an error class (e.g. `process_lost`,
   * `provider_quota`, `workspace_validation_failed`). Recovered runs are not
   * included here. Runs with no error code are bucketed under `unknown`.
   */
  failedByErrorCode: Record<string, number>;
}

export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
    monthInputTokens?: number;
    monthCachedInputTokens?: number;
    monthOutputTokens?: number;
    monthTotalTokens?: number;
    monthEstimatedSpendCents?: number;
    unpricedEventCount?: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
  runActivity: DashboardRunActivityDay[];
}

export interface AntigravityQuotaBucket {
  id: string;
  name: string;
  description?: string;
  window: string;
  remainingFraction: number;
  remainingPercent: number;
  resetTime: string | null;
}

export interface AntigravityQuotaGroup {
  name: string;
  description?: string;
  buckets: AntigravityQuotaBucket[];
}

export interface AntigravityUsageResponse {
  ok: boolean;
  capturedAt: string;
  description?: string;
  groups: AntigravityQuotaGroup[];
  error?: string;
}
