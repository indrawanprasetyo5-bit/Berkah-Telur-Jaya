import { getCurrentSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getDemoEggsWithOverrides } from "@/lib/demo-prices";
import { CashierPos } from "@/components/cashier-pos";
import type { EggType } from "@/types/database";

export default async function CashierHomePage() {
  const supabaseConfigured = isSupabaseConfigured();

  if (!supabaseConfigured) {
    const [session, demoEggs] = await Promise.all([
      getCurrentSession(),
      getDemoEggsWithOverrides(),
    ]);
    return (
      <CashierPos
        initialEggs={demoEggs}
        cashierName={session.profile?.full_name ?? "Kasir 1"}
        isDemoLocal
      />
    );
  }

  const supabase = await createClient();
  const [session, eggsRes] = await Promise.all([
    getCurrentSession(),
    supabase
      .from("egg_types")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const eggs =
    eggsRes.data && eggsRes.data.length > 0
      ? (eggsRes.data as EggType[])
      : [];

  return (
    <CashierPos
      initialEggs={eggs}
      cashierName={session.profile?.full_name ?? "Kasir"}
      isDemoLocal={false}
    />
  );
}
