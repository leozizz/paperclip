import fs from "node:fs";
fs.mkdirSync("dist/server", { recursive: true });
if (fs.existsSync("src/server/grok-auth-merge-decision.cjs")) {
  fs.copyFileSync("src/server/grok-auth-merge-decision.cjs", "dist/server/grok-auth-merge-decision.cjs");
}
