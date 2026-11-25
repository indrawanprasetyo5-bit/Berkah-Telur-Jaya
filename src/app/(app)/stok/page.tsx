import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  buildDemoRestockDeliveries,
  buildDemoStockLosses,
} from "@/lib/demo-data";
import { getDemoEggsWithOverrides } from "@/lib/demo-prices";
import { StockManager } from "@/components/stock-manager";
import type { EggType, RestockDelivery, StockLoss } from "@/types/database";

export default async function StockPage() {
  const supabaseConfigured = isSupabaseConfigured();

  let eggs: EggType[] = [];
  let deliveries: RestockDelivery[] = [];
  let losses: StockLoss[] = [];

  if (supabaseConfigured) {
    const supabase = await createClient();
    const [eggsRes, deliveriesRes, lossesRes] = await Promise.all([
      supabase
        .from("egg_types")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("restock_deliveries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("stock_losses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    eggs = (eggsRes.data as EggType[] | null) ?? [];
    deliveries = (deliveriesRes.data as RestockDelivery[] | null) ?? [];
    losses = (lossesRes.data as StockLoss[] | null) ?? [];
  } else {
    eggs = await getDemoEggsWithOverrides();
    deliveries = buildDemoRestockDeliveries();
    losses = buildDemoStockLosses();
  }

  return (
    <StockManager
      initialEggs={eggs}
      initialDeliveries={deliveries}
      initialLosses={losses}
      isDemoLocal={!supabaseConfigured}
    />
  );
}
