"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { EggType, PaymentMethod } from "@/types/database";

export interface SaleItemInput {
  egg_type_id: string;
  qty_kg: number;
  unit_label: string;
  is_cracked: boolean;
  price_per_kg: number;
  cost_per_kg: number;
  subtotal: number;
}

export interface CreateSaleInput {
  items: SaleItemInput[];
  payment_method: PaymentMethod;
  cash_received: number;
}

export interface CreateSaleResult {
  ok: boolean;
  error?: string;
  saleId?: string;
  totalAmount?: number;
  changeAmount?: number;
  updatedEggs?: EggType[];
}

export async function createSaleTransaction(
  input: CreateSaleInput
): Promise<CreateSaleResult> {
  if (!input.items || input.items.length === 0) {
    return { ok: false, error: "Belum ada telur yang dipilih di transaksi." };
  }

  for (const item of input.items) {
    if (
      !item.egg_type_id ||
      !Number.isFinite(item.qty_kg) ||
      item.qty_kg <= 0 ||
      !Number.isFinite(item.price_per_kg) ||
      item.price_per_kg <= 0 ||
      !Number.isFinite(item.subtotal) ||
      item.subtotal <= 0
    ) {
      return {
        ok: false,
        error: "Data berat atau harga item transaksi tidak valid.",
      };
    }
  }

  const totalAmount = Math.round(
    input.items.reduce((sum, item) => sum + item.subtotal, 0)
  );
  if (totalAmount <= 0) {
    return { ok: false, error: "Total transaksi harus lebih dari Rp 0." };
  }

  const cashReceived =
    input.payment_method === "cash"
      ? input.cash_received > 0
        ? Math.round(input.cash_received)
        : totalAmount
      : 0;

  if (input.payment_method === "cash" && cashReceived < totalAmount) {
    return {
      ok: false,
      error: "Uang tunai yang diterima kurang dari total belanja.",
    };
  }

  const changeAmount =
    input.payment_method === "cash" ? Math.max(0, cashReceived - totalAmount) : 0;

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      saleId: `demo-${Date.now()}`,
      totalAmount,
      changeAmount,
    };
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

  // Harga modal dan stok diambil ulang dari DB, jangan percaya nilai dari client.
  const requestedKgByEgg = new Map<string, number>();
  for (const item of input.items) {
    const prev = requestedKgByEgg.get(item.egg_type_id) ?? 0;
    requestedKgByEgg.set(
      item.egg_type_id,
      Number((prev + Number(item.qty_kg.toFixed(2))).toFixed(2))
    );
  }

  const eggIds = Array.from(requestedKgByEgg.keys());
  const { data: currentEggs, error: eggsFetchError } = await supabase
    .from("egg_types")
    .select("id, name, cost_per_kg, stock_kg")
    .in("id", eggIds);

  if (eggsFetchError || !currentEggs) {
    return {
      ok: false,
      error: "Gagal membaca data stok dan harga modal telur dari database.",
    };
  }

  const costMap = new Map<string, number>();
  for (const egg of currentEggs) {
    const availableKg = Number(egg.stock_kg);
    const neededKg = requestedKgByEgg.get(egg.id) ?? 0;
    if (neededKg > availableKg) {
      return {
        ok: false,
        error: `Stok ${egg.name} tidak mencukupi (tersisa ${availableKg} kg, dibutuhkan ${neededKg} kg).`,
      };
    }
    costMap.set(egg.id, Number(egg.cost_per_kg));
  }

  const normalizedItems = input.items.map((item) => {
    const costPerKg = costMap.get(item.egg_type_id) ?? item.cost_per_kg;
    return {
      ...item,
      qty_kg: Number(item.qty_kg.toFixed(2)),
      cost_per_kg: costPerKg,
      price_per_kg: Math.round(item.price_per_kg),
      subtotal: Math.round(item.subtotal),
    };
  });

  const verifiedTotalCost = Math.round(
    normalizedItems.reduce((sum, i) => sum + i.qty_kg * i.cost_per_kg, 0)
  );

  const { data: insertedSale, error: saleError } = await supabase
    .from("sales")
    .insert({
      cashier_id: user.id,
      total_amount: totalAmount,
      total_cost: verifiedTotalCost,
      payment_method: input.payment_method,
      cash_received: cashReceived,
      change_amount: changeAmount,
    })
    .select("id")
    .single();

  if (saleError || !insertedSale) {
    return {
      ok: false,
      error: "Gagal menyimpan transaksi penjualan. Coba ulangi beberapa detik lagi.",
    };
  }

  const { error: itemsError } = await supabase.from("sale_items").insert(
    normalizedItems.map((item) => ({
      sale_id: insertedSale.id,
      egg_type_id: item.egg_type_id,
      qty_kg: item.qty_kg,
      unit_label: item.unit_label,
      is_cracked: item.is_cracked,
      price_per_kg: item.price_per_kg,
      cost_per_kg: item.cost_per_kg,
      subtotal: item.subtotal,
    }))
  );

  if (itemsError) {
    // Rollback manual: hapus header kalau item gagal disimpan.
    await supabase.from("sales").delete().eq("id", insertedSale.id);
    return {
      ok: false,
      error: "Gagal menyimpan rincian item telur. Transaksi dibatalkan.",
    };
  }

  // stock_kg sudah dikurangi trigger, ambil nilai terbarunya.
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
    saleId: insertedSale.id,
    totalAmount,
    changeAmount,
    updatedEggs: (refreshedEggs as EggType[] | null) ?? undefined,
  };
}
