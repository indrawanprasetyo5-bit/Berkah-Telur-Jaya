import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { buildDemoExpenses } from "@/lib/demo-data";
import { getJakartaStartOfTodayIso } from "@/lib/format";
import { ExpenseManager } from "@/components/expense-manager";
import type { Expense } from "@/types/database";

export default async function ExpensesPage() {
  const supabaseConfigured = isSupabaseConfigured();
  let expenses: Expense[] = [];

  if (supabaseConfigured) {
    const supabase = await createClient();
    const startOfTodayIso = getJakartaStartOfTodayIso();

    const { data } = await supabase
      .from("expenses")
      .select("*")
      .gte("created_at", startOfTodayIso)
      .order("created_at", { ascending: false });

    expenses = (data as Expense[] | null) ?? [];
  } else {
    expenses = buildDemoExpenses();
  }

  return (
    <ExpenseManager
      initialExpenses={expenses}
      isDemoLocal={!supabaseConfigured}
    />
  );
}
