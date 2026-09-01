import { ImageResponse } from "next/og"

// Next.js wires this up as the og:image (and twitter:image, absent a separate file) for routes that don't define their own.
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
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
          backgroundColor: "#fafaf9",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 120, color: "#1c1b1a", lineHeight: 1 }}>∑</div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#1c1b1a", marginTop: 16 }}>
          Mathboard
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#6b6862", marginTop: 20 }}>
          Write math like it&apos;s a document
        </div>
      </div>
    ),
    { ...size }
  )
}
