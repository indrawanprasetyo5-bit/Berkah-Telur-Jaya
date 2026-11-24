import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_EGG_TYPES } from "@/lib/demo-data";
import { CashierPos } from "@/components/cashier-pos";
import type { EggType } from "@/types/database";

export default async function CashierHomePage() {
  let eggs: EggType[] = DEMO_EGG_TYPES;
  const supabaseConfigured = isSupabaseConfigured();

  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("egg_types")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (data && data.length > 0) {
      eggs = data as EggType[];
    } else {
      eggs = [];
    }
  }

  return (
    <CashierPos
      initialEggs={eggs}
      isDemoLocal={!supabaseConfigured}
    />
  );
}
