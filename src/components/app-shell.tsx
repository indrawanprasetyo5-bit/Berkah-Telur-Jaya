"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import type { Profile } from "@/types/database";
import { logoutUser } from "@/app/login/actions";
import { BrandLogo } from "./brand-logo";
import {
  IconCashier,
  IconDashboard,
  IconExpense,
  IconLogout,
  IconReport,
  IconStock,
} from "./icons";

interface AppShellProps {
  profile: Profile;
  isDemoLocal: boolean;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  ownerOnly?: boolean;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Kasir Cepat", shortLabel: "Kasir", icon: IconCashier },
  { href: "/stok", label: "Stok & Kirim", shortLabel: "Stok", icon: IconStock },
  {
    href: "/kas-keluar",
    label: "Kas Keluar",
    shortLabel: "Kas",
    icon: IconExpense,
  },
  {
    href: "/dashboard",
    label: "Dashboard Owner",
    shortLabel: "Omzet",
    ownerOnly: true,
    icon: IconDashboard,
  },
  {
    href: "/laporan",
    label: "Laporan & Tutup",
    shortLabel: "Laporan",
    icon: IconReport,
  },
];

export function AppShell({ profile, isDemoLocal, children }: AppShellProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.ownerOnly || profile.role === "owner"
  );

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutUser();
    });
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink md:flex">
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:border-2 focus:border-accent focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-ink"
      >
        Lewati ke konten utama
      </a>

      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:justify-between md:border-r-2 md:border-border-strong md:bg-tray md:p-4">
        <div>
          <div className="border-b-2 border-border-strong pb-4">
            <Link href="/" className="flex items-center gap-2.5">
              <BrandLogo size={36} className="shrink-0" />
              <span className="text-base font-extrabold leading-tight tracking-tight text-ink">
                Berkah Telur Jaya (BTJ)
              </span>
            </Link>
            <p className="mt-2 text-xs font-semibold text-ink-muted">
              {profile.full_name} ({profile.role === "owner" ? "Owner" : "Kasir / Staff"})
            </p>
          </div>

          <nav aria-label="Navigasi utama" className="mt-4 space-y-1.5">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-lg border-2 px-3.5 py-2.5 text-sm font-bold transition-colors duration-150 ${
                    active
                      ? "border-accent bg-accent text-ink-inverse"
                      : "border-transparent bg-transparent text-ink hover:border-border-strong hover:bg-surface"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t-2 border-border-strong pt-4">
          {isDemoLocal && (
            <p className="rounded-md border border-warn-border bg-warn-bg px-2.5 py-1.5 text-xs font-semibold text-warn">
              Mode Demo Lokal (tanpa DB)
            </p>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={handleLogout}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-border-strong bg-surface px-3 py-2 text-sm font-bold text-ink transition-colors duration-150 hover:border-ink hover:bg-canvas disabled:opacity-60"
          >
            <IconLogout className="h-4 w-4" />
            <span>{isPending ? "Keluar…" : "Keluar Akun"}</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b-2 border-border-strong bg-surface px-3.5 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandLogo size={32} className="shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-extrabold tracking-tight text-ink">
                  Berkah Telur Jaya (BTJ)
                </span>
                <span className="shrink-0 rounded-md border border-border-strong bg-tray px-1.5 py-0.5 text-[11px] font-bold text-ink">
                  {profile.role === "owner" ? "Owner" : "Staff"}
                </span>
              </div>
              <p className="truncate text-xs font-semibold text-ink-muted">
                {profile.full_name}
                {isDemoLocal ? " (Demo Lokal)" : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={handleLogout}
            aria-label="Keluar akun"
            className="flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-border-strong bg-tray px-3 text-xs font-bold text-ink active:scale-[0.98] disabled:opacity-60"
          >
            <IconLogout className="h-4 w-4" />
            <span>{isPending ? "Keluar…" : "Keluar"}</span>
          </button>
        </header>

        <main
          id="konten-utama"
          className="mx-auto w-full max-w-5xl flex-1 px-3.5 pt-4 pb-28 md:px-6 md:py-6"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Navigasi bawah"
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border-strong bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div
          className="mx-auto grid max-w-lg"
          style={{
            gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))`,
          }}
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-15 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-bold transition-colors duration-150 ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-ink-muted hover:bg-tray hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
