import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Berkah Telur Jaya (BTJ) - Operasional Penjualan & Stok Telur",
    short_name: "BTJ Telur",
    description:
      "Sistem operasional kasir cepat, pemantauan stok peti, restock mobil, dan tutup kasir harian Toko / Agen Telur Berkah Telur Jaya (BTJ).",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF8F1",
    theme_color: "#C2410C",
    lang: "id",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
