# GameLens

Paste a chess PGN, a chess.com or Lichess game URL, or a FEN — GameLens walks you through every move with Stockfish 18 in your browser. Accuracy %, blunders, missed wins, brilliancies, best-move suggestions, opening recognition, an evaluation graph, and more.

## Features

- **Move-by-move review** — engine eval + classification (best · brilliant · great · excellent · good · book · inaccuracy · mistake · blunder · miss) for every ply.
- **Gemini "Why?" coach** — optional plain-English explanation of any move (bring your own key in Settings).
- **Endgame tablebase** — perfect-play guidance from Lichess Syzygy when ≤ 7 pieces are on the board.
- **Bulk import** — fetch the last 10 / 15 / 25 games from chess.com or Lichess and analyze them in the background.
- **Personal puzzle queue** — every blunder/mistake/miss you make becomes an SRS-scheduled puzzle in Marathon mode.
- **Insights** — accuracy over time, classification distribution, opening performance.
- **Local-first** — engine runs in a Web Worker, analyzed games cached in IndexedDB. Nothing leaves your machine unless you opt in to Gemini.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

**Note:** Stockfish WASM files (`public/stockfish/*.wasm`, ~108MB) are not included in the repo. Download from [official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish) or [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) and place in `public/stockfish/`.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind · Stockfish 18 (WASM) · chess.js · react-chessboard · recharts.
