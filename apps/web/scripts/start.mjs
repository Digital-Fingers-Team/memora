import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const port = process.env.WEB_PORT || process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || process.env.HOST || "0.0.0.0";

const result = spawnSync(process.execPath, [nextBin, "start", "-p", port, "-H", hostname], {
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
