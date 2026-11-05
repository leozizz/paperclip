import fs from "node:fs";
import path from "node:path";

const distMigrations = path.resolve("dist/migrations");
const distMeta = path.join(distMigrations, "meta");
const srcMigrations = path.resolve("src/migrations");
const srcMeta = path.join(srcMigrations, "meta");

fs.rmSync(distMigrations, { recursive: true, force: true });
fs.mkdirSync(distMeta, { recursive: true });

if (fs.existsSync(srcMigrations)) {
  for (const file of fs.readdirSync(srcMigrations)) {
    if (file.endsWith(".sql")) {
      fs.copyFileSync(path.join(srcMigrations, file), path.join(distMigrations, file));
    }
  }
}

const journalSrc = path.join(srcMeta, "_journal.json");
if (fs.existsSync(journalSrc)) {
  fs.copyFileSync(journalSrc, path.join(distMeta, "_journal.json"));
}
