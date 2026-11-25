import type { ImgHTMLAttributes } from "react";

interface BrandLogoProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> {
  size?: number;
}

export function BrandLogo({
  size = 40,
  className = "",
  alt = "Berkah Telur Jaya",
  ...props
}: BrandLogoProps) {
  return (
    <img
      src="/logo-btj.jpg"
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`rounded-full object-cover ${className}`.trim()}
      {...props}
    />
  );
}
