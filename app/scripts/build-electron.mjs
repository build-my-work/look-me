import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.dirname(SCRIPT_DIR);

await build({
  entryPoints: [path.join(APP_ROOT, "electron", "main.mjs")],
  outfile: path.join(APP_ROOT, "electron", "main.bundle.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["electron"],
  minify: false,
  sourcemap: false,
  logLevel: "info",
});
