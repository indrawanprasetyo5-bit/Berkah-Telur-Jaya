import type { SVGProps } from "react";

interface BrandLogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function BrandLogo({ size = 40, className, ...props }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect width="64" height="64" rx="14" fill="#C2410C" />
      {/* telur */}
      <path
        d="M32 12C24.5 12 19.5 22.8 19.5 31.5C19.5 38.6 25.1 44 32 44C38.9 44 44.5 38.6 44.5 31.5C44.5 22.8 39.5 12 32 12Z"
        fill="#FBF8F1"
      />
      <circle cx="32" cy="31" r="6" fill="#F59E0B" />
      {/* tray */}
      <path
        d="M12 37.5C12 36.12 13.12 35 14.5 35H21.2C23.5 39.4 27.5 42.2 32 42.2C36.5 42.2 40.5 39.4 42.8 35H49.5C50.88 35 52 36.12 52 37.5V48C52 50.21 50.21 52 48 52H16C13.79 52 12 50.21 12 48V37.5Z"
        fill="#F2ECE1"
        stroke="#1C1917"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M18 46.5H46"
        stroke="#C2410C"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
