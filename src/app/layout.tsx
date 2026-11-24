import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Berkah Telur Jaya (BTJ) | Operasional Penjualan & Stok Telur",
  description:
    "Sistem operasional penjualan, kasir cepat, pemantauan stok peti, restock mobil, dan tutup kasir harian Toko / Agen Telur Berkah Telur Jaya (BTJ), Ciampea, Bogor.",
  applicationName: "Berkah Telur Jaya (BTJ)",
  appleWebApp: {
    capable: true,
    title: "BTJ Telur",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBF8F1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={plusJakartaSans.variable}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
