import { describe, expect, it } from "vitest";
import { models as STATIC_MODELS } from "../index.js";
import { parseAntigravityModelsOutput, parseAntigravityUsageOutput } from "./models.js";

describe("antigravity-local models & usage parsers", () => {
  it("includes Gemini 4 Argon, Hydrogen and Orchestrator (Argon) in static fallback models", () => {
    const ids = new Set(STATIC_MODELS.map((m) => m.id));
    expect(ids.has("gemini-4-argon-medium")).toBe(true);
    expect(ids.has("gemini-4-hydrogen-medium")).toBe(true);
    expect(ids.has("gemini-4-hydrogen-xhigh")).toBe(true);
    expect(ids.has("gemini-pro-orchestrator-g1-pro")).toBe(true);
  });

  it("parses `agy models` tab-separated output and ignores status lines", () => {
    const stdout = [
      "Fetching available models...",
      "gemini-4-argon-medium\tGemini 4 Argon (Medium)",
      "gemini-4-hydrogen-medium\tGemini 4 Hydrogen (Medium)",
      "gemini-pro-orchestrator-g1-pro\tOrchestrator (Argon)",
      "gemini-4-hydrogen-medium\tGemini 4 Hydrogen (Medium)",
    ].join("\n");

    expect(parseAntigravityModelsOutput(stdout)).toEqual([
      { id: "gemini-4-argon-medium", label: "Gemini 4 Argon (Medium)" },
      { id: "gemini-4-hydrogen-medium", label: "Gemini 4 Hydrogen (Medium)" },
      { id: "gemini-pro-orchestrator-g1-pro", label: "Orchestrator (Argon)" },
    ]);
  });

  it("parses `agy --print /usage --output-format json` quota groups", () => {
    const stdout = JSON.stringify({
      status: "SUCCESS",
      command: {
        name: "usage",
        data: {
          description: "Quota description",
          groups: [
            {
              name: "Gemini Models",
              description: "Gemini 4 Hydrogen, Gemini 3.8 Flash",
              buckets: [
                {
                  id: "gemini-weekly",
                  name: "Weekly Limit Remaining",
                  window: "weekly",
                  remaining_fraction: 0.32,
                  reset_time: "2026-11-23T18:56:48Z",
                },
                {
                  id: "gemini-5h",
                  name: "Five Hour Limit Remaining",
                  window: "5h",
                  remaining_fraction: 0.94,
                  reset_time: "2026-11-17T18:22:34Z",
                },
              ],
            },
          ],
        },
      },
    });

    const parsed = parseAntigravityUsageOutput(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].buckets[0]).toMatchObject({
      id: "gemini-weekly",
      window: "weekly",
      remainingPercent: 32,
    });
    expect(parsed.groups[0].buckets[1]).toMatchObject({
      id: "gemini-5h",
      window: "5h",
      remainingPercent: 94,
    });
  });
});
