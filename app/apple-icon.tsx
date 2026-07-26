import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          background: "#1c5e52",
          color: "#f9f7f2",
          fontSize: 92,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
        }}
      >
        D
      </div>
    ),
    size
  );
}
