import { copyFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "stockfish", "bin");
const dest = join(root, "public", "stockfish");

mkdirSync(dest, { recursive: true });

const files = [
  ["stockfish.js", "stockfish.js"],
  ["stockfish-18.wasm", "stockfish.wasm"],
];

for (const [from, to] of files) {
  copyFileSync(join(src, from), join(dest, to));
  console.log(`Copied ${from} → public/stockfish/${to}`);
}
