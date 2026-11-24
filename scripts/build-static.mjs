// Static demo build for GitHub Pages: temporarily removes API routes (server-only) and exports to ./out
import { execSync } from "node:child_process";
import { existsSync, renameSync, writeFileSync } from "node:fs";

const api = "app/api", parked = ".api-parked";
if (existsSync(api)) renameSync(api, parked);
try {
  execSync("next build", {
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1", BASE_PATH: process.env.BASE_PATH ?? "/trendwatcher" },
  });
  writeFileSync("out/.nojekyll", "");
} finally {
  if (existsSync(parked)) renameSync(parked, api);
}
