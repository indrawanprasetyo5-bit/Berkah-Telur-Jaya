"use client";

import { useMemo, useState, useTransition } from "react";
import type { EggType, PaymentMethod } from "@/types/database";
import {
  buildRestockWhatsAppUrl,
  buildSaleReceiptWhatsAppUrl,
  formatKg,
  formatPeti,
  formatReceiptNo,
  formatRupiah,
  getStockStatus,
  type ThermalReceiptData,
} from "@/lib/format";
import { createSaleTransaction } from "@/app/(app)/actions";
import {
  IconAlert,
  IconCheck,
  IconReceipt,
  IconTrash,
  IconWhatsApp,
} from "@/components/icons";
import { ReceiptModal } from "@/components/receipt-modal";

interface CashierPosProps {
  initialEggs: EggType[];
  cashierName: string;
  isDemoLocal: boolean;
}

type InputMode = "kg" | "rupiah";

interface CartItem {
  key: string;
  eggTypeId: string;
  eggName: string;
  qtyKg: number;
  unitLabel: string;
  isCracked: boolean;
  pricePerKg: number;
  costPerKg: number;
  subtotal: number;
}

const KG_PRESETS = [
  { label: "¼ kg", qty: 0.25 },
  { label: "½ kg", qty: 0.5 },
  { label: "1 kg", qty: 1 },
  { label: "2 kg", qty: 2 },
  { label: "1 Tray", sublabel: "~1,8 kg", qty: 1.8 },
] as const;

const RUPIAH_PRESETS = [10000, 15000, 20000, 50000] as const;
const CASH_QUICK_AMOUNTS = [20000, 50000, 100000] as const;
const CRACKED_DISCOUNT_OPTIONS = [20, 30, 40] as const;

function roundToNearest500(value: number): number {
  return Math.max(1000, Math.round(value / 500) * 500);
}

