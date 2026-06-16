import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tez Motors — Import cars from China to Uzbekistan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Platinum monochrome brand identity (matches the Vanguard logo + site theme).
const PLATINUM = "linear-gradient(135deg, #eff3f7 0%, #bfc9d6 42%, #8995a6 72%, #dae0e7 100%)";

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
          background: "linear-gradient(135deg, #08090b 0%, #101216 55%, #07080a 100%)",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        {/* Chevron mark */}
        <div
          style={{
            display: "flex",
            fontSize: 150,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: 8,
            background: PLATINUM,
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          »
        </div>
        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            marginTop: 8,
            fontSize: 104,
            fontWeight: 800,
            letterSpacing: 8,
            color: "#f6f5f2",
          }}
        >
          TEZ MOTORS
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 38,
            marginTop: 28,
            opacity: 0.6,
            textAlign: "center",
            maxWidth: 1000,
            color: "#dce0e6",
          }}
        >
          Импорт авто из Китая в Узбекистан
        </div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 36, opacity: 0.4, color: "#aab3bf" }}>
          tezmotors.uz
        </div>
      </div>
    ),
    size,
  );
}
