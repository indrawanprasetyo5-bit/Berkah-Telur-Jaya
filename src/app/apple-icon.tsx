import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
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
          backgroundColor: "#C2410C",
          borderRadius: 36,
        }}
      >
        <svg
          width="156"
          height="156"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M32 10C24 10 18.5 21.5 18.5 31C18.5 38.8 24.6 44.5 32 44.5C39.4 44.5 45.5 38.8 45.5 31C45.5 21.5 40 10 32 10Z"
            fill="#FBF8F1"
          />
          <circle cx="32" cy="30.5" r="6.5" fill="#F59E0B" />
          <path
            d="M11 37.5C11 36.12 12.12 35 13.5 35H20.8C23.2 39.6 27.3 42.5 32 42.5C36.7 42.5 40.8 39.6 43.2 35H50.5C51.88 35 53 36.12 53 37.5V49C53 51.21 51.21 53 49 53H15C12.79 53 11 51.21 11 49V37.5Z"
            fill="#F2ECE1"
            stroke="#1C1917"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M18 47H46"
            stroke="#C2410C"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
