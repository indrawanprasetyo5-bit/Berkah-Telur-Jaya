"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DailyClosing } from "@/types/database";

export interface SaveDailyClosingInput {
  closing_date: string;
  expected_cash: number;
  actual_cash: number;
  total_expenses: number;
  qris_total: number;
  transfer_total: number;
  total_revenue: number;
  total_profit: number;
  notes: string;
}

export interface SaveDailyClosingResult {
  ok: boolean;
  error?: string;
  closing?: DailyClosing;
}

export async function saveDailyClosing(
  input: SaveDailyClosingInput
): Promise<SaveDailyClosingResult> {
  if (!input.closing_date) {
    return { ok: false, error: "Tanggal tutup kasir tidak valid." };
  }
  if (!Number.isFinite(input.actual_cash) || input.actual_cash < 0) {
    return {
      ok: false,
      error: "Uang fisik di laci harus berupa angka 0 atau lebih.",
    };
  }

  const normalizedNotes = input.notes.trim() || null;

  if (!isSupabaseConfigured()) {
    const demoClosing: DailyClosing = {
      id: `demo-closing-${input.closing_date}`,
      closing_date: input.closing_date,
      expected_cash: Math.round(input.expected_cash),
      actual_cash: Math.round(input.actual_cash),
      total_expenses: Math.round(input.total_expenses),
      qris_total: Math.round(input.qris_total),
      transfer_total: Math.round(input.transfer_total),
      total_revenue: Math.round(input.total_revenue),
      total_profit: Math.round(input.total_profit),
      notes: normalizedNotes,
      closed_by: "demo-user",
      created_at: new Date().toISOString(),
    };
    return { ok: true, closing: demoClosing };
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

  const { data: existing } = await supabase
    .from("daily_closings")
    .select("id")
    .eq("closing_date", input.closing_date)
    .maybeSingle();

  const payload = {
    closing_date: input.closing_date,
    expected_cash: Math.round(input.expected_cash),
    actual_cash: Math.round(input.actual_cash),
    total_expenses: Math.round(input.total_expenses),
    qris_total: Math.round(input.qris_total),
    transfer_total: Math.round(input.transfer_total),
    total_revenue: Math.round(input.total_revenue),
    total_profit: Math.round(input.total_profit),
    notes: normalizedNotes,
    closed_by: user.id,
  };

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("daily_closings")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();

    if (updateError || !updated) {
      return {
        ok: false,
        error:
          "Tutup kasir hari ini sudah tercatat. Di mode database, hanya Owner yang dapat merevisi tutup kasir.",
      };
    }

    revalidatePath("/laporan");
    revalidatePath("/dashboard");
    return { ok: true, closing: updated as DailyClosing };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("daily_closings")
    .insert(payload)
    .select("*")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: "Gagal menyimpan tutup kasir harian ke database. Coba lagi.",
    };
  }

  revalidatePath("/laporan");
  revalidatePath("/dashboard");
  return { ok: true, closing: inserted as DailyClosing };
}
