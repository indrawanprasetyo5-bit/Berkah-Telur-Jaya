"use client";

import { useMemo, useState, useTransition } from "react";
import type { EggType } from "@/types/database";
import type { DailyChartPoint } from "@/lib/demo-data";
import {
  formatCompactRupiah,
  formatKg,
  formatRupiah,
  formatShortDayLabel,
} from "@/lib/format";
import { updateDailyEggPrices } from "@/app/(app)/dashboard/actions";
import { IconCheck, IconClose, IconTag } from "@/components/icons";

export interface TodaySummaryMetrics {
  revenue: number;
  kgSold: number;
  expenses: number;
  losses: number;
  netProfit: number;
  txCount: number;
}

interface OwnerDashboardProps {
  initialEggs: EggType[];
  todaySummary: TodaySummaryMetrics;
  chartSeries: DailyChartPoint[];
  isDemoLocal: boolean;
}

interface PriceDraft {
  cost: string;
  price: string;
}

function createInitialDrafts(eggs: EggType[]): Record<string, PriceDraft> {
  const map: Record<string, PriceDraft> = {};
  for (const egg of eggs) {
    map[egg.id] = {
      cost: String(Math.round(egg.cost_per_kg)),
      price: String(Math.round(egg.price_per_kg)),
    };
  }
  return map;
}

