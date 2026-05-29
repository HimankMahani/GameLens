import { copyFileSync, mkdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "stockfish", "bin");
const dest = join(root, "public", "stockfish");
const maxVercelStaticAssetBytes = 100 * 1024 * 1024;

mkdirSync(dest, { recursive: true });

// Use the lite single-threaded build for Vercel. The full Stockfish 18 WASM is
// ~108MB, which is over Vercel's 100MB static file limit on Hobby and often
// times out while downloading/compiling in the browser worker.
const files = [
  ["stockfish-18-lite-single.js", "stockfish.js"],
  ["stockfish-18-lite-single.wasm", "stockfish.wasm"],
];

for (const [from, to] of files) {
  const sourcePath = join(src, from);
  const targetPath = join(dest, to);

  copyFileSync(sourcePath, targetPath);

  const size = statSync(targetPath).size;
  if (to.endsWith(".wasm") && size > maxVercelStaticAssetBytes) {
    throw new Error(
      `${to} is ${(size / 1024 / 1024).toFixed(1)}MB, which exceeds Vercel's 100MB static asset limit.`
    );
  }

  console.log(`Copied ${from} -> public/stockfish/${to} (${(size / 1024 / 1024).toFixed(1)}MB)`);
}
