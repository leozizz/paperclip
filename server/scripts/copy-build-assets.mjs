import fs from "node:fs";
import path from "node:path";

const serverDir = path.resolve(".");
const distDir = path.join(serverDir, "dist");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

copyDir(path.join(serverDir, "src/onboarding-assets"), path.join(distDir, "onboarding-assets"));
copyDir(path.join(serverDir, "src/built-ins"), path.join(distDir, "built-ins"));
copyDir(path.join(serverDir, "src/services/scripts"), path.join(distDir, "services/scripts"));

const runnerDist = path.resolve(serverDir, "../packages/paperclip-runner/dist");
if (fs.existsSync(runnerDist)) {
  copyDir(runnerDist, path.join(distDir, "vendor/paperclip-runner"));
}
