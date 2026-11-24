import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { BrandLogo } from "@/components/brand-logo";
import { IconCashier, IconReport, IconStock } from "@/components/icons";
import { LoginForm } from "./login-form";

const BRAND_HIGHLIGHTS = [
  {
    icon: IconCashier,
    title: "Kasir Cepat 1-2 Ketuk",
    desc: "Jual kiloan, nominal rupiah, atau telur retak tanpa salah pencet di layar HP.",
  },
  {
    icon: IconStock,
    title: "Stok Peti & 1-Klik WA Gudang",
    desc: "Pantau sisa stok per jenis telur dan pesan kiriman mobil otomatis via WhatsApp.",
  },
  {
    icon: IconReport,
    title: "Cocokkan Laci & Profit Bersih",
    desc: "Catat kas keluar operasional, hitung selisih uang fisik, dan lihat laba harian akurat.",
  },
] as const;

export default async function LoginPage() {
  const { profile } = await getCurrentSession();
  if (profile) {
    redirect("/");
  }

  const supabaseConfigured = isSupabaseConfigured();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl items-center px-4 py-6 sm:px-6 lg:py-10">
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch lg:gap-8">
        <section
          aria-label="Tentang Berkah Telur Jaya (BTJ)"
          className="flex flex-col justify-between rounded-2xl border-2 border-border-strong bg-tray p-5 sm:p-6 lg:col-span-6 lg:p-8"
        >
          <div>
            <div className="flex items-center gap-3.5">
              <BrandLogo size={48} className="shrink-0" />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">
                  Berkah Telur Jaya (BTJ)
                </h1>
                <p className="text-sm font-semibold text-ink-muted">
                  Operasional Penjualan &amp; Stok Telur
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm font-medium leading-relaxed text-ink lg:mt-6 lg:text-base">
              Dirancang khusus untuk operasional Toko / Agen Telur: kontras
              tinggi di kondisi terang, tombol lega untuk satu tangan, dan
              hitungan untung rugi yang rapi setiap hari.
            </p>

            <ul className="mt-6 hidden space-y-4 lg:block">
              {BRAND_HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.title}
                    className="flex items-start gap-3.5 rounded-xl border-2 border-border-subtle bg-surface p-3.5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-accent bg-accent-soft text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-extrabold text-ink">
                        {item.title}
                      </h2>
                      <p className="mt-0.5 text-xs font-medium leading-relaxed text-ink-muted">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-6 hidden border-t-2 border-border-strong pt-4 text-xs font-semibold text-ink-muted lg:block">
            Jl. Letnan Sukarna, Kp. Gedong, Ciampea, Bogor
          </p>
        </section>

        <section
          aria-label="Masuk aplikasi"
          className="flex flex-col justify-center lg:col-span-6"
        >
          <LoginForm supabaseConfigured={supabaseConfigured} />
        </section>
      </div>
    </main>
  );
}
