import fs from "node:fs";
fs.mkdirSync("dist/server", { recursive: true });
for (const f of ["codex-auth-merge-decision.cjs", "codex-auth-merge-extract.sh"]) {
  if (fs.existsSync("src/server/" + f)) {
    fs.copyFileSync("src/server/" + f, "dist/server/" + f);
  }
}
