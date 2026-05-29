import { copyFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "stockfish", "bin");
const dest = join(root, "public", "stockfish");

mkdirSync(dest, { recursive: true });

// Use the -single variant: same engine, single-threaded.
// The multi-threaded build needs a stockfish.worker.js companion + cross-origin
// isolation that's fragile on Vercel. Speed difference is negligible at our depths.
const files = [
  ["stockfish-18-single.js", "stockfish.js"],
  ["stockfish-18-single.wasm", "stockfish.wasm"],
];

for (const [from, to] of files) {
  copyFileSync(join(src, from), join(dest, to));
  console.log(`Copied ${from} → public/stockfish/${to}`);
}
