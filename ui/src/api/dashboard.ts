import type { AntigravityUsageResponse, DashboardSummary } from "@paperclipai/shared";
import { api } from "./client";

export const dashboardApi = {
  summary: (companyId: string) => api.get<DashboardSummary>(`/companies/${companyId}/dashboard`),
  antigravityUsage: (companyId: string, refresh = false) =>
    api.get<AntigravityUsageResponse>(
      `/companies/${companyId}/antigravity/usage${refresh ? "?refresh=1" : ""}`,
    ),
};
