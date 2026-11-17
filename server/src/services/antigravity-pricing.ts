import { centsToUsd, unitsToCents, usdToUnits } from "@paperclipai/shared";
import type { AdapterUsageCheckpoint } from "@paperclipai/adapter-utils";

interface ModelRateCard {
  /** USD per 1M uncached input tokens */
  inputUsdPerMillion: string;
  /** USD per 1M cached input tokens */
  cachedInputUsdPerMillion: string;
  /** USD per 1M output (including thinking) tokens */
  outputUsdPerMillion: string;
  /** Cents per 1M tokens for provenance display */
  inputCentsPerMillion: string;
  cachedInputCentsPerMillion: string;
  outputCentsPerMillion: string;
}

const RATE_CARDS: Array<{ match: (model: string) => boolean; rates: ModelRateCard }> = [
  {
    match: (m) => m.includes("claude-opus") || m.includes("opus"),
    rates: {
      inputUsdPerMillion: "5",
      cachedInputUsdPerMillion: "0.5",
      outputUsdPerMillion: "25",
      inputCentsPerMillion: "500",
      cachedInputCentsPerMillion: "50",
      outputCentsPerMillion: "2500",
    },
  },
  {
    match: (m) => m.includes("claude-sonnet") || m.includes("sonnet"),
    rates: {
      inputUsdPerMillion: "2",
      cachedInputUsdPerMillion: "0.2",
      outputUsdPerMillion: "10",
      inputCentsPerMillion: "200",
      cachedInputCentsPerMillion: "20",
      outputCentsPerMillion: "1000",
    },
  },
  {
    match: (m) => m.includes("argon") || m.includes("orchestrator"),
    rates: {
      inputUsdPerMillion: "2.5",
      cachedInputUsdPerMillion: "0.25",
      outputUsdPerMillion: "15",
      inputCentsPerMillion: "250",
      cachedInputCentsPerMillion: "25",
      outputCentsPerMillion: "1500",
    },
  },
  {
    match: (m) => m.includes("hydrogen") || m.includes("3.1-pro") || m.includes("3.1 pro"),
    rates: {
      inputUsdPerMillion: "1.25",
      cachedInputUsdPerMillion: "0.125",
      outputUsdPerMillion: "10",
      inputCentsPerMillion: "125",
      cachedInputCentsPerMillion: "12.5",
      outputCentsPerMillion: "1000",
    },
  },
  {
    match: (m) => m.includes("gpt-oss"),
    rates: {
      inputUsdPerMillion: "0.5",
      cachedInputUsdPerMillion: "0.05",
      outputUsdPerMillion: "2",
      inputCentsPerMillion: "50",
      cachedInputCentsPerMillion: "5",
      outputCentsPerMillion: "200",
    },
  },
  {
    // Gemini 3.8 Flash / 3.5 Flash / auto default
    match: () => true,
    rates: {
      inputUsdPerMillion: "0.3",
      cachedInputUsdPerMillion: "0.03",
      outputUsdPerMillion: "2.5",
      inputCentsPerMillion: "30",
      cachedInputCentsPerMillion: "3",
      outputCentsPerMillion: "250",
    },
  },
];

export function resolveAntigravityRateCard(model: string | null | undefined): ModelRateCard {
  const normalized = (model ?? "auto").toLowerCase();
  return (RATE_CARDS.find((entry) => entry.match(normalized)) ?? RATE_CARDS[RATE_CARDS.length - 1]).rates;
}

export function estimateAntigravityCostUnits(
  model: string | null | undefined,
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number },
): bigint {
  const rates = resolveAntigravityRateCard(model);
  const input = Math.max(0, Math.trunc(usage.inputTokens));
  const cached = Math.max(0, Math.trunc(usage.cachedInputTokens));
  const output = Math.max(0, Math.trunc(usage.outputTokens));

  const numerator =
    BigInt(input) * usdToUnits(rates.inputUsdPerMillion) +
    BigInt(cached) * usdToUnits(rates.cachedInputUsdPerMillion) +
    BigInt(output) * usdToUnits(rates.outputUsdPerMillion);

  return (numerator + 500_000n) / 1_000_000n;
}

export function estimateAntigravityCostCents(
  model: string | null | undefined,
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number },
): number {
  return Number(unitsToCents(estimateAntigravityCostUnits(model, usage)));
}

/**
 * Estimates USD-equivalent spend for Antigravity CLI runs based on observed
 * token counts and model family rate cards. Keeps `costStatus: "estimated"`
 * so budgets and dashboard totals reflect actual token consumption.
 */
export function priceAntigravityReceipt(receipt: AdapterUsageCheckpoint): AdapterUsageCheckpoint {
  if (
    !receipt.complete ||
    !receipt.usage ||
    receipt.provider !== "google" ||
    !["google", "antigravity"].includes(receipt.biller ?? "") ||
    receipt.billingType === "subscription_included" ||
    receipt.usageByModel?.length ||
    receipt.costUsd != null ||
    receipt.costUsdExact != null ||
    receipt.cacheAdjustedCostUsd != null
  ) {
    return receipt;
  }

  const inputTokens = receipt.usage.inputTokens ?? 0;
  const cachedInputTokens = receipt.usage.cachedInputTokens ?? 0;
  const outputTokens = receipt.usage.outputTokens ?? 0;
  if (inputTokens <= 0 && cachedInputTokens <= 0 && outputTokens <= 0) {
    return receipt;
  }

  const rates = resolveAntigravityRateCard(receipt.model);
  const cents = unitsToCents(
    estimateAntigravityCostUnits(receipt.model, {
      inputTokens,
      cachedInputTokens,
      outputTokens,
    }),
  );

  return {
    ...receipt,
    billingType: "metered_api",
    costUsdExact: centsToUsd(cents),
    costStatus: "estimated",
    pricingProvenance: {
      source: "rate_card",
      version: "antigravity-estimated-2026-11",
      evidence: `Estimated token-equivalent spend for Antigravity model "${receipt.model ?? "auto"}"; quota-backed CLI run, not a direct invoice`,
      inputCentsPerMillion: rates.inputCentsPerMillion,
      cachedInputCentsPerMillion: rates.cachedInputCentsPerMillion,
      outputCentsPerMillion: rates.outputCentsPerMillion,
    },
  };
}
