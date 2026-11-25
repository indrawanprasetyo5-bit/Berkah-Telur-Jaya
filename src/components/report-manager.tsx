"use client";

import { useMemo, useState, useTransition } from "react";
import type { DailyClosing, PaymentMethod } from "@/types/database";
import type { SaleWithItems } from "@/lib/demo-data";
import {
  formatDateTimeWib,
  formatKg,
  formatReceiptNo,
  formatRupiah,
  getJakartaDateKey,
  type ThermalReceiptData,
} from "@/lib/format";
import { saveDailyClosing } from "@/app/(app)/laporan/actions";
import { exportSalesToExcel } from "@/lib/export-excel";
import {
  IconCheck,
  IconClose,
  IconDownload,
  IconReceipt,
} from "@/components/icons";
import { ReceiptModal } from "@/components/receipt-modal";

export interface TodayClosingContext {
  closingDate: string;
  cashSalesToday: number;
  qrisTotalToday: number;
  transferTotalToday: number;
  expensesToday: number;
  expectedCash: number;
  revenueToday: number;
  profitToday: number;
}

interface ReportManagerProps {
  salesHistory: SaleWithItems[];
  todayClosingContext: TodayClosingContext;
  initialClosing: DailyClosing | null;
  isOwner: boolean;
  isDemoLocal: boolean;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
};

function shiftDateKey(baseDateKey: string, deltaDays: number): string {
  const date = new Date(`${baseDateKey}T12:00:00+07:00`);
  date.setDate(date.getDate() + deltaDays);
  return getJakartaDateKey(date);
}

