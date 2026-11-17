import { describe, expect, it } from "vitest";
import type { AdapterUsageCheckpoint } from "@paperclipai/adapter-utils";
import { estimateAntigravityCostCents, priceAntigravityReceipt } from "../services/antigravity-pricing.js";

function makeReceipt(overrides: Partial<AdapterUsageCheckpoint> = {}): AdapterUsageCheckpoint {
  return {
    complete: true,
    usageBasis: "per_run",
    provider: "google",
    biller: "google",
    billingType: "metered_api",
    model: "gemini-3.8-flash-medium",
    usage: {
      inputTokens: 100_000,
      cachedInputTokens: 1_000_000,
      outputTokens: 20_000,
    },
    ...overrides,
  };
}

describe("antigravity-pricing", () => {
  it("estimates token-equivalent spend for Gemini 3.8 Flash", () => {
    const cents = estimateAntigravityCostCents("gemini-3.8-flash-medium", {
      inputTokens: 1_000_000,
      cachedInputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    // 30 + 3 + 250 = 283 cents ($2.83)
    expect(cents).toBe(283);
  });

  it("prices unpriced Antigravity receipts with costStatus='estimated'", () => {
    const priced = priceAntigravityReceipt(makeReceipt({ model: "gemini-4-hydrogen-medium" }));
    expect(priced.costStatus).toBe("estimated");
    expect(priced.costUsdExact).toBeDefined();
    expect(Number(priced.costUsdExact)).toBeGreaterThan(0);
    expect(priced.pricingProvenance?.source).toBe("rate_card");
  });

  it("prices Gemini 4 Argon / Orchestrator higher than Flash", () => {
    const flash = estimateAntigravityCostCents("gemini-3.8-flash-medium", {
      inputTokens: 500_000,
      cachedInputTokens: 500_000,
      outputTokens: 100_000,
    });
    const argon = estimateAntigravityCostCents("gemini-4-argon-medium", {
      inputTokens: 500_000,
      cachedInputTokens: 500_000,
      outputTokens: 100_000,
    });
    expect(argon).toBeGreaterThan(flash);
  });

  it("does not overwrite receipts that already carry provider-reported cost", () => {
    const original = makeReceipt({ costUsd: 1.5 });
    const result = priceAntigravityReceipt(original);
    expect(result).toBe(original);
  });
});
