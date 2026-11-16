import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1B3832",
          borderRadius: "44px",
          border: "8px solid #B08A3E",
          color: "#EEEADF",
          fontSize: "110px",
          fontFamily: "serif",
          fontWeight: "bold",
        }}
      >
        C
      </div>
    ),
    { ...size }
  );
}
