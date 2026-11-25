"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { saveDemoPriceOverrides } from "@/lib/demo-prices";
import type { EggType } from "@/types/database";

export interface EggPriceUpdateItem {
  id: string;
  cost_per_kg: number;
  price_per_kg: number;
}

export interface UpdatePricesResult {
  ok: boolean;
  error?: string;
  updatedEggs?: EggType[];
}

export async function updateDailyEggPrices(
  updates: EggPriceUpdateItem[]
): Promise<UpdatePricesResult> {
  if (!updates || updates.length === 0) {
    return { ok: false, error: "Tidak ada perubahan harga untuk disimpan." };
  }

  for (const item of updates) {
    if (!item.id) {
      return { ok: false, error: "ID jenis telur tidak valid." };
    }
    if (!Number.isFinite(item.cost_per_kg) || item.cost_per_kg <= 0) {
      return { ok: false, error: "Harga modal per kg harus lebih dari Rp 0." };
    }
    if (!Number.isFinite(item.price_per_kg) || item.price_per_kg <= 0) {
      return { ok: false, error: "Harga jual per kg harus lebih dari Rp 0." };
    }
  }

  if (!isSupabaseConfigured()) {
    const updatedEggs = await saveDemoPriceOverrides(updates);
    revalidatePath("/");
    revalidatePath("/stok");
    revalidatePath("/dashboard");
    revalidatePath("/laporan");
    return { ok: true, updatedEggs };
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "owner") {
    return {
      ok: false,
      error: "Hanya akun Owner yang dapat mengubah harga telur.",
    };
  }

  const results = await Promise.all(
    updates.map((item) =>
      supabase
        .from("egg_types")
        .update({
          cost_per_kg: Math.round(item.cost_per_kg),
          price_per_kg: Math.round(item.price_per_kg),
        })
        .eq("id", item.id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return {
      ok: false,
      error: "Sebagian harga gagal diperbarui di database. Coba lagi.",
    };
  }

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
    updatedEggs: (refreshedEggs as EggType[] | null) ?? undefined,
  };
}
