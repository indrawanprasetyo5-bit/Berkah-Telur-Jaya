import { cookies } from "next/headers";
import { DEMO_EGG_TYPES } from "@/lib/demo-data";
import type { EggType } from "@/types/database";

export const DEMO_PRICES_COOKIE = "btj_demo_prices";

type DemoPriceOverrideMap = Record<
  string,
  { cost_per_kg: number; price_per_kg: number }
>;

function parsePriceOverrides(raw: string | undefined): DemoPriceOverrideMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: DemoPriceOverrideMap = {};
    for (const [id, entry] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (!entry || typeof entry !== "object") continue;
      const rec = entry as Record<string, unknown>;
      const cost = Number(rec.cost_per_kg);
      const price = Number(rec.price_per_kg);
      if (
        Number.isFinite(cost) &&
        cost > 0 &&
        Number.isFinite(price) &&
        price > 0
      ) {
        result[id] = {
          cost_per_kg: Math.round(cost),
          price_per_kg: Math.round(price),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function applyOverrides(overrides: DemoPriceOverrideMap): EggType[] {
  return DEMO_EGG_TYPES.map((egg) => {
    const override = overrides[egg.id];
    if (!override) return egg;
    return {
      ...egg,
      cost_per_kg: override.cost_per_kg,
      price_per_kg: override.price_per_kg,
    };
  });
}

export async function getDemoEggsWithOverrides(): Promise<EggType[]> {
  const cookieStore = await cookies();
  const overrides = parsePriceOverrides(
    cookieStore.get(DEMO_PRICES_COOKIE)?.value
  );
  return applyOverrides(overrides);
}

export async function saveDemoPriceOverrides(
  updates: { id: string; cost_per_kg: number; price_per_kg: number }[]
): Promise<EggType[]> {
  const cookieStore = await cookies();
  const overrides = parsePriceOverrides(
    cookieStore.get(DEMO_PRICES_COOKIE)?.value
  );

  for (const item of updates) {
    overrides[item.id] = {
      cost_per_kg: Math.round(item.cost_per_kg),
      price_per_kg: Math.round(item.price_per_kg),
    };
  }

  cookieStore.set(DEMO_PRICES_COOKIE, JSON.stringify(overrides), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return applyOverrides(overrides);
}