export function CashierPos({
  initialEggs,
  cashierName,
  isDemoLocal,
}: CashierPosProps) {
  const [eggs, setEggs] = useState<EggType[]>(initialEggs);
  const [selectedEggId, setSelectedEggId] = useState<string>(
    initialEggs[0]?.id ?? ""
  );
  const [inputMode, setInputMode] = useState<InputMode>("kg");

  const [isCracked, setIsCracked] = useState(false);
  const [crackedDiscountPct, setCrackedDiscountPct] = useState<number>(30);
  const [customDiscountPctInput, setCustomDiscountPctInput] =
    useState<string>("");
  const [manualCrackedPrice, setManualCrackedPrice] = useState<string>("");

  const [customKg, setCustomKg] = useState<string>("");
  const [customRupiah, setCustomRupiah] = useState<string>("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashInput, setCashInput] = useState<string>("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ThermalReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();

  const selectedEgg = useMemo(
    () => eggs.find((e) => e.id === selectedEggId) ?? eggs[0] ?? null,
    [eggs, selectedEggId]
  );

  const inCartKgForSelectedEgg = useMemo(() => {
    if (!selectedEgg) return 0;
    return Number(
      cart
        .filter((item) => item.eggTypeId === selectedEgg.id)
        .reduce((sum, item) => sum + item.qtyKg, 0)
        .toFixed(2)
    );
  }, [cart, selectedEgg]);

  const remainingStockForSelectedEgg = useMemo(() => {
    if (!selectedEgg) return 0;
    return Math.max(
      0,
      Number((selectedEgg.stock_kg - inCartKgForSelectedEgg).toFixed(2))
    );
  }, [selectedEgg, inCartKgForSelectedEgg]);

  const criticalEggs = useMemo(
    () => eggs.filter((e) => e.stock_kg < e.min_stock_kg),
    [eggs]
  );

  const activePricePerKg = useMemo(() => {
    if (!selectedEgg) return 0;
    if (!isCracked) return selectedEgg.price_per_kg;
    const parsedManual = Number(manualCrackedPrice);
    if (manualCrackedPrice.trim() !== "" && parsedManual > 0) {
      return Math.round(parsedManual);
    }
    const safePct = Math.min(90, Math.max(1, crackedDiscountPct));
    return roundToNearest500(selectedEgg.price_per_kg * (1 - safePct / 100));
  }, [selectedEgg, isCracked, crackedDiscountPct, manualCrackedPrice]);

  function handleCustomDiscountPctChange(rawValue: string) {
    const digitsOnly = rawValue.replace(/[^0-9]/g, "");
    if (digitsOnly === "") {
      setCustomDiscountPctInput("");
      return;
    }
    const parsed = Number(digitsOnly);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setCustomDiscountPctInput("");
      return;
    }
    const clamped = Math.min(90, parsed);
    setCustomDiscountPctInput(String(clamped));
    setCrackedDiscountPct(clamped);
    setManualCrackedPrice("");
  }

  const totalAmount = useMemo(
    () => Math.round(cart.reduce((sum, item) => sum + item.subtotal, 0)),
    [cart]
  );

  const totalKg = useMemo(
    () => Number(cart.reduce((sum, item) => sum + item.qtyKg, 0).toFixed(2)),
    [cart]
  );

  const parsedCashInput = cashInput.trim() === "" ? 0 : Number(cashInput);
  const effectiveCashReceived =
    paymentMethod === "cash"
      ? cashInput.trim() === ""
        ? totalAmount
        : parsedCashInput
      : 0;
  const cashShortage =
    paymentMethod === "cash" &&
    cashInput.trim() !== "" &&
    parsedCashInput < totalAmount
      ? totalAmount - parsedCashInput
      : 0;
  const changeAmount =
    paymentMethod === "cash" && effectiveCashReceived >= totalAmount
      ? effectiveCashReceived - totalAmount
      : 0;

  function addItemToCart(qtyKg: number, subtotal: number, baseLabel: string) {
    if (!selectedEgg) return;
    if (qtyKg <= 0 || subtotal <= 0) {
      setErrorMsg("Masukkan jumlah berat atau nominal rupiah yang valid.");
      return;
    }

    const roundedQty = Number(qtyKg.toFixed(2));
    if (roundedQty > remainingStockForSelectedEgg) {
      setErrorMsg(
        `Stok ${selectedEgg.name} tidak mencukupi. Tersisa ${formatKg(remainingStockForSelectedEgg)} kg yang belum masuk keranjang.`
      );
      return;
    }

    setErrorMsg(null);
    setReceipt(null);

    const roundedSubtotal = Math.round(subtotal);
    const label = isCracked ? `Retak (${baseLabel})` : baseLabel;

    setCart((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        eggTypeId: selectedEgg.id,
        eggName: selectedEgg.name,
        qtyKg: roundedQty,
        unitLabel: label,
        isCracked,
        pricePerKg: activePricePerKg,
        costPerKg: selectedEgg.cost_per_kg,
        subtotal: roundedSubtotal,
      },
    ]);
  }

  function handleKgPreset(qty: number, label: string) {
    if (!selectedEgg) return;
    addItemToCart(qty, qty * activePricePerKg, label);
  }

  function handleCustomKgAdd(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(customKg.replace(",", "."));
    if (!qty || qty <= 0) {
      setErrorMsg("Berat kg harus lebih dari 0.");
      return;
    }
    addItemToCart(qty, qty * activePricePerKg, `${formatKg(qty)} kg`);
    setCustomKg("");
  }

  function handleRupiahPreset(nominal: number) {
    if (!selectedEgg || activePricePerKg <= 0) return;
    const estKg = Math.max(0.05, nominal / activePricePerKg);
    const shortRp =
      nominal >= 1000 && nominal % 1000 === 0
        ? `Rp ${nominal / 1000}rb`
        : formatRupiah(nominal);
    addItemToCart(estKg, nominal, shortRp);
  }

  function handleCustomRupiahAdd(e: React.FormEvent) {
    e.preventDefault();
    const nominal = Number(customRupiah);
    if (!nominal || nominal < 1000 || activePricePerKg <= 0) {
      setErrorMsg("Nominal pembelian minimal Rp 1.000.");
      return;
    }
    const estKg = Math.max(0.05, nominal / activePricePerKg);
    addItemToCart(estKg, nominal, formatRupiah(nominal));
    setCustomRupiah("");
  }

  function handleRemoveCartItem(key: string) {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }

  function handleClearCart() {
    setCart([]);
    setCashInput("");
    setErrorMsg(null);
  }

  function handleSaveSale() {
    if (cart.length === 0) return;
    if (cashShortage > 0) {
      setErrorMsg(`Uang tunai kurang ${formatRupiah(cashShortage)}.`);
      return;
    }

    setErrorMsg(null);

    startSaveTransition(async () => {
      const result = await createSaleTransaction({
        items: cart.map((item) => ({
          egg_type_id: item.eggTypeId,
          qty_kg: item.qtyKg,
          unit_label: item.unitLabel,
          is_cracked: item.isCracked,
          price_per_kg: item.pricePerKg,
          cost_per_kg: item.costPerKg,
          subtotal: item.subtotal,
        })),
        payment_method: paymentMethod,
        cash_received: effectiveCashReceived,
      });

      if (!result.ok) {
        setErrorMsg(result.error ?? "Transaksi gagal disimpan.");
        return;
      }

      if (result.updatedEggs) {
        setEggs(result.updatedEggs);
      } else if (isDemoLocal) {
        // Mode demo tidak punya trigger DB, jadi stok dikurangi di client.
        setEggs((prev) =>
          prev.map((egg) => {
            const soldKg = cart
              .filter((c) => c.eggTypeId === egg.id)
              .reduce((sum, c) => sum + c.qtyKg, 0);
            if (soldKg <= 0) return egg;
            return {
              ...egg,
              stock_kg: Math.max(0, Number((egg.stock_kg - soldKg).toFixed(2))),
            };
          })
        );
      }

      const createdAtIso = new Date().toISOString();
      const saleId = result.saleId ?? `demo-${Date.now()}`;
      const finalTotal = result.totalAmount ?? totalAmount;
      const finalChange = result.changeAmount ?? changeAmount;

      setReceipt({
        receiptNo: formatReceiptNo(saleId, createdAtIso),
        createdAtIso,
        cashierName,
        paymentMethod,
        totalKg,
        totalAmount: finalTotal,
        cashReceived: paymentMethod === "cash" ? effectiveCashReceived : 0,
        changeAmount: finalChange,
        items: cart.map((item) => ({
          eggName: item.eggName,
          qtyKg: item.qtyKg,
          unitLabel: item.unitLabel,
          isCracked: item.isCracked,
          pricePerKg: item.pricePerKg,
          subtotal: item.subtotal,
        })),
      });
      setIsReceiptOpen(true);
      setCart([]);
      setCashInput("");
      setIsCracked(false);
      setCustomDiscountPctInput("");
      setManualCrackedPrice("");
    });
  }

  if (eggs.length === 0) {
    return (
      <section className="rounded-xl border-2 border-border-strong bg-surface p-6 text-center">
        <h1 className="text-xl font-extrabold text-ink">
          Belum Ada Jenis Telur Aktif
        </h1>
        <p className="mt-2 text-sm font-medium text-ink-muted">
          Jalankan supabase/seed.sql atau tambahkan jenis telur terlebih dahulu
          agar kasir dapat digunakan.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {criticalEggs.length > 0 && (
        <section
          aria-label="Peringatan stok telur menipis"
          className="rounded-xl border-2 border-danger-border bg-danger-bg p-3.5"
        >
          <div className="flex items-start gap-2.5">
            <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div>
                <h2 className="text-sm font-extrabold text-danger">
                  Stok di Bawah Batas Minimum ({criticalEggs.length} jenis)
                </h2>
                <p className="text-xs font-semibold text-danger">
                  Segera pesan kiriman mobil dari gudang sebelum habis.
                </p>
              </div>

              <div className="space-y-2">
                {criticalEggs.map((egg) => (
                  <div
                    key={egg.id}
                    className="flex flex-col gap-2 rounded-lg border border-danger-border bg-surface p-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">{egg.name}</p>
                      <p className="tabular-nums text-xs font-bold text-danger">
                        Sisa {formatKg(egg.stock_kg)} kg (~
                        {formatPeti(egg.stock_kg, egg.kg_per_peti)} peti) dari
                        min {formatKg(egg.min_stock_kg)} kg
                      </p>
                    </div>
                    <a
                      href={buildRestockWhatsAppUrl(egg, 5)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-wa bg-wa px-3.5 py-2 text-sm font-bold text-ink-inverse transition-colors duration-150 hover:bg-wa-hover active:scale-[0.98]"
                    >
                      <IconWhatsApp className="h-4 w-4 shrink-0" />
                      <span>Minta Kirim WA</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {receipt && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-xl border-2 border-safe-border bg-safe-bg px-4 py-3 text-safe sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <IconCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-extrabold">
                Transaksi {receipt.receiptNo} tersimpan (
                <span className="tabular-nums">
                  {formatRupiah(receipt.totalAmount)}
                </span>
                )
              </p>
              <p className="mt-0.5 tabular-nums text-xs font-bold">
                {receipt.paymentMethod === "cash"
                  ? receipt.changeAmount > 0
                    ? `Tunai. Kembalian: ${formatRupiah(receipt.changeAmount)}`
                    : "Tunai (Uang Pas). Stok otomatis berkurang."
                  : `Dibayar via ${receipt.paymentMethod.toUpperCase()}. Stok otomatis berkurang.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsReceiptOpen(true)}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-ink bg-ink px-3.5 text-xs font-bold text-ink-inverse transition-colors duration-150 hover:opacity-90 active:scale-[0.98] sm:flex-none"
            >
              <IconReceipt className="h-4 w-4 shrink-0" />
              <span>Lihat Struk</span>
            </button>

            <a
              href={buildSaleReceiptWhatsAppUrl(receipt)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-wa bg-wa px-3.5 text-xs font-bold text-ink-inverse transition-colors duration-150 hover:bg-wa-hover active:scale-[0.98] sm:flex-none"
            >
              <IconWhatsApp className="h-4 w-4 shrink-0" />
              <span>Kirim WA</span>
            </a>

            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="min-h-11 shrink-0 rounded-lg border border-safe-border bg-surface px-3 text-xs font-bold text-safe hover:bg-safe hover:text-ink-inverse"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border-2 border-danger-border bg-danger-bg px-4 py-3 text-sm font-bold text-danger"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-7">
          <section
            aria-label="Pilih jenis telur"
            className="rounded-xl border-2 border-border-strong bg-surface p-3.5"
          >
            <div className="mb-2.5 flex items-baseline justify-between">
              <h1 className="text-base font-extrabold text-ink">
                1. Pilih Jenis Telur
              </h1>
              <span className="text-xs font-semibold text-ink-muted">
                Harga per kg hari ini
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {eggs.map((egg) => {
                const isSelected = selectedEgg?.id === egg.id;
                const status = getStockStatus(egg);
                const statusClass =
                  status === "critical"
                    ? "border-danger-border bg-danger-bg text-danger"
                    : status === "low"
                      ? "border-warn-border bg-warn-bg text-warn"
                      : "border-safe-border bg-safe-bg text-safe";

                return (
                  <button
                    key={egg.id}
                    type="button"
                    onClick={() => {
                      setSelectedEggId(egg.id);
                      setManualCrackedPrice("");
                    }}
                    aria-pressed={isSelected}
                    className={`flex min-h-22 flex-col justify-between rounded-lg border-2 p-3 text-left transition-colors duration-150 active:scale-[0.98] ${
                      isSelected
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-border-strong bg-canvas text-ink hover:border-ink"
                    }`}
                  >
                    <span className="text-sm font-extrabold leading-snug">
                      {egg.name}
                    </span>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                      <span className="tabular-nums text-sm font-extrabold text-ink">
                        {formatRupiah(egg.price_per_kg)}
                      </span>
                      <span
                        className={`tabular-nums rounded-md border px-1.5 py-0.5 text-xs font-bold ${statusClass}`}
                      >
                        {formatKg(egg.stock_kg)} kg
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedEgg && (
            <section
              aria-label="Pilih jumlah pembelian"
              className="rounded-xl border-2 border-border-strong bg-surface p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-ink">
                  2. Ketuk Jumlah ({selectedEgg.name})
                </h2>
                <span className="tabular-nums text-sm font-extrabold text-accent">
                  {formatRupiah(activePricePerKg)}/kg
                </span>
              </div>

              <div
                role="tablist"
                aria-label="Mode input kasir"
                className="mt-3 grid grid-cols-2 gap-2 rounded-lg border-2 border-border-strong bg-tray p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === "kg"}
                  onClick={() => setInputMode("kg")}
                  className={`min-h-12 rounded-md px-3 text-sm font-extrabold transition-colors duration-150 ${
                    inputMode === "kg"
                      ? "bg-ink text-ink-inverse"
                      : "text-ink hover:bg-surface"
                  }`}
                >
                  Mode Kiloan
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === "rupiah"}
                  onClick={() => setInputMode("rupiah")}
                  className={`min-h-12 rounded-md px-3 text-sm font-extrabold transition-colors duration-150 ${
                    inputMode === "rupiah"
                      ? "bg-ink text-ink-inverse"
                      : "text-ink hover:bg-surface"
                  }`}
                >
                  Mode Beli Rupiah
                </button>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isCracked}
                  onClick={() => setIsCracked((prev) => !prev)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-lg border-2 px-3.5 py-2 text-left transition-colors duration-150 ${
                    isCracked
                      ? "border-warn-border bg-warn-bg text-warn"
                      : "border-border-strong bg-canvas text-ink hover:border-ink"
                  }`}
                >
                  <div>
                    <span className="block text-sm font-extrabold">
                      Mode Telur Retak (Harga Diskon)
                    </span>
                    <span className="block text-xs font-semibold opacity-90">
                      {isCracked
                        ? `Aktif: ${formatRupiah(activePricePerKg)}/kg (tetap masuk omzet)`
                        : "Aktifkan jika menjual telur retak harga miring"}
                    </span>
                  </div>
                  <span
                    className={`rounded-md border px-2.5 py-1 text-xs font-extrabold ${
                      isCracked
                        ? "border-warn bg-warn text-ink-inverse"
                        : "border-border-strong bg-surface text-ink-muted"
                    }`}
                  >
                    {isCracked ? "AKTIF" : "MATI"}
                  </span>
                </button>

                {isCracked && (
                  <div className="mt-2.5 space-y-2.5 rounded-lg border-2 border-warn-border bg-warn-bg p-3">
                    <div className="grid grid-cols-4 gap-2">
                      {CRACKED_DISCOUNT_OPTIONS.map((pct) => {
                        const active =
                          manualCrackedPrice.trim() === "" &&
                          customDiscountPctInput === "" &&
                          crackedDiscountPct === pct;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setCrackedDiscountPct(pct);
                              setCustomDiscountPctInput("");
                              setManualCrackedPrice("");
                            }}
                            className={`min-h-11 rounded-lg border-2 px-1 text-xs font-extrabold transition-colors duration-150 ${
                              active
                                ? "border-warn bg-warn text-ink-inverse"
                                : "border-warn-border bg-surface text-warn"
                            }`}
                          >
                            {pct}%
                          </button>
                        );
                      })}

                      <div className="relative flex items-center">
                        <label
                          htmlFor="custom-discount-pct"
                          className="sr-only"
                        >
                          Persen diskon bebas (1 sampai 90 persen)
                        </label>
                        <input
                          id="custom-discount-pct"
                          type="text"
                          inputMode="numeric"
                          maxLength={2}
                          value={customDiscountPctInput}
                          onChange={(e) =>
                            handleCustomDiscountPctChange(e.target.value)
                          }
                          placeholder="1-90"
                          className={`tabular-nums min-h-11 w-full rounded-lg border-2 bg-surface pr-6 pl-2 text-center text-xs font-extrabold text-ink placeholder:font-semibold placeholder:text-ink-muted ${
                            manualCrackedPrice.trim() === "" &&
                            customDiscountPctInput !== ""
                              ? "border-warn ring-1 ring-warn"
                              : "border-warn-border"
                          }`}
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-2 text-xs font-extrabold text-warn"
                        >
                          %
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="manual-cracked-price"
                        className="shrink-0 text-xs font-bold text-warn"
                      >
                        Atau harga/kg:
                      </label>
                      <input
                        id="manual-cracked-price"
                        type="number"
                        inputMode="numeric"
                        min={1000}
                        step={500}
                        value={manualCrackedPrice}
                        onChange={(e) => setManualCrackedPrice(e.target.value)}
                        placeholder={`${roundToNearest500(
                          selectedEgg.price_per_kg *
                            (1 -
                              Math.min(90, Math.max(1, crackedDiscountPct)) /
                                100)
                        )}`}
                        className="tabular-nums min-h-11 w-full rounded-lg border-2 border-warn-border bg-surface px-3 text-sm font-bold text-ink"
                      />
                    </div>
                  </div>
                )}
              </div>

              {inputMode === "kg" ? (
                <div className="mt-3.5 space-y-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    {KG_PRESETS.map((preset) => {
                      const outOfStock =
                        preset.qty > remainingStockForSelectedEgg;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          disabled={outOfStock}
                          onClick={() =>
                            handleKgPreset(preset.qty, preset.label)
                          }
                          className="flex min-h-16 flex-col items-center justify-center rounded-lg border-2 border-border-strong bg-canvas px-2 py-2.5 text-center transition-colors duration-150 hover:border-accent hover:bg-accent-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <span className="text-base font-extrabold text-ink">
                            {preset.label}
                          </span>
                          <span className="tabular-nums mt-0.5 text-xs font-bold text-ink-muted">
                            {formatRupiah(preset.qty * activePricePerKg)}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={
                        selectedEgg.kg_per_peti > remainingStockForSelectedEgg
                      }
                      onClick={() =>
                        handleKgPreset(
                          selectedEgg.kg_per_peti,
                          `1 Peti (${formatKg(selectedEgg.kg_per_peti)} kg)`
                        )
                      }
                      className="flex min-h-16 flex-col items-center justify-center rounded-lg border-2 border-border-strong bg-canvas px-2 py-2.5 text-center transition-colors duration-150 hover:border-accent hover:bg-accent-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="text-base font-extrabold text-ink">
                        1 Peti
                      </span>
                      <span className="tabular-nums mt-0.5 text-xs font-bold text-ink-muted">
                        {formatKg(selectedEgg.kg_per_peti)} kg
                      </span>
                    </button>
                  </div>

                  <form
                    onSubmit={handleCustomKgAdd}
                    className="flex items-stretch gap-2"
                  >
                    <label htmlFor="custom-kg" className="sr-only">
                      Berat kg bebas
                    </label>
                    <input
                      id="custom-kg"
                      type="number"
                      inputMode="decimal"
                      step="0.05"
                      min="0.05"
                      value={customKg}
                      onChange={(e) => setCustomKg(e.target.value)}
                      placeholder="Berat bebas (misal 1.5 kg)"
                      className="tabular-nums min-h-12 flex-1 rounded-lg border-2 border-border-strong bg-canvas px-3.5 text-base font-bold text-ink placeholder:font-medium placeholder:text-ink-muted"
                    />
                    <button
                      type="submit"
                      className="min-h-12 rounded-lg border-2 border-ink bg-ink px-4 text-sm font-extrabold text-ink-inverse transition-colors duration-150 hover:bg-ink-muted active:scale-[0.98]"
                    >
                      Tambah
                    </button>
                  </form>
                </div>
              ) : (
                <div className="mt-3.5 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {RUPIAH_PRESETS.map((nominal) => {
                      const estKg =
                        activePricePerKg > 0
                          ? Math.max(0.05, nominal / activePricePerKg)
                          : 0;
                      const outOfStock =
                        Number(estKg.toFixed(2)) > remainingStockForSelectedEgg;
                      return (
                        <button
                          key={nominal}
                          type="button"
                          disabled={outOfStock}
                          onClick={() => handleRupiahPreset(nominal)}
                          className="flex min-h-16 flex-col items-center justify-center rounded-lg border-2 border-border-strong bg-canvas px-3 py-2.5 text-center transition-colors duration-150 hover:border-accent hover:bg-accent-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <span className="tabular-nums text-lg font-extrabold text-ink">
                            {formatRupiah(nominal)}
                          </span>
                          <span className="tabular-nums mt-0.5 text-xs font-bold text-ink-muted">
                            ~{formatKg(estKg)} kg keluar stok
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={handleCustomRupiahAdd}
                    className="flex items-stretch gap-2"
                  >
                    <label htmlFor="custom-rupiah" className="sr-only">
                      Nominal rupiah bebas
                    </label>
                    <input
                      id="custom-rupiah"
                      type="number"
                      inputMode="numeric"
                      step="500"
                      min="1000"
                      value={customRupiah}
                      onChange={(e) => setCustomRupiah(e.target.value)}
                      placeholder="Nominal bebas (misal 35000)"
                      className="tabular-nums min-h-12 flex-1 rounded-lg border-2 border-border-strong bg-canvas px-3.5 text-base font-bold text-ink placeholder:font-medium placeholder:text-ink-muted"
                    />
                    <button
                      type="submit"
                      className="min-h-12 rounded-lg border-2 border-ink bg-ink px-4 text-sm font-extrabold text-ink-inverse transition-colors duration-150 hover:bg-ink-muted active:scale-[0.98]"
                    >
                      Tambah
                    </button>
                  </form>
                </div>
              )}
            </section>
          )}
        </div>

        <section
          aria-label="Ringkasan transaksi dan pembayaran"
          className="rounded-xl border-2 border-border-strong bg-surface p-4 lg:sticky lg:top-6 lg:col-span-5"
        >
          <div className="flex items-center justify-between border-b-2 border-border-subtle pb-3">
            <div>
              <h2 className="text-base font-extrabold text-ink">
                3. Bayar &amp; Simpan
              </h2>
              <p className="tabular-nums text-xs font-semibold text-ink-muted">
                {cart.length} item ({formatKg(totalKg)} kg)
              </p>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="min-h-11 rounded-lg border-2 border-border-strong bg-tray px-3 text-xs font-bold text-ink hover:border-danger hover:text-danger"
              >
                Kosongkan
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="my-4 rounded-lg border-2 border-dashed border-border-strong bg-canvas px-4 py-6 text-center">
              <p className="text-sm font-bold text-ink">
                Belum ada item di transaksi
              </p>
              <p className="mt-1 text-xs font-medium text-ink-muted">
                Ketuk tombol kiloan atau nominal rupiah di atas untuk langsung
                menghitung total.
              </p>
            </div>
          ) : (
            <ul className="my-3 divide-y divide-border-subtle">
              {cart.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {item.eggName}
                    </p>
                    <p className="tabular-nums text-xs font-semibold text-ink-muted">
                      {item.unitLabel} ({formatKg(item.qtyKg)} kg)
                      {item.isCracked ? " · Harga Retak" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-sm font-extrabold text-ink">
                      {formatRupiah(item.subtotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCartItem(item.key)}
                      aria-label={`Hapus ${item.eggName} ${item.unitLabel}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-border-strong bg-canvas text-ink-muted hover:border-danger hover:bg-danger-bg hover:text-danger"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-baseline justify-between rounded-lg border-2 border-border-strong bg-tray px-3.5 py-3">
            <span className="text-sm font-extrabold text-ink">
              Total Bayar
            </span>
            <span className="tabular-nums text-3xl font-extrabold tracking-tight text-ink">
              {formatRupiah(totalAmount)}
            </span>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink-muted">
              Metode Pembayaran
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "cash", label: "Tunai" },
                  { id: "qris", label: "QRIS" },
                  { id: "transfer", label: "Transfer" },
                ] as const
              ).map((method) => {
                const active = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`min-h-12 rounded-lg border-2 text-sm font-extrabold transition-colors duration-150 ${
                      active
                        ? "border-accent bg-accent text-ink-inverse"
                        : "border-border-strong bg-canvas text-ink hover:border-ink"
                    }`}
                  >
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div className="mt-4 space-y-2.5 rounded-lg border-2 border-border-strong bg-canvas p-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="cash-received"
                  className="text-xs font-extrabold text-ink"
                >
                  Uang Diterima (kosongkan jika uang pas)
                </label>
              </div>

              <input
                id="cash-received"
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                placeholder={
                  totalAmount > 0 ? `${totalAmount} (Uang Pas)` : "0"
                }
                className="tabular-nums min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-lg font-extrabold text-ink placeholder:font-semibold placeholder:text-ink-muted"
              />

              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCashInput("")}
                  className="min-h-11 rounded-md border-2 border-border-strong bg-surface px-1 text-xs font-bold text-ink hover:border-ink"
                >
                  Pas
                </button>
                {CASH_QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashInput(String(amt))}
                    className="tabular-nums min-h-11 rounded-md border-2 border-border-strong bg-surface px-1 text-xs font-bold text-ink hover:border-ink"
                  >
                    {amt / 1000}rb
                  </button>
                ))}
              </div>

              {totalAmount > 0 && (
                <div
                  className={`flex items-baseline justify-between rounded-md border-2 px-3 py-2 ${
                    cashShortage > 0
                      ? "border-danger-border bg-danger-bg text-danger"
                      : "border-safe-border bg-safe-bg text-safe"
                  }`}
                >
                  <span className="text-xs font-extrabold">
                    {cashShortage > 0 ? "Uang Kurang" : "Kembalian"}
                  </span>
                  <span className="tabular-nums text-lg font-extrabold">
                    {formatRupiah(
                      cashShortage > 0 ? cashShortage : changeAmount
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={cart.length === 0 || cashShortage > 0 || isSaving}
            onClick={handleSaveSale}
            className="mt-4 min-h-14 w-full rounded-lg border-2 border-accent bg-accent px-4 py-3 text-lg font-extrabold text-ink-inverse transition-colors duration-150 hover:bg-accent-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-tray disabled:text-ink-muted"
          >
            {isSaving
              ? "Menyimpan Transaksi…"
              : totalAmount > 0
                ? `Simpan & Bayar (${formatRupiah(totalAmount)})`
                : "Simpan & Bayar"}
          </button>
        </section>
      </div>

      <ReceiptModal
        receipt={isReceiptOpen ? receipt : null}
        onClose={() => setIsReceiptOpen(false)}
      />
    </div>
  );
}
