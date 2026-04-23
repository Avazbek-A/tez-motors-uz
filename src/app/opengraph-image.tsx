import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tez Motors — Import cars from China to Uzbekistan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0a0a0f 0%, #101024 50%, #1a0f2e 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 128,
            fontWeight: 900,
            letterSpacing: -4,
            background: "linear-gradient(90deg, #00d4ff, #8b5cf6)",
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
          }}
        >
          Tez Motors
        </div>
        <div
          style={{
            fontSize: 40,
            marginTop: 24,
            opacity: 0.75,
            textAlign: "center",
            display: "flex",
            maxWidth: 1000,
          }}
        >
          Import cars from China to Uzbekistan
        </div>
        <div
          style={{
            fontSize: 28,
            marginTop: 40,
            opacity: 0.5,
            display: "flex",
          }}
        >
          tezmotors.uz
        </div>
      </div>
    ),
    size,
  );
}
