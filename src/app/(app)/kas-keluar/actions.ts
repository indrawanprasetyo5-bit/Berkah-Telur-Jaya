"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Expense, ExpenseCategory } from "@/types/database";

export interface CreateExpenseInput {
  amount: number;
  category: ExpenseCategory;
  notes: string;
}

export interface CreateExpenseResult {
  ok: boolean;
  error?: string;
  expense?: Expense;
}

export interface DeleteExpenseResult {
  ok: boolean;
  error?: string;
  deletedId?: string;
}

const VALID_CATEGORIES = new Set<ExpenseCategory>([
  "plastik",
  "parkir",
  "konsumsi",
  "lainnya",
]);

export async function createExpense(
  input: CreateExpenseInput
): Promise<CreateExpenseResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Masukkan nominal pengeluaran lebih dari Rp 0." };
  }
  if (!VALID_CATEGORIES.has(input.category)) {
    return { ok: false, error: "Pilih kategori pengeluaran yang valid." };
  }

  const normalizedAmount = Math.round(input.amount);
  const normalizedNotes = input.notes.trim();

  if (!isSupabaseConfigured()) {
    const demoExpense: Expense = {
      id: `demo-expense-${Date.now()}`,
      amount: normalizedAmount,
      category: input.category,
      notes: normalizedNotes || null,
      recorded_by: "demo-user",
      created_at: new Date().toISOString(),
    };
    return { ok: true, expense: demoExpense };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: "Sesi login berakhir. Silakan masuk ulang terlebih dahulu.",
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("expenses")
    .insert({
      amount: normalizedAmount,
      category: input.category,
      notes: normalizedNotes || null,
      recorded_by: user.id,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: "Gagal menyimpan kas keluar ke database. Coba lagi.",
    };
  }

  revalidatePath("/kas-keluar");
  revalidatePath("/dashboard");
  revalidatePath("/laporan");

  return {
    ok: true,
    expense: inserted as Expense,
  };
}

export async function deleteExpense(
  expenseId: string
): Promise<DeleteExpenseResult> {
  if (!expenseId) {
    return { ok: false, error: "Data kas keluar tidak ditemukan." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, deletedId: expenseId };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: "Sesi login berakhir. Silakan masuk ulang terlebih dahulu.",
    };
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .select("id");

  if (deleteError) {
    return {
      ok: false,
      error: "Gagal menghapus catatan kas keluar. Pastikan akun memiliki izin.",
    };
  }

  if (!deletedRows || deletedRows.length === 0) {
    return {
      ok: false,
      error:
        "Catatan tidak dapat dihapus. Hanya pembuat catatan hari ini atau Owner yang dapat menghapus kas keluar.",
    };
  }

  revalidatePath("/kas-keluar");
  revalidatePath("/dashboard");
  revalidatePath("/laporan");

  return { ok: true, deletedId: expenseId };
}