export function ReportManager({
  salesHistory,
  todayClosingContext,
  initialClosing,
  isOwner,
  isDemoLocal,
}: ReportManagerProps) {
  const [savedClosing, setSavedClosing] = useState<DailyClosing | null>(
    initialClosing
  );
  const [actualCashInput, setActualCashInput] = useState<string>(
    initialClosing ? String(Math.round(initialClosing.actual_cash)) : ""
  );
  const [closingNotes, setClosingNotes] = useState<string>(
    initialClosing?.notes ?? ""
  );
  const [closingError, setClosingError] = useState<string | null>(null);
  const [closingToast, setClosingToast] = useState<string | null>(null);
  const [isSavingClosing, startClosingTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<ThermalReceiptData | null>(
    null
  );

  const todayKey = todayClosingContext.closingDate;
  const [startDate, setStartDate] = useState<string>(() =>
    shiftDateKey(todayKey, -6)
  );
  const [endDate, setEndDate] = useState<string>(todayKey);

  const hasActualCashInput = actualCashInput.trim() !== "";
  const parsedActualCash = hasActualCashInput ? Number(actualCashInput) : 0;
  const cashDifference = hasActualCashInput
    ? Math.round(parsedActualCash - todayClosingContext.expectedCash)
    : 0;

  const filteredSales = useMemo(() => {
    return salesHistory.filter((sale) => {
      const dateKey = getJakartaDateKey(sale.created_at);
      if (startDate && dateKey < startDate) return false;
      if (endDate && dateKey > endDate) return false;
      return true;
    });
  }, [salesHistory, startDate, endDate]);

  const filteredTotals = useMemo(() => {
    let revenue = 0;
    let kg = 0;
    for (const sale of filteredSales) {
      revenue += sale.total_amount;
      for (const item of sale.items) {
        kg += item.qty_kg;
      }
    }
    return {
      revenue: Math.round(revenue),
      kg: Number(kg.toFixed(2)),
    };
  }, [filteredSales]);

  function applyQuickRange(daysBack: number | "all") {
    if (daysBack === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }
    setStartDate(shiftDateKey(todayKey, -daysBack));
    setEndDate(todayKey);
  }

  function handleSaveClosing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasActualCashInput || !Number.isFinite(parsedActualCash) || parsedActualCash < 0) {
      setClosingError("Masukkan jumlah uang tunai fisik di laci.");
      return;
    }

    setClosingError(null);
    setClosingToast(null);

    startClosingTransition(async () => {
      const result = await saveDailyClosing({
        closing_date: todayClosingContext.closingDate,
        expected_cash: todayClosingContext.expectedCash,
        actual_cash: parsedActualCash,
        total_expenses: todayClosingContext.expensesToday,
        qris_total: todayClosingContext.qrisTotalToday,
        transfer_total: todayClosingContext.transferTotalToday,
        total_revenue: todayClosingContext.revenueToday,
        total_profit: todayClosingContext.profitToday,
        notes: closingNotes,
      });

      if (!result.ok || !result.closing) {
        setClosingError(result.error ?? "Gagal menyimpan tutup kasir harian.");
        return;
      }

      setSavedClosing(result.closing);
      setClosingToast("Tutup kasir hari ini berhasil disimpan.");
    });
  }

  async function handleExportExcel() {
    if (filteredSales.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      await exportSalesToExcel({
        sales: filteredSales,
        isOwner,
        startDate,
        endDate,
        todayKey,
      });
    } finally {
      setIsExporting(false);
    }
  }

  function handleOpenSaleReceipt(sale: SaleWithItems) {
    const totalKg = Number(
      sale.items.reduce((sum, i) => sum + i.qty_kg, 0).toFixed(2)
    );
    setActiveReceipt({
      receiptNo: formatReceiptNo(sale.id, sale.created_at),
      createdAtIso: sale.created_at,
      cashierName: sale.cashier_name,
      paymentMethod: sale.payment_method,
      totalKg,
      totalAmount: sale.total_amount,
      cashReceived: sale.cash_received,
      changeAmount: sale.change_amount,
      items: sale.items.map((item) => ({
        eggName: item.egg_name,
        qtyKg: item.qty_kg,
        unitLabel: item.unit_label,
        isCracked: item.is_cracked,
        pricePerKg: item.price_per_kg,
        subtotal: item.subtotal,
      })),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Laporan &amp; Tutup Kasir
          </h1>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            Cocokkan uang fisik di laci harian dan pantau riwayat transaksi.
          </p>
        </div>
        <p className="tabular-nums text-xs font-bold text-ink-muted">
          Tanggal operasional: {todayKey}
          {isDemoLocal ? " (Demo Lokal)" : ""}
        </p>
      </div>

      <section
        aria-label="Form tutup kasir harian"
        className="rounded-xl border-2 border-border-strong bg-surface p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">Tutup Kasir Harian</h2>
          {savedClosing ? (
            <span className="rounded-md border border-safe-border bg-safe-bg px-2.5 py-1 text-xs font-bold text-safe">
              Sudah Ditutup ({formatDateTimeWib(savedClosing.created_at)} WIB)
            </span>
          ) : (
            <span className="rounded-md border border-warn-border bg-warn-bg px-2.5 py-1 text-xs font-bold text-warn">
              Belum Tutup Kasir
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="rounded-xl border-2 border-border-strong bg-tray p-4 md:col-span-6">
            <p className="text-xs font-bold text-ink-muted">
              Uang Tunai Seharusnya di Laci
            </p>
            <p className="tabular-nums mt-1 text-3xl font-extrabold leading-tight text-ink">
              {formatRupiah(todayClosingContext.expectedCash)}
            </p>
            <dl className="mt-3 space-y-1 border-t border-border-strong pt-2.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="font-semibold text-ink-muted">
                  Total Tunai Masuk
                </dt>
                <dd className="tabular-nums font-bold text-ink">
                  +{formatRupiah(todayClosingContext.cashSalesToday)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-semibold text-ink-muted">
                  Total Kas Keluar Hari Ini
                </dt>
                <dd className="tabular-nums font-bold text-danger">
                  -{formatRupiah(todayClosingContext.expensesToday)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-6">
            <div className="rounded-xl border-2 border-border-subtle bg-canvas p-4">
              <p className="text-xs font-bold text-ink-muted">Total QRIS</p>
              <p className="tabular-nums mt-1.5 text-xl font-extrabold text-ink">
                {formatRupiah(todayClosingContext.qrisTotalToday)}
              </p>
              <p className="mt-1 text-xs font-medium text-ink-muted">
                Masuk rekening QRIS
              </p>
            </div>

            <div className="rounded-xl border-2 border-border-subtle bg-canvas p-4">
              <p className="text-xs font-bold text-ink-muted">Total Transfer</p>
              <p className="tabular-nums mt-1.5 text-xl font-extrabold text-ink">
                {formatRupiah(todayClosingContext.transferTotalToday)}
              </p>
              <p className="mt-1 text-xs font-medium text-ink-muted">
                Masuk rekening bank
              </p>
            </div>
          </div>
        </div>

        {closingToast ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 flex items-center justify-between gap-3 rounded-lg border-2 border-safe-border bg-safe-bg px-3.5 py-2.5 text-sm font-bold text-safe"
          >
            <div className="flex items-center gap-2">
              <IconCheck className="h-5 w-5 shrink-0" />
              <span>{closingToast}</span>
            </div>
            <button
              type="button"
              aria-label="Tutup pemberitahuan"
              onClick={() => setClosingToast(null)}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-safe-border bg-surface text-safe hover:bg-safe hover:text-ink-inverse"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {closingError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border-2 border-danger-border bg-danger-bg px-3.5 py-2.5 text-sm font-bold text-danger"
          >
            {closingError}
          </p>
        ) : null}

        <form onSubmit={handleSaveClosing} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="actual-cash"
                  className="text-sm font-bold text-ink"
                >
                  Uang Fisik di Laci (Rp)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setActualCashInput(
                      String(Math.max(0, todayClosingContext.expectedCash))
                    )
                  }
                  className="min-h-11 rounded-lg border-2 border-border-strong bg-tray px-3 text-xs font-bold text-ink transition-colors duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent active:scale-[0.98]"
                >
                  Isi pas ({formatRupiah(Math.max(0, todayClosingContext.expectedCash))})
                </button>
              </div>
              <input
                id="actual-cash"
                type="number"
                inputMode="numeric"
                min="0"
                step="500"
                required
                placeholder="Hitung uang tunai lalu ketik di sini"
                value={actualCashInput}
                onChange={(e) => {
                  setActualCashInput(e.target.value);
                  setClosingError(null);
                }}
                className="tabular-nums mt-1.5 min-h-14 w-full rounded-lg border-2 border-border-strong bg-surface px-4 text-xl font-extrabold text-ink placeholder:text-sm placeholder:font-semibold placeholder:text-ink-muted"
              />
            </div>

            <div className="flex flex-col justify-end">
              <div
                className={`flex min-h-14 items-center justify-between rounded-lg border-2 px-4 py-2.5 ${
                  !hasActualCashInput
                    ? "border-border-subtle bg-tray text-ink-muted"
                    : cashDifference === 0
                      ? "border-safe-border bg-safe-bg text-safe"
                      : cashDifference > 0
                        ? "border-warn-border bg-warn-bg text-warn"
                        : "border-danger-border bg-danger-bg text-danger"
                }`}
              >
                <span className="text-sm font-bold">
                  {!hasActualCashInput
                    ? "Selisih Laci"
                    : cashDifference === 0
                      ? "Status: Pas 100%"
                      : cashDifference > 0
                        ? "Status: Lebih"
                        : "Status: Kurang"}
                </span>
                <span className="tabular-nums text-lg font-extrabold">
                  {!hasActualCashInput
                    ? "-"
                    : cashDifference === 0
                      ? "Rp 0"
                      : `${cashDifference > 0 ? "+" : "-"}${formatRupiah(
                          Math.abs(cashDifference)
                        )}`}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="closing-notes"
              className="block text-sm font-bold text-ink"
            >
              Catatan Tutup Kasir (opsional)
            </label>
            <input
              id="closing-notes"
              type="text"
              maxLength={160}
              placeholder="Contoh: Selisih Rp 1.000 receh kembalian"
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-base font-semibold text-ink placeholder:text-ink-muted"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingClosing}
            className="flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-accent bg-accent px-4 text-base font-extrabold text-ink-inverse transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {isSavingClosing
              ? "Menyimpan Tutup Kasir…"
              : savedClosing
                ? "Perbarui Tutup Kasir Hari Ini"
                : "Simpan Tutup Kasir Hari Ini"}
          </button>
        </form>
      </section>

      <section
        aria-label="Riwayat transaksi penjualan"
        className="rounded-xl border-2 border-border-strong bg-surface p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Riwayat Transaksi</h2>
            <p className="tabular-nums mt-0.5 text-xs font-semibold text-ink-muted">
              {filteredSales.length} transaksi / {formatKg(filteredTotals.kg)} kg
              / Total {formatRupiah(filteredTotals.revenue)}
            </p>
          </div>

          <button
            type="button"
            disabled={filteredSales.length === 0 || isExporting}
            onClick={handleExportExcel}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-ink px-4 py-2 text-sm font-bold text-ink-inverse transition-colors duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
          >
            <IconDownload className="h-4 w-4 shrink-0" />
            <span>
              {isExporting ? "Menyiapkan Excel…" : "Export Excel (.xlsx)"}
            </span>
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border-subtle bg-tray p-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyQuickRange(0)}
              className={`min-h-11 rounded-lg border-2 px-3 text-xs font-bold transition-colors duration-150 ${
                startDate === todayKey && endDate === todayKey
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border-strong bg-surface text-ink hover:bg-canvas"
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => applyQuickRange(6)}
              className={`min-h-11 rounded-lg border-2 px-3 text-xs font-bold transition-colors duration-150 ${
                startDate === shiftDateKey(todayKey, -6) && endDate === todayKey
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border-strong bg-surface text-ink hover:bg-canvas"
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => applyQuickRange("all")}
              className={`min-h-11 rounded-lg border-2 px-3 text-xs font-bold transition-colors duration-150 ${
                startDate === "" && endDate === ""
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border-strong bg-surface text-ink hover:bg-canvas"
              }`}
            >
              Semua
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
            <div>
              <label
                htmlFor="filter-start"
                className="block text-xs font-bold text-ink-muted"
              >
                Dari Tanggal
              </label>
              <input
                id="filter-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="tabular-nums mt-1 min-h-11 w-full rounded-lg border-2 border-border-strong bg-surface px-2.5 text-sm font-bold text-ink"
              />
            </div>
            <div>
              <label
                htmlFor="filter-end"
                className="block text-xs font-bold text-ink-muted"
              >
                Sampai Tanggal
              </label>
              <input
                id="filter-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="tabular-nums mt-1 min-h-11 w-full rounded-lg border-2 border-border-strong bg-surface px-2.5 text-sm font-bold text-ink"
              />
            </div>
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border-subtle bg-tray p-5 text-center text-sm font-medium text-ink-muted">
            Tidak ada transaksi pada rentang tanggal yang dipilih.
          </p>
        ) : (
          <ul className="mt-4 divide-y-2 divide-border-subtle">
            {filteredSales.map((sale) => {
              const totalKg = Number(
                sale.items.reduce((sum, i) => sum + i.qty_kg, 0).toFixed(2)
              );
              return (
                <li
                  key={sale.id}
                  className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-border-strong bg-tray px-2 py-0.5 text-xs font-bold text-ink">
                        {PAYMENT_LABELS[sale.payment_method]}
                      </span>
                      <span className="tabular-nums text-xs font-semibold text-ink-muted">
                        {formatDateTimeWib(sale.created_at)} WIB
                      </span>
                      <span className="tabular-nums text-xs font-bold text-ink-muted">
                        ({formatKg(totalKg)} kg)
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-ink">
                      {sale.items.map((item) => (
                        <span key={item.id} className="inline-flex items-center gap-1.5">
                          <span>
                            {item.egg_name} ({item.unit_label})
                          </span>
                          {item.is_cracked ? (
                            <span className="rounded-md border border-warn-border bg-warn-bg px-1.5 py-0.5 text-[11px] font-bold text-warn">
                              Retak
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="tabular-nums text-base font-extrabold text-ink">
                        {formatRupiah(sale.total_amount)}
                      </p>
                      {isOwner ? (
                        <p className="tabular-nums text-xs font-semibold text-safe">
                          Laba kotor{" "}
                          {formatRupiah(sale.total_amount - sale.total_cost)}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenSaleReceipt(sale)}
                      aria-label={`Lihat struk transaksi ${formatReceiptNo(sale.id, sale.created_at)}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-border-strong bg-tray px-3 text-xs font-bold text-ink transition-colors duration-150 hover:border-ink hover:bg-surface active:scale-[0.98]"
                    >
                      <IconReceipt className="h-4 w-4 shrink-0" />
                      <span>Struk</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
}
