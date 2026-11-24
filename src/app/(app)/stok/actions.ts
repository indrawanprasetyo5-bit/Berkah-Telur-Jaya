"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  EggType,
  RestockDelivery,
  StockLoss,
  StockLossReason,
} from "@/types/database";

export interface RecordRestockInput {
  egg_type_id: string;
  peti_count: number;
  qty_kg: number;
  cost_per_kg: number;
  supplier_name: string;
  driver_name: string;
  broken_kg: number;
  notes: string;
}

export interface RecordRestockResult {
  ok: boolean;
  error?: string;
  delivery?: RestockDelivery;
  updatedEggs?: EggType[];
}

export interface RecordLossInput {
  egg_type_id: string;
  qty_kg: number;
  reason: StockLossReason;
  cost_per_kg_fallback: number;
}

export interface RecordLossResult {
  ok: boolean;
  error?: string;
  loss?: StockLoss;
  updatedEggs?: EggType[];
}

const VALID_LOSS_REASONS = new Set<StockLossReason>([
  "pecah_lapak",
  "busuk",
  "lainnya",
]);

export async function recordRestockDelivery(
  input: RecordRestockInput
): Promise<RecordRestockResult> {
  const supplierName = input.supplier_name.trim();
  const driverName = input.driver_name.trim();
  const notes = input.notes.trim();

  if (!input.egg_type_id) {
    return { ok: false, error: "Pilih jenis telur terlebih dahulu." };
  }
  if (!Number.isFinite(input.peti_count) || input.peti_count <= 0) {
    return { ok: false, error: "Jumlah peti harus lebih dari 0." };
  }
  if (!Number.isFinite(input.qty_kg) || input.qty_kg <= 0) {
    return { ok: false, error: "Berat kiriman (kg) harus lebih dari 0." };
  }
  if (!Number.isFinite(input.cost_per_kg) || input.cost_per_kg <= 0) {
    return { ok: false, error: "Harga modal per kg harus lebih dari 0." };
  }
  if (!supplierName) {
    return { ok: false, error: "Isi nama gudang atau distributor." };
  }
  if (!Number.isFinite(input.broken_kg) || input.broken_kg < 0) {
    return { ok: false, error: "Berat telur pecah tidak boleh negatif." };
  }
  if (input.broken_kg > input.qty_kg) {
    return {
      ok: false,
      error: "Telur pecah tidak boleh melebihi total berat kiriman.",
    };
  }

  const normalizedPeti = Number(input.peti_count.toFixed(2));
  const normalizedQtyKg = Number(input.qty_kg.toFixed(2));
  const normalizedBrokenKg = Number(input.broken_kg.toFixed(2));
  const normalizedCost = Math.round(input.cost_per_kg);

  if (!isSupabaseConfigured()) {
    const demoDelivery: RestockDelivery = {
      id: `demo-restock-${Date.now()}`,
      egg_type_id: input.egg_type_id,
      peti_count: normalizedPeti,
      qty_kg: normalizedQtyKg,
      cost_per_kg: normalizedCost,
      supplier_name: supplierName,
      driver_name: driverName || null,
      broken_kg: normalizedBrokenKg,
      notes: notes || null,
      received_by: "demo-user",
      created_at: new Date().toISOString(),
    };
    return { ok: true, delivery: demoDelivery };
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
    .from("restock_deliveries")
    .insert({
      egg_type_id: input.egg_type_id,
      peti_count: normalizedPeti,
      qty_kg: normalizedQtyKg,
      cost_per_kg: normalizedCost,
      supplier_name: supplierName,
      driver_name: driverName || null,
      broken_kg: normalizedBrokenKg,
      notes: notes || null,
      received_by: user.id,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: "Gagal menyimpan kiriman mobil ke database. Coba lagi.",
    };
  }

  // trg_restock_stock menambah stock_kg (qty_kg - broken_kg) dan memperbarui cost_per_kg.
  const { data: refreshedEggs } = await supabase
    .from("egg_types")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  revalidatePath("/");
  revalidatePath("/stok");
  revalidatePath("/dashboard");
  revalidatePath("/laporan");

  return {
    ok: true,
    delivery: inserted as RestockDelivery,
    updatedEggs: (refreshedEggs as EggType[] | null) ?? undefined,
  };
}

export async function recordStockLoss(
  input: RecordLossInput
): Promise<RecordLossResult> {
  if (!input.egg_type_id) {
    return { ok: false, error: "Pilih jenis telur terlebih dahulu." };
  }
  if (!Number.isFinite(input.qty_kg) || input.qty_kg <= 0) {
    return { ok: false, error: "Jumlah telur pecah/busuk harus lebih dari 0 kg." };
  }
  if (!VALID_LOSS_REASONS.has(input.reason)) {
    return { ok: false, error: "Alasan kerugian tidak valid." };
  }

  const normalizedQty = Number(input.qty_kg.toFixed(2));

  if (!isSupabaseConfigured()) {
    const costLoss = Math.round(normalizedQty * input.cost_per_kg_fallback);
    const demoLoss: StockLoss = {
      id: `demo-loss-${Date.now()}`,
      egg_type_id: input.egg_type_id,
      qty_kg: normalizedQty,
      cost_loss: costLoss,
      reason: input.reason,
      recorded_by: "demo-user",
      created_at: new Date().toISOString(),
    };
    return { ok: true, loss: demoLoss };
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

  const { data: eggRow, error: eggError } = await supabase
    .from("egg_types")
    .select("name, cost_per_kg, stock_kg")
    .eq("id", input.egg_type_id)
    .single();

  if (eggError || !eggRow) {
    return {
      ok: false,
      error: "Gagal membaca stok dan harga modal telur dari database.",
    };
  }

  const availableKg = Number(eggRow.stock_kg);
  if (normalizedQty > availableKg) {
    return {
      ok: false,
      error: `Jumlah telur pecah melebihi sisa stok ${eggRow.name} (${availableKg} kg).`,
    };
  }

  const costLoss = Math.round(normalizedQty * Number(eggRow.cost_per_kg));

  const { data: inserted, error: insertError } = await supabase
    .from("stock_losses")
    .insert({
      egg_type_id: input.egg_type_id,
      qty_kg: normalizedQty,
      cost_loss: costLoss,
      reason: input.reason,
      recorded_by: user.id,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: "Gagal mencatat telur pecah/busuk ke database. Coba lagi.",
    };
  }

  // stock_kg dikurangi oleh trigger trg_stock_losses_stock.
  const { data: refreshedEggs } = await supabase
    .from("egg_types")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  revalidatePath("/");
  revalidatePath("/stok");
  revalidatePath("/dashboard");
  revalidatePath("/laporan");

  return {
    ok: true,
    loss: inserted as StockLoss,
    updatedEggs: (refreshedEggs as EggType[] | null) ?? undefined,
  };
}
