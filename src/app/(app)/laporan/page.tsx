import { getCurrentSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  buildDemoExpenses,
  buildDemoSalesHistory,
  buildDemoStockLosses,
  type SaleHistoryItem,
  type SaleWithItems,
} from "@/lib/demo-data";
import {
  getJakartaDateKey,
  getJakartaDaysAgoStartIso,
  getJakartaStartOfTodayIso,
} from "@/lib/format";
import {
  ReportManager,
  type TodayClosingContext,
} from "@/components/report-manager";
import type { DailyClosing, PaymentMethod } from "@/types/database";

export default async function LaporanPage() {
  const { profile, isDemoLocal } = await getCurrentSession();
  const isOwner = profile?.role === "owner";
  const todayDateKey = getJakartaDateKey(new Date());

  let salesHistory: SaleWithItems[] = [];
  let todayExpensesTotal = 0;
  let todayLossesTotal = 0;
  let cashSalesToday = 0;
  let qrisSalesToday = 0;
  let transferSalesToday = 0;
  let revenueToday = 0;
  let costToday = 0;
  let existingClosing: DailyClosing | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const thirtyDaysStartIso = getJakartaDaysAgoStartIso(29);
    const todayStartIso = getJakartaStartOfTodayIso();

    const [
      eggsRes,
      profilesRes,
      salesHistoryRes,
      todaySalesRes,
      expensesRes,
      lossesRes,
      closingRes,
    ] = await Promise.all([
      supabase.from("egg_types").select("id, name"),
      supabase.from("profiles").select("id, full_name"),
      supabase
        .from("sales")
        .select(
          "id, cashier_id, total_amount, total_cost, payment_method, cash_received, change_amount, created_at, sale_items(id, egg_type_id, qty_kg, unit_label, is_cracked, price_per_kg, cost_per_kg, subtotal)"
        )
        .gte("created_at", thirtyDaysStartIso)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("sales")
        .select("total_amount, total_cost, payment_method")
        .gte("created_at", todayStartIso),
      supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", todayStartIso),
      supabase
        .from("stock_losses")
        .select("cost_loss")
        .gte("created_at", todayStartIso),
      supabase
        .from("daily_closings")
        .select("*")
        .eq("closing_date", todayDateKey)
        .maybeSingle(),
    ]);

    const eggNameMap = new Map<string, string>();
    for (const e of (eggsRes.data as { id: string; name: string }[] | null) ??
      []) {
      eggNameMap.set(e.id, e.name);
    }

    const cashierNameMap = new Map<string, string>();
    for (const p of (profilesRes.data as
      | { id: string; full_name: string }[]
      | null) ?? []) {
      cashierNameMap.set(p.id, p.full_name);
    }

    const rawSales =
      (salesHistoryRes.data as
        | {
            id: string;
            cashier_id: string;
            total_amount: number;
            total_cost: number;
            payment_method: PaymentMethod;
            cash_received: number;
            change_amount: number;
            created_at: string;
            sale_items:
              | {
                  id: string;
                  egg_type_id: string;
                  qty_kg: number;
                  unit_label: string;
                  is_cracked: boolean;
                  price_per_kg: number;
                  cost_per_kg: number;
                  subtotal: number;
                }[]
              | null;
          }[]
        | null) ?? [];

    salesHistory = rawSales.map((sale) => ({
      id: sale.id,
      cashier_name: cashierNameMap.get(sale.cashier_id) ?? "Kasir",
      total_amount: Number(sale.total_amount),
      total_cost: Number(sale.total_cost),
      payment_method: sale.payment_method,
      cash_received: Number(sale.cash_received),
      change_amount: Number(sale.change_amount),
      created_at: sale.created_at,
      items: (sale.sale_items ?? []).map(
        (item): SaleHistoryItem => ({
          id: item.id,
          egg_type_id: item.egg_type_id,
          egg_name: eggNameMap.get(item.egg_type_id) ?? "Telur",
          qty_kg: Number(item.qty_kg),
          unit_label: item.unit_label,
          is_cracked: item.is_cracked,
          price_per_kg: Number(item.price_per_kg),
          cost_per_kg: Number(item.cost_per_kg),
          subtotal: Number(item.subtotal),
        })
      ),
    }));

    const todaySalesRows =
      (todaySalesRes.data as
        | {
            total_amount: number;
            total_cost: number;
            payment_method: PaymentMethod;
          }[]
        | null) ?? [];

    for (const sale of todaySalesRows) {
      const amt = Number(sale.total_amount);
      revenueToday += amt;
      costToday += Number(sale.total_cost);
      if (sale.payment_method === "cash") cashSalesToday += amt;
      else if (sale.payment_method === "qris") qrisSalesToday += amt;
      else if (sale.payment_method === "transfer") transferSalesToday += amt;
    }

    for (const exp of (expensesRes.data as { amount: number }[] | null) ?? []) {
      todayExpensesTotal += Number(exp.amount);
    }
    for (const loss of (lossesRes.data as { cost_loss: number }[] | null) ??
      []) {
      todayLossesTotal += Number(loss.cost_loss);
    }
    existingClosing = (closingRes.data as DailyClosing | null) ?? null;
  } else {
    salesHistory = buildDemoSalesHistory();
    for (const sale of salesHistory) {
      if (getJakartaDateKey(sale.created_at) !== todayDateKey) continue;
      revenueToday += sale.total_amount;
      costToday += sale.total_cost;
      if (sale.payment_method === "cash") cashSalesToday += sale.total_amount;
      else if (sale.payment_method === "qris") qrisSalesToday += sale.total_amount;
      else if (sale.payment_method === "transfer")
        transferSalesToday += sale.total_amount;
    }
    for (const exp of buildDemoExpenses()) {
      if (getJakartaDateKey(exp.created_at) === todayDateKey) {
        todayExpensesTotal += exp.amount;
      }
    }
    for (const loss of buildDemoStockLosses()) {
      if (getJakartaDateKey(loss.created_at) === todayDateKey) {
        todayLossesTotal += loss.cost_loss;
      }
    }
  }

  const todayClosingContext: TodayClosingContext = {
    closingDate: todayDateKey,
    cashSalesToday: Math.round(cashSalesToday),
    qrisTotalToday: Math.round(qrisSalesToday),
    transferTotalToday: Math.round(transferSalesToday),
    expensesToday: Math.round(todayExpensesTotal),
    expectedCash: Math.round(cashSalesToday - todayExpensesTotal),
    revenueToday: Math.round(revenueToday),
    profitToday: Math.round(
      revenueToday - costToday - todayExpensesTotal - todayLossesTotal
    ),
  };

  return (
    <ReportManager
      salesHistory={salesHistory}
      todayClosingContext={todayClosingContext}
      initialClosing={existingClosing}
      isOwner={isOwner}
      isDemoLocal={isDemoLocal}
    />
  );
}
