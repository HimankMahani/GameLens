import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, transparent 50%, rgba(6,182,212,0.12) 100%)",
            display: "flex",
          }}
        />

        {/* Chess board pattern (decorative) */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 320,
            height: 320,
            opacity: 0.06,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {Array.from({ length: 64 }).map((_, i) => {
            const row = Math.floor(i / 8);
            const col = i % 8;
            return (
              <div
                key={i}
                style={{
                  width: 40,
                  height: 40,
                  background:
                    (row + col) % 2 === 0 ? "#ffffff" : "transparent",
                  display: "flex",
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            zIndex: 1,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Powered by Stockfish 18
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              background: "linear-gradient(90deg, #10b981, #06b6d4)",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-2px",
              display: "flex",
            }}
          >
            GameLens
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 26,
              color: "rgba(244,244,245,0.65)",
              textAlign: "center",
              maxWidth: 700,
              lineHeight: 1.4,
              display: "flex",
            }}
          >
            Free chess game analysis — accuracy %, blunders,
            best moves. Runs in your browser.
          </div>

          {/* Feature pills */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 8,
            }}
          >
            {["PGN analysis", "Blunder puzzles", "chess.com & Lichess", "No signup"].map(
              (f) => (
                <div
                  key={f}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.25)",
                    color: "#a7f3d0",
                    fontSize: 16,
                    display: "flex",
                  }}
                >
                  {f}
                </div>
              )
            )}
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            color: "rgba(255,255,255,0.25)",
            fontSize: 18,
            display: "flex",
          }}
        >
          gamelens.himank.dev
        </div>
      </div>
    ),
    { ...size }
  );
}
