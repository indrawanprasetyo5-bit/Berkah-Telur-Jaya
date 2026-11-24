import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  buildDemoExpenses,
  buildDemoSalesHistory,
  buildDemoStockLosses,
  DEMO_EGG_TYPES,
  type DailyChartPoint,
} from "@/lib/demo-data";
import {
  getJakartaDateKey,
  getJakartaDaysAgoStartIso,
} from "@/lib/format";
import {
  OwnerDashboard,
  type TodaySummaryMetrics,
} from "@/components/owner-dashboard";
import type { EggType } from "@/types/database";

function buildSevenDayKeys(): string[] {
  const keys: string[] = [];
  const now = Date.now();
  for (let i = 6; i >= 0; i -= 1) {
    keys.push(getJakartaDateKey(new Date(now - i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

export default async function DashboardPage() {
  const { profile, isDemoLocal } = await getCurrentSession();
  const isOwner = profile?.role === "owner";

  if (!isOwner) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border-2 border-border-strong bg-surface p-5">
        <h1 className="text-xl font-extrabold text-ink">Dashboard Owner</h1>
        <p className="mt-2 text-sm font-semibold text-danger">
          Halaman ini khusus akun Owner. Akun Kasir / Staff dapat menggunakan
          Kasir, Stok, Kas Keluar, dan Laporan Tutup Kasir.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-accent bg-accent px-5 text-sm font-bold text-ink-inverse hover:bg-accent-hover"
        >
          Kembali ke Kasir Cepat
        </Link>
      </section>
    );
  }

  const dayKeys = buildSevenDayKeys();
  const todayKey = dayKeys[dayKeys.length - 1];
  const dayBuckets = new Map<
    string,
    {
      revenue: number;
      cost: number;
      expenses: number;
      losses: number;
      kgSold: number;
      txCount: number;
    }
  >();

  for (const key of dayKeys) {
    dayBuckets.set(key, {
      revenue: 0,
      cost: 0,
      expenses: 0,
      losses: 0,
      kgSold: 0,
      txCount: 0,
    });
  }

  let eggs: EggType[] = DEMO_EGG_TYPES;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const sevenDaysStartIso = getJakartaDaysAgoStartIso(6);

    const [eggsRes, salesRes, expensesRes, lossesRes] = await Promise.all([
      supabase
        .from("egg_types")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("sales")
        .select("id, total_amount, total_cost, created_at, sale_items(qty_kg)")
        .gte("created_at", sevenDaysStartIso)
        .order("created_at", { ascending: false }),
      supabase
        .from("expenses")
        .select("amount, created_at")
        .gte("created_at", sevenDaysStartIso),
      supabase
        .from("stock_losses")
        .select("cost_loss, created_at")
        .gte("created_at", sevenDaysStartIso),
    ]);

    eggs = (eggsRes.data as EggType[] | null) ?? [];

    const salesRows =
      (salesRes.data as
        | {
            id: string;
            total_amount: number;
            total_cost: number;
            created_at: string;
            sale_items: { qty_kg: number }[] | null;
          }[]
        | null) ?? [];

    for (const sale of salesRows) {
      const bucket = dayBuckets.get(getJakartaDateKey(sale.created_at));
      if (!bucket) continue;
      bucket.revenue += Number(sale.total_amount);
      bucket.cost += Number(sale.total_cost);
      bucket.txCount += 1;
      if (Array.isArray(sale.sale_items)) {
        for (const item of sale.sale_items) {
          bucket.kgSold += Number(item.qty_kg);
        }
      }
    }

    const expenseRows =
      (expensesRes.data as { amount: number; created_at: string }[] | null) ??
      [];
    for (const exp of expenseRows) {
      const bucket = dayBuckets.get(getJakartaDateKey(exp.created_at));
      if (bucket) bucket.expenses += Number(exp.amount);
    }

    const lossRows =
      (lossesRes.data as { cost_loss: number; created_at: string }[] | null) ??
      [];
    for (const loss of lossRows) {
      const bucket = dayBuckets.get(getJakartaDateKey(loss.created_at));
      if (bucket) bucket.losses += Number(loss.cost_loss);
    }
  } else {
    const demoSales = buildDemoSalesHistory();
    for (const sale of demoSales) {
      const bucket = dayBuckets.get(getJakartaDateKey(sale.created_at));
      if (!bucket) continue;
      bucket.revenue += sale.total_amount;
      bucket.cost += sale.total_cost;
      bucket.txCount += 1;
      for (const item of sale.items) {
        bucket.kgSold += item.qty_kg;
      }
    }
    for (const exp of buildDemoExpenses()) {
      const bucket = dayBuckets.get(getJakartaDateKey(exp.created_at));
      if (bucket) bucket.expenses += exp.amount;
    }
    for (const loss of buildDemoStockLosses()) {
      const bucket = dayBuckets.get(getJakartaDateKey(loss.created_at));
      if (bucket) bucket.losses += loss.cost_loss;
    }
  }

  const chartSeries: DailyChartPoint[] = dayKeys.map((dateKey) => {
    const b = dayBuckets.get(dateKey)!;
    const netProfit = Math.round(b.revenue - b.cost - b.expenses - b.losses);
    return {
      dateKey,
      revenue: Math.round(b.revenue),
      profit: netProfit,
      kgSold: Number(b.kgSold.toFixed(2)),
    };
  });

  const todayBucket = dayBuckets.get(todayKey)!;
  const todaySummary: TodaySummaryMetrics = {
    revenue: Math.round(todayBucket.revenue),
    kgSold: Number(todayBucket.kgSold.toFixed(2)),
    expenses: Math.round(todayBucket.expenses),
    losses: Math.round(todayBucket.losses),
    netProfit: Math.round(
      todayBucket.revenue -
        todayBucket.cost -
        todayBucket.expenses -
        todayBucket.losses
    ),
    txCount: todayBucket.txCount,
  };

  return (
    <OwnerDashboard
      initialEggs={eggs}
      todaySummary={todaySummary}
      chartSeries={chartSeries}
      isDemoLocal={isDemoLocal}
    />
  );
}