export function OwnerDashboard({
  initialEggs,
  todaySummary,
  chartSeries,
  isDemoLocal,
}: OwnerDashboardProps) {
  const [eggs, setEggs] = useState<EggType[]>(initialEggs);
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>(() =>
    createInitialDrafts(initialEggs)
  );
  const [selectedDayKey, setSelectedDayKey] = useState<string>(
    chartSeries[chartSeries.length - 1]?.dateKey ?? ""
  );

  const [priceToast, setPriceToast] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [isSavingPrices, startPriceTransition] = useTransition();

  const maxChartValue = useMemo(() => {
    let maxVal = 100000;
    for (const point of chartSeries) {
      if (point.revenue > maxVal) maxVal = point.revenue;
      if (Math.abs(point.profit) > maxVal) maxVal = Math.abs(point.profit);
    }
    return maxVal;
  }, [chartSeries]);

  const activeDayPoint = useMemo(
    () =>
      chartSeries.find((p) => p.dateKey === selectedDayKey) ??
      chartSeries[chartSeries.length - 1] ??
      null,
    [chartSeries, selectedDayKey]
  );

  const sevenDayTotals = useMemo(() => {
    let revenue = 0;
    let profit = 0;
    for (const point of chartSeries) {
      revenue += point.revenue;
      profit += point.profit;
    }
    return { revenue, profit };
  }, [chartSeries]);

  const changedEggs = useMemo(() => {
    return eggs.filter((egg) => {
      const draft = drafts[egg.id];
      if (!draft) return false;
      return (
        Math.round(Number(draft.cost)) !== Math.round(egg.cost_per_kg) ||
        Math.round(Number(draft.price)) !== Math.round(egg.price_per_kg)
      );
    });
  }, [eggs, drafts]);

  function handleDraftChange(
    eggId: string,
    field: "cost" | "price",
    value: string
  ) {
    setPriceError(null);
    setPriceToast(null);
    setDrafts((prev) => ({
      ...prev,
      [eggId]: {
        cost: field === "cost" ? value : (prev[eggId]?.cost ?? "0"),
        price: field === "price" ? value : (prev[eggId]?.price ?? "0"),
      },
    }));
  }

  function handleResetDrafts() {
    setDrafts(createInitialDrafts(eggs));
    setPriceError(null);
    setPriceToast(null);
  }

  function handleSavePrices(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (changedEggs.length === 0) return;

    const payload = changedEggs.map((egg) => {
      const draft = drafts[egg.id];
      return {
        id: egg.id,
        cost_per_kg: Math.round(Number(draft?.cost ?? 0)),
        price_per_kg: Math.round(Number(draft?.price ?? 0)),
      };
    });

    for (const item of payload) {
      if (!Number.isFinite(item.cost_per_kg) || item.cost_per_kg <= 0) {
        setPriceError("Semua harga modal harus lebih dari Rp 0.");
        return;
      }
      if (!Number.isFinite(item.price_per_kg) || item.price_per_kg <= 0) {
        setPriceError("Semua harga jual harus lebih dari Rp 0.");
        return;
      }
    }

    setPriceError(null);

    startPriceTransition(async () => {
      const result = await updateDailyEggPrices(payload);
      if (!result.ok) {
        setPriceError(result.error ?? "Gagal menyimpan perubahan harga.");
        return;
      }

      if (result.updatedEggs) {
        setEggs(result.updatedEggs);
        setDrafts(createInitialDrafts(result.updatedEggs));
      } else if (isDemoLocal) {
        const updateMap = new Map(payload.map((u) => [u.id, u]));
        const nextEggs = eggs.map((egg) => {
          const u = updateMap.get(egg.id);
          if (!u) return egg;
          return {
            ...egg,
            cost_per_kg: u.cost_per_kg,
            price_per_kg: u.price_per_kg,
            updated_at: new Date().toISOString(),
          };
        });
        setEggs(nextEggs);
        setDrafts(createInitialDrafts(nextEggs));
      }

      setPriceToast(
        `Harga ${payload.length} jenis telur berhasil diperbarui untuk hari ini.`
      );
    });
  }

  const profitIsNegative = todaySummary.netProfit < 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Dashboard Owner
          </h1>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            Ringkasan omzet, profit bersih hari ini, tren 7 hari, dan update
            harga cepat.
          </p>
        </div>
        <p className="tabular-nums text-xs font-bold text-ink-muted">
          {todaySummary.txCount} transaksi hari ini
          {isDemoLocal ? " (Demo Lokal)" : ""}
        </p>
      </div>

      <section
        aria-label="Ringkasan kinerja hari ini"
        className="grid grid-cols-1 gap-3 lg:grid-cols-12"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-7">
          <div
            className={`rounded-xl border-2 p-4 ${
              profitIsNegative
                ? "border-danger-border bg-danger-bg"
                : "border-safe-border bg-safe-bg"
            }`}
          >
            <p
              className={`text-xs font-bold ${
                profitIsNegative ? "text-danger" : "text-safe"
              }`}
            >
              Profit Bersih Hari Ini
            </p>
            <p
              className={`tabular-nums mt-1.5 text-3xl font-extrabold leading-tight ${
                profitIsNegative ? "text-danger" : "text-safe"
              }`}
            >
              {formatRupiah(todaySummary.netProfit)}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-ink">
              Omzet dikurangi modal HPP, kas keluar, dan telur pecah.
            </p>
          </div>

          <div className="rounded-xl border-2 border-border-strong bg-surface p-4">
            <p className="text-xs font-bold text-ink-muted">Omzet Hari Ini</p>
            <p className="tabular-nums mt-1.5 text-3xl font-extrabold leading-tight text-ink">
              {formatRupiah(todaySummary.revenue)}
            </p>
            <p className="tabular-nums mt-1.5 text-xs font-semibold text-ink-muted">
              Total terjual:{" "}
              <span className="font-bold text-ink">
                {formatKg(todaySummary.kgSold)} kg
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:col-span-5">
          <div className="rounded-xl border-2 border-border-strong bg-surface p-3.5">
            <p className="text-xs font-bold text-ink-muted">Total Terjual</p>
            <p className="tabular-nums mt-1.5 text-xl font-extrabold text-ink">
              {formatKg(todaySummary.kgSold)} kg
            </p>
            <p className="mt-1 text-xs font-medium text-ink-muted">
              Semua jenis
            </p>
          </div>

          <div className="rounded-xl border-2 border-border-strong bg-surface p-3.5">
            <p className="text-xs font-bold text-ink-muted">Kas Keluar</p>
            <p className="tabular-nums mt-1.5 text-xl font-extrabold text-warn">
              {formatRupiah(todaySummary.expenses)}
            </p>
            <p className="mt-1 text-xs font-medium text-ink-muted">
              Dari laci
            </p>
          </div>

          <div className="col-span-2 rounded-xl border-2 border-border-strong bg-surface p-3.5 sm:col-span-1">
            <p className="text-xs font-bold text-ink-muted">Telur Pecah</p>
            <p className="tabular-nums mt-1.5 text-xl font-extrabold text-danger">
              {formatRupiah(todaySummary.losses)}
            </p>
            <p className="mt-1 text-xs font-medium text-ink-muted">
              Rugi modal
            </p>
          </div>
        </div>
      </section>

      <section
        aria-label="Grafik omzet dan profit 7 hari terakhir"
        className="rounded-xl border-2 border-border-strong bg-surface p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">
              Omzet & Profit 7 Hari Terakhir
            </h2>
            <p className="tabular-nums mt-0.5 text-xs font-semibold text-ink-muted">
              Total 7 hari: Omzet {formatRupiah(sevenDayTotals.revenue)} / Profit{" "}
              {formatRupiah(sevenDayTotals.profit)}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold text-ink">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-accent" />
              Omzet
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-safe" />
              Profit Bersih
            </span>
          </div>
        </div>

        {activeDayPoint ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-tray px-3.5 py-2.5 text-sm">
            <span className="font-bold text-ink">
              {formatShortDayLabel(activeDayPoint.dateKey)}
              {activeDayPoint.dateKey ===
              chartSeries[chartSeries.length - 1]?.dateKey
                ? " (Hari Ini)"
                : ""}
            </span>
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
              <span className="tabular-nums font-bold text-ink">
                Omzet: {formatRupiah(activeDayPoint.revenue)}
              </span>
              <span
                className={`tabular-nums font-extrabold ${
                  activeDayPoint.profit < 0 ? "text-danger" : "text-safe"
                }`}
              >
                Profit: {formatRupiah(activeDayPoint.profit)}
              </span>
              <span className="tabular-nums font-semibold text-ink-muted">
                ({formatKg(activeDayPoint.kgSold)} kg)
              </span>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-3">
          {chartSeries.map((point) => {
            const isSelected = point.dateKey === selectedDayKey;
            const revHeightPct =
              point.revenue > 0
                ? Math.max(8, Math.round((point.revenue / maxChartValue) * 100))
                : 3;
            const profitAbs = Math.abs(point.profit);
            const profitHeightPct =
              profitAbs > 0
                ? Math.max(8, Math.round((profitAbs / maxChartValue) * 100))
                : 3;

            return (
              <button
                key={point.dateKey}
                type="button"
                onClick={() => setSelectedDayKey(point.dateKey)}
                aria-pressed={isSelected}
                aria-label={`${formatShortDayLabel(point.dateKey)}: Omzet ${formatRupiah(point.revenue)}, Profit ${formatRupiah(point.profit)}`}
                className={`flex min-h-11 min-w-0 flex-col items-center overflow-hidden rounded-lg border-2 px-0.5 py-2 transition-colors duration-150 sm:px-1.5 ${
                  isSelected
                    ? "border-accent bg-accent-soft/50"
                    : "border-transparent bg-tray/60 hover:border-border-strong hover:bg-tray"
                }`}
              >
                <span className="tabular-nums max-w-full truncate text-[10px] font-bold text-ink-muted sm:text-[11px]">
                  {formatCompactRupiah(point.revenue)}
                </span>

                <div className="mt-2 flex h-32 w-full items-end justify-center gap-0.5 sm:h-40 sm:gap-1.5">
                  <div
                    className="w-2.5 rounded-t-sm bg-accent sm:w-5"
                    style={{ height: `${revHeightPct}%` }}
                  />
                  <div
                    className={`w-2.5 rounded-t-sm sm:w-5 ${
                      point.profit < 0 ? "bg-danger" : "bg-safe"
                    }`}
                    style={{ height: `${profitHeightPct}%` }}
                  />
                </div>

                <span
                  className={`mt-2 max-w-full truncate text-center text-[10px] leading-tight font-bold sm:text-xs ${
                    isSelected ? "text-accent" : "text-ink"
                  }`}
                >
                  {formatShortDayLabel(point.dateKey)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-label="Update harga telur harian"
        className="rounded-xl border-2 border-border-strong bg-surface p-4 sm:p-5"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <IconTag className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-bold text-ink">
              Update Harga Harian Cepat
            </h2>
          </div>
          <p className="text-xs font-semibold text-ink-muted">
            Ubah modal & jual per kg lalu simpan sekali klik.
          </p>
        </div>

        {priceToast ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex items-center justify-between gap-3 rounded-lg border-2 border-safe-border bg-safe-bg px-3.5 py-2.5 text-sm font-bold text-safe"
          >
            <div className="flex items-center gap-2">
              <IconCheck className="h-5 w-5 shrink-0" />
              <span>{priceToast}</span>
            </div>
            <button
              type="button"
              aria-label="Tutup pemberitahuan"
              onClick={() => setPriceToast(null)}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-safe-border bg-surface text-safe hover:bg-safe hover:text-ink-inverse"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {priceError ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border-2 border-danger-border bg-danger-bg px-3.5 py-2.5 text-sm font-bold text-danger"
          >
            {priceError}
          </p>
        ) : null}

        {eggs.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border-subtle bg-tray p-4 text-center text-sm font-medium text-ink-muted">
            Belum ada jenis telur aktif untuk diatur harganya.
          </p>
        ) : (
          <form onSubmit={handleSavePrices} className="mt-4 space-y-3">
            <div className="space-y-2.5">
              {eggs.map((egg) => {
                const draft = drafts[egg.id] ?? {
                  cost: String(egg.cost_per_kg),
                  price: String(egg.price_per_kg),
                };
                const numCost = Number(draft.cost) || 0;
                const numPrice = Number(draft.price) || 0;
                const margin = numPrice - numCost;
                const isModified =
                  Math.round(numCost) !== Math.round(egg.cost_per_kg) ||
                  Math.round(numPrice) !== Math.round(egg.price_per_kg);

                return (
                  <div
                    key={egg.id}
                    className={`rounded-lg border-2 p-3.5 transition-colors duration-150 ${
                      isModified
                        ? "border-accent bg-accent-soft/35"
                        : "border-border-subtle bg-tray/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-base font-bold text-ink">
                          {egg.name}
                        </p>
                        <p className="tabular-nums text-xs font-semibold text-ink-muted">
                          Stok saat ini: {formatKg(egg.stock_kg)} kg
                        </p>
                      </div>

                      <span
                        className={`tabular-nums rounded-md border px-2.5 py-1 text-xs font-bold ${
                          margin > 0
                            ? "border-safe-border bg-safe-bg text-safe"
                            : "border-danger-border bg-danger-bg text-danger"
                        }`}
                      >
                        Margin {margin >= 0 ? "+" : ""}
                        {formatRupiah(margin)}/kg
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor={`cost-${egg.id}`}
                          className="block text-xs font-bold text-ink-muted"
                        >
                          Harga Modal / kg
                        </label>
                        <input
                          id={`cost-${egg.id}`}
                          type="number"
                          inputMode="numeric"
                          step="100"
                          min="1000"
                          required
                          value={draft.cost}
                          onChange={(e) =>
                            handleDraftChange(egg.id, "cost", e.target.value)
                          }
                          className="tabular-nums mt-1 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3 text-base font-bold text-ink"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`price-${egg.id}`}
                          className="block text-xs font-bold text-ink-muted"
                        >
                          Harga Jual / kg
                        </label>
                        <input
                          id={`price-${egg.id}`}
                          type="number"
                          inputMode="numeric"
                          step="100"
                          min="1000"
                          required
                          value={draft.price}
                          onChange={(e) =>
                            handleDraftChange(egg.id, "price", e.target.value)
                          }
                          className="tabular-nums mt-1 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3 text-base font-bold text-ink"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:justify-end">
              {changedEggs.length > 0 ? (
                <button
                  type="button"
                  disabled={isSavingPrices}
                  onClick={handleResetDrafts}
                  className="min-h-12 rounded-lg border-2 border-border-strong bg-tray px-4 text-sm font-bold text-ink hover:bg-surface disabled:opacity-50"
                >
                  Batalkan Perubahan
                </button>
              ) : null}

              <button
                type="submit"
                disabled={isSavingPrices || changedEggs.length === 0}
                className="min-h-14 rounded-lg border-2 border-accent bg-accent px-6 text-base font-extrabold text-ink-inverse transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
              >
                {isSavingPrices
                  ? "Menyimpan Harga…"
                  : changedEggs.length > 0
                    ? `Simpan ${changedEggs.length} Harga Berubah`
                    : "Semua Harga Sudah Terbaru"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
