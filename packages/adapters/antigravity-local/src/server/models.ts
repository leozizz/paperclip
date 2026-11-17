import type { AdapterModel } from "@paperclipai/adapter-utils";
import { asString, ensurePathInEnv, runChildProcess } from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_ANTIGRAVITY_LOCAL_MODEL, models as STATIC_MODELS } from "../index.js";

const MODELS_CACHE_TTL_MS = 60_000;
const MODELS_DISCOVERY_TIMEOUT_MS = 15_000;
const USAGE_CACHE_TTL_MS = 120_000;
const USAGE_TIMEOUT_MS = 15_000;

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

export interface AntigravityUsageSnapshot {
  ok: boolean;
  capturedAt: string;
  description?: string;
  groups: AntigravityQuotaGroup[];
  error?: string;
}

let cachedModels: { expiresAt: number; models: AdapterModel[] } | null = null;
let cachedUsage: { expiresAt: number; snapshot: AntigravityUsageSnapshot } | null = null;

function processEnvRecord(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function resolveAntigravityCommand(input?: unknown): string {
  const envCmd =
    typeof process.env.PAPERCLIP_ANTIGRAVITY_COMMAND === "string" &&
    process.env.PAPERCLIP_ANTIGRAVITY_COMMAND.trim().length > 0
      ? process.env.PAPERCLIP_ANTIGRAVITY_COMMAND.trim()
      : "agy";
  return asString(input, envCmd);
}

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: model.label.trim() || id });
  }
  return deduped;
}

export function parseAntigravityModelsOutput(stdout: string): AdapterModel[] {
  const parsed: AdapterModel[] = [];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.toLowerCase().startsWith("fetching ")) continue;
    const tabParts = line.split("\t");
    if (tabParts.length >= 2) {
      const id = tabParts[0]?.trim() ?? "";
      const label = tabParts.slice(1).join(" ").trim() || id;
      if (id && !/\s/.test(id)) {
        parsed.push({ id, label });
      }
      continue;
    }
    const wsMatch = line.match(/^([a-z0-9._:-]+)\s{2,}(.+)$/i);
    if (wsMatch) {
      parsed.push({ id: wsMatch[1].trim(), label: wsMatch[2].trim() });
    }
  }
  return dedupeModels(parsed);
}

export async function listAntigravityModels(options?: {
  forceRefresh?: boolean;
  command?: string;
}): Promise<AdapterModel[]> {
  const now = Date.now();
  if (!options?.forceRefresh && cachedModels && cachedModels.expiresAt > now) {
    return cachedModels.models;
  }

  const command = resolveAntigravityCommand(options?.command);
  const env = ensurePathInEnv(processEnvRecord()) as Record<string, string>;

  try {
    const res = await runChildProcess("antigravity-models", command, ["models"], {
      cwd: process.cwd(),
      env,
      timeoutSec: Math.ceil(MODELS_DISCOVERY_TIMEOUT_MS / 1000),
      graceSec: 3,
      onLog: async () => undefined,
    });

    if ((res.exitCode ?? 1) === 0 && !res.timedOut) {
      const discovered = parseAntigravityModelsOutput(res.stdout);
      if (discovered.length > 0) {
        const merged = dedupeModels([
          { id: DEFAULT_ANTIGRAVITY_LOCAL_MODEL, label: "Auto" },
          ...discovered,
          ...STATIC_MODELS,
        ]);
        cachedModels = { expiresAt: now + MODELS_CACHE_TTL_MS, models: merged };
        return merged;
      }
    }
  } catch {
    // Fall back to static models when agy CLI is unavailable
  }

  const fallback = dedupeModels(STATIC_MODELS);
  cachedModels = { expiresAt: now + MODELS_CACHE_TTL_MS, models: fallback };
  return fallback;
}

export function parseAntigravityUsageOutput(stdout: string): AntigravityUsageSnapshot {
  const capturedAt = new Date().toISOString();
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("}"));

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]) as Record<string, unknown>;
      const cmd = parsed.command as Record<string, unknown> | undefined;
      const data = cmd?.data as Record<string, unknown> | undefined;
      if (!data || !Array.isArray(data.groups)) continue;

      const groups: AntigravityQuotaGroup[] = data.groups.map((rawGroup) => {
        const group = rawGroup as Record<string, unknown>;
        const rawBuckets = Array.isArray(group.buckets) ? group.buckets : [];
        const buckets: AntigravityQuotaBucket[] = rawBuckets.map((rawBucket) => {
          const b = rawBucket as Record<string, unknown>;
          const frac = typeof b.remaining_fraction === "number" && Number.isFinite(b.remaining_fraction)
            ? Math.max(0, Math.min(1, b.remaining_fraction))
            : 0;
          return {
            id: typeof b.id === "string" ? b.id : "unknown",
            name: typeof b.name === "string" ? b.name : "Quota",
            ...(typeof b.description === "string" ? { description: b.description } : {}),
            window: typeof b.window === "string" ? b.window : "unknown",
            remainingFraction: frac,
            remainingPercent: Math.round(frac * 100),
            resetTime: typeof b.reset_time === "string" ? b.reset_time : null,
          };
        });
        return {
          name: typeof group.name === "string" ? group.name : "Models",
          ...(typeof group.description === "string" ? { description: group.description } : {}),
          buckets,
        };
      });

      return {
        ok: true,
        capturedAt,
        ...(typeof data.description === "string" ? { description: data.description } : {}),
        groups,
      };
    } catch {
      // Try earlier JSON line
    }
  }

  return {
    ok: false,
    capturedAt,
    groups: [],
    error: "Unable to parse Antigravity /usage output.",
  };
}

export async function fetchAntigravityUsage(options?: {
  forceRefresh?: boolean;
  command?: string;
}): Promise<AntigravityUsageSnapshot> {
  const now = Date.now();
  if (!options?.forceRefresh && cachedUsage && cachedUsage.expiresAt > now) {
    return cachedUsage.snapshot;
  }

  const command = resolveAntigravityCommand(options?.command);
  const env = ensurePathInEnv(processEnvRecord()) as Record<string, string>;

  try {
    const res = await runChildProcess(
      "antigravity-usage",
      command,
      ["--print", "/usage", "--output-format", "json"],
      {
        cwd: process.cwd(),
        env,
        timeoutSec: Math.ceil(USAGE_TIMEOUT_MS / 1000),
        graceSec: 3,
        onLog: async () => undefined,
      },
    );

    if ((res.exitCode ?? 1) === 0 && !res.timedOut) {
      const snapshot = parseAntigravityUsageOutput(res.stdout);
      if (snapshot.ok) {
        cachedUsage = { expiresAt: now + USAGE_CACHE_TTL_MS, snapshot };
        return snapshot;
      }
      return snapshot;
    }

    return {
      ok: false,
      capturedAt: new Date().toISOString(),
      groups: [],
      error: res.timedOut
        ? "Timed out querying Antigravity /usage."
        : (res.stderr.trim() || `agy /usage exited with code ${res.exitCode ?? "unknown"}`),
    };
  } catch (err) {
    return {
      ok: false,
      capturedAt: new Date().toISOString(),
      groups: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
