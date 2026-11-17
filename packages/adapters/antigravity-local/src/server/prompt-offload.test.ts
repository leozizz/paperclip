import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareAntigravityCliPrompt } from "./execute.js";

describe("prepareAntigravityCliPrompt", () => {
  it("keeps short prompts inline without creating temp files", async () => {
    const prompt = "Short task prompt";
    const result = await prepareAntigravityCliPrompt(prompt, 100);
    expect(result.cliPrompt).toBe(prompt);
    expect(result.tempPromptDir).toBeNull();
    expect(result.offloadedFile).toBeNull();
  });

  it("offloads oversized prompts to a temp UTF-8 markdown file to prevent Windows ENAMETOOLONG", async () => {
    const longPrompt = "A".repeat(12_000);
    const result = await prepareAntigravityCliPrompt(longPrompt, 6_000);
    try {
      expect(result.offloadedFile).not.toBeNull();
      expect(result.tempPromptDir).not.toBeNull();
      expect(result.cliPrompt.length).toBeLessThan(400);
      expect(result.cliPrompt).toContain(result.offloadedFile!);
      const persisted = await fs.readFile(result.offloadedFile!, "utf8");
      expect(persisted).toBe(longPrompt);
    } finally {
      if (result.tempPromptDir) {
        await fs.rm(path.resolve(result.tempPromptDir), { recursive: true, force: true });
      }
    }
  });
});
