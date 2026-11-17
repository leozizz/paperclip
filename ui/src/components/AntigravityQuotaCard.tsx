import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardSummary } from "@paperclipai/shared";
import { RefreshCw, Gauge, Coins } from "lucide-react";
import { dashboardApi } from "../api/dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCents, formatTokens } from "../lib/utils";
import { useState } from "react";

interface AntigravityQuotaCardProps {
  companyId: string;
  costs: DashboardSummary["costs"];
}

function formatResetCountdown(isoDate: string | null): string {
  if (!isoDate) return "";
  const target = new Date(isoDate).getTime();
  if (!Number.isFinite(target)) return "";
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "resetting soon";
  const totalMins = Math.round(diffMs / 60_000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `resets in ${days}d ${hours}h`;
  if (hours > 0) return `resets in ${hours}h ${mins}m`;
  return `resets in ${mins}m`;
}

function barColorClass(percent: number): string {
  if (percent >= 50) return "bg-emerald-500";
  if (percent >= 15) return "bg-amber-500";
  return "bg-red-500";
}

export function AntigravityQuotaCard({ companyId, costs }: AntigravityQuotaCardProps) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: usage, isLoading } = useQuery({
    queryKey: ["antigravity-usage", companyId],
    queryFn: () => dashboardApi.antigravityUsage(companyId),
    enabled: !!companyId,
    staleTime: 120_000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await dashboardApi.antigravityUsage(companyId, true);
      queryClient.setQueryData(["antigravity-usage", companyId], fresh);
    } finally {
      setRefreshing(false);
    }
  };

  const totalTokens = costs.monthTotalTokens ?? 0;
  const inputTokens = costs.monthInputTokens ?? 0;
  const cachedTokens = costs.monthCachedInputTokens ?? 0;
  const outputTokens = costs.monthOutputTokens ?? 0;
  const effectiveSpendCents =
    costs.monthSpendCents > 0
      ? costs.monthSpendCents
      : (costs.monthEstimatedSpendCents ?? 0);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Antigravity Quota & Token Balance</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            <span>
              Month: <strong className="text-foreground">{formatTokens(totalTokens)}</strong> tokens
              {" · "}
              <strong className="text-foreground">~{formatCents(effectiveSpendCents)}</strong> est.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            className="h-7 px-2 text-xs"
            data-testid="antigravity-usage-refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
        <div>
          <span className="text-muted-foreground">Uncached Input</span>
          <p className="font-mono font-medium">{formatTokens(inputTokens)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Cached Input</span>
          <p className="font-mono font-medium">{formatTokens(cachedTokens)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Output + Thinking</span>
          <p className="font-mono font-medium">{formatTokens(outputTokens)}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading Antigravity quota windows…</p>
      ) : usage?.ok && usage.groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {usage.groups.map((group) => (
            <div
              key={group.name}
              className="rounded-md border border-border/70 p-3 space-y-2.5"
            >
              <div>
                <p className="text-xs font-semibold">{group.name}</p>
                {group.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {group.description}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                {group.buckets.map((bucket) => (
                  <div key={bucket.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {bucket.window === "5h" ? "5h window" : bucket.window === "weekly" ? "Weekly" : bucket.name}
                      </span>
                      <span className="font-mono font-medium">
                        {bucket.remainingPercent}%{" "}
                        {bucket.resetTime && (
                          <span className="text-muted-foreground font-normal">
                            ({formatResetCountdown(bucket.resetTime)})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full transition-all", barColorClass(bucket.remainingPercent))}
                        style={{ width: `${Math.max(0, Math.min(100, bucket.remainingPercent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {usage?.error ?? "Antigravity CLI quota unavailable."}
        </p>
      )}
    </Card>
  );
}
