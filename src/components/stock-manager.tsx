"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  EggType,
  RestockDelivery,
  StockLoss,
  StockLossReason,
} from "@/types/database";
import {
  buildRestockWhatsAppUrl,
  formatDateTimeWib,
  formatKg,
  formatPeti,
  formatRupiah,
  getStockStatus,
  type StockStatus,
} from "@/lib/format";
import {
  recordRestockDelivery,
  recordStockLoss,
} from "@/app/(app)/stok/actions";
import {
  IconCheck,
  IconClose,
  IconLoss,
  IconTruck,
  IconWhatsApp,
} from "@/components/icons";

interface StockManagerProps {
  initialEggs: EggType[];
  initialDeliveries: RestockDelivery[];
  initialLosses: StockLoss[];
  isDemoLocal: boolean;
}

type ActiveModal = "restock" | "loss" | null;
type HistoryTab = "deliveries" | "losses";

const STATUS_META: Record<
  StockStatus,
  { label: string; badgeClass: string; order: number }
> = {
  critical: {
    label: "Kritis",
    badgeClass: "border-danger-border bg-danger-bg text-danger",
    order: 0,
  },
  low: {
    label: "Menipis",
    badgeClass: "border-warn-border bg-warn-bg text-warn",
    order: 1,
  },
  safe: {
    label: "Aman",
    badgeClass: "border-safe-border bg-safe-bg text-safe",
    order: 2,
  },
};

const LOSS_REASON_OPTIONS: { value: StockLossReason; label: string }[] = [
  { value: "pecah_lapak", label: "Pecah di Toko" },
  { value: "busuk", label: "Busuk" },
  { value: "lainnya", label: "Lainnya" },
];

const LOSS_REASON_LABELS: Record<StockLossReason, string> = {
  pecah_lapak: "Pecah di Toko",
  busuk: "Busuk",
  lainnya: "Lainnya",
};

const PETI_PRESETS = [2, 3, 5, 10] as const;
const LOSS_KG_PRESETS = [0.25, 0.5, 1, 2] as const;

export function StockManager({
  initialEggs,
  initialDeliveries,
  initialLosses,
  isDemoLocal,
}: StockManagerProps) {
  const [eggs, setEggs] = useState<EggType[]>(initialEggs);
  const [deliveries, setDeliveries] =
    useState<RestockDelivery[]>(initialDeliveries);
  const [losses, setLosses] = useState<StockLoss[]>(initialLosses);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [historyTab, setHistoryTab] = useState<HistoryTab>("deliveries");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [restockEggId, setRestockEggId] = useState<string>(
    initialEggs[0]?.id ?? ""
  );
  const [petiInput, setPetiInput] = useState<string>("5");
  const [costInput, setCostInput] = useState<string>(
    String(initialEggs[0]?.cost_per_kg ?? 25000)
  );
  const [supplierInput, setSupplierInput] = useState<string>("");
  const [driverInput, setDriverInput] = useState<string>("");
  const [brokenInput, setBrokenInput] = useState<string>("0");
  const [notesInput, setNotesInput] = useState<string>("");

  const [lossEggId, setLossEggId] = useState<string>(initialEggs[0]?.id ?? "");
  const [lossKgInput, setLossKgInput] = useState<string>("0.5");
  const [lossReason, setLossReason] = useState<StockLossReason>("pecah_lapak");

  const eggMap = useMemo(() => {
    const map = new Map<string, EggType>();
    for (const egg of eggs) {
      map.set(egg.id, egg);
    }
    return map;
  }, [eggs]);

  // Stok kritis ditaruh paling atas supaya langsung kelihatan.
  const sortedEggs = useMemo(() => {
    return [...eggs].sort((a, b) => {
      const diff =
        STATUS_META[getStockStatus(a)].order -
        STATUS_META[getStockStatus(b)].order;
      return diff !== 0 ? diff : a.name.localeCompare(b.name, "id");
    });
  }, [eggs]);

  const statusSummary = useMemo(() => {
    let critical = 0;
    let low = 0;
    let safe = 0;
    for (const egg of eggs) {
      const st = getStockStatus(egg);
      if (st === "critical") critical += 1;
      else if (st === "low") low += 1;
      else safe += 1;
    }
    return { critical, low, safe };
  }, [eggs]);

  useEffect(() => {
    if (!activeModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveModal(null);
        setModalError(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeModal]);

  function openRestockModal(eggId?: string) {
    const targetEgg =
      (eggId ? eggMap.get(eggId) : undefined) ?? sortedEggs[0] ?? eggs[0];
    if (targetEgg) {
      setRestockEggId(targetEgg.id);
      setCostInput(String(targetEgg.cost_per_kg));
    }
    setPetiInput("5");
    setSupplierInput("");
    setDriverInput("");
    setBrokenInput("0");
    setNotesInput("");
    setModalError(null);
    setActiveModal("restock");
  }

  function openLossModal(eggId?: string) {
    const targetEgg =
      (eggId ? eggMap.get(eggId) : undefined) ?? sortedEggs[0] ?? eggs[0];
    if (targetEgg) {
      setLossEggId(targetEgg.id);
    }
    setLossKgInput("0.5");
    setLossReason("pecah_lapak");
    setModalError(null);
    setActiveModal("loss");
  }

  function handleRestockEggChange(newEggId: string) {
    setRestockEggId(newEggId);
    const chosen = eggMap.get(newEggId);
    if (chosen) {
      setCostInput(String(chosen.cost_per_kg));
    }
  }

  const selectedRestockEgg = eggMap.get(restockEggId) ?? eggs[0] ?? null;
  const parsedPeti = Number(petiInput) || 0;
  const kgPerPeti = selectedRestockEgg?.kg_per_peti ?? 15;
  const computedRestockKg = Number((parsedPeti * kgPerPeti).toFixed(2));
  const parsedBrokenKg = Number(brokenInput) || 0;
  const netRestockKg = Math.max(
    0,
    Number((computedRestockKg - parsedBrokenKg).toFixed(2))
  );
  const parsedCostPerKg = Number(costInput) || 0;
  const estimatedRestockValue = Math.round(netRestockKg * parsedCostPerKg);

  const selectedLossEgg = eggMap.get(lossEggId) ?? eggs[0] ?? null;
  const parsedLossKg = Number(lossKgInput) || 0;
  const estimatedLossCost = Math.round(
    parsedLossKg * (selectedLossEgg?.cost_per_kg ?? 0)
  );

  function handleSubmitRestock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedRestockEgg) return;

    if (parsedPeti <= 0) {
      setModalError("Masukkan jumlah peti lebih dari 0.");
      return;
    }
    if (parsedCostPerKg <= 0) {
      setModalError("Masukkan harga modal per kg hari ini.");
      return;
    }
    if (!supplierInput.trim()) {
      setModalError("Isi nama gudang atau distributor.");
      return;
    }
    if (parsedBrokenKg < 0 || parsedBrokenKg > computedRestockKg) {
      setModalError("Telur pecah tidak boleh minus atau melebihi total kg.");
      return;
    }

    setModalError(null);

    startTransition(async () => {
      const result = await recordRestockDelivery({
        egg_type_id: selectedRestockEgg.id,
        peti_count: parsedPeti,
        qty_kg: computedRestockKg,
        cost_per_kg: parsedCostPerKg,
        supplier_name: supplierInput.trim(),
        driver_name: driverInput.trim(),
        broken_kg: parsedBrokenKg,
        notes: notesInput.trim(),
      });

      if (!result.ok || !result.delivery) {
        setModalError(result.error ?? "Gagal mencatat kiriman mobil.");
        return;
      }

      if (result.updatedEggs) {
        setEggs(result.updatedEggs);
      } else if (isDemoLocal) {
        setEggs((prev) =>
          prev.map((egg) =>
            egg.id === selectedRestockEgg.id
              ? {
                  ...egg,
                  stock_kg: Number((egg.stock_kg + netRestockKg).toFixed(2)),
                  cost_per_kg: Math.round(parsedCostPerKg),
                  updated_at: new Date().toISOString(),
                }
              : egg
          )
        );
      }

      setDeliveries((prev) => [result.delivery!, ...prev].slice(0, 15));
      setHistoryTab("deliveries");
      setActiveModal(null);
      setToastMsg(
        `Kiriman ${selectedRestockEgg.name} (+${formatKg(netRestockKg)} kg bersih) berhasil dicatat.`
      );
    });
  }

  function handleSubmitLoss(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLossEgg) return;

    if (parsedLossKg <= 0) {
      setModalError("Masukkan jumlah kg telur pecah atau busuk lebih dari 0.");
      return;
    }
    if (parsedLossKg > selectedLossEgg.stock_kg) {
      setModalError(
        `Jumlah melebihi sisa stok ${selectedLossEgg.name} (${formatKg(selectedLossEgg.stock_kg)} kg).`
      );
      return;
    }

    setModalError(null);

    startTransition(async () => {
      const result = await recordStockLoss({
        egg_type_id: selectedLossEgg.id,
        qty_kg: parsedLossKg,
        reason: lossReason,
        cost_per_kg_fallback: selectedLossEgg.cost_per_kg,
      });

      if (!result.ok || !result.loss) {
        setModalError(result.error ?? "Gagal mencatat telur pecah/busuk.");
        return;
      }

      if (result.updatedEggs) {
        setEggs(result.updatedEggs);
      } else if (isDemoLocal) {
        setEggs((prev) =>
          prev.map((egg) =>
            egg.id === selectedLossEgg.id
              ? {
                  ...egg,
                  stock_kg: Math.max(
                    0,
                    Number((egg.stock_kg - parsedLossKg).toFixed(2))
                  ),
                  updated_at: new Date().toISOString(),
                }
              : egg
          )
        );
      }

      setLosses((prev) => [result.loss!, ...prev].slice(0, 15));
      setHistoryTab("losses");
      setActiveModal(null);
      setToastMsg(
        `Kerugian ${selectedLossEgg.name} (${formatKg(parsedLossKg)} kg / ${formatRupiah(result.loss.cost_loss)}) tercatat.`
      );
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Stok Toko &amp; Kiriman
          </h1>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            {statusSummary.critical > 0
              ? `${statusSummary.critical} jenis kritis, ${statusSummary.low} menipis, ${statusSummary.safe} aman.`
              : statusSummary.low > 0
                ? `${statusSummary.low} jenis mulai menipis, ${statusSummary.safe} aman.`
                : `Semua ${statusSummary.safe} jenis telur dalam kondisi aman.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:shrink-0">
          <button
            type="button"
            disabled={eggs.length === 0}
            onClick={() => openRestockModal()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-accent bg-accent px-4 py-2.5 text-sm font-bold text-ink-inverse transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
          >
            <IconTruck className="h-5 w-5 shrink-0" />
            <span>Terima Kiriman</span>
          </button>

          <button
            type="button"
            disabled={eggs.length === 0}
            onClick={() => openLossModal()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-danger-border bg-danger-bg px-4 py-2.5 text-sm font-bold text-danger transition-colors duration-150 hover:bg-danger hover:text-ink-inverse active:scale-[0.98] disabled:opacity-50"
          >
            <IconLoss className="h-5 w-5 shrink-0" />
            <span>Telur Pecah</span>
          </button>
        </div>
      </div>

      {toastMsg ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border-2 border-safe-border bg-safe-bg px-4 py-3 text-sm font-bold text-safe"
        >
          <div className="flex items-center gap-2.5">
            <IconCheck className="h-5 w-5 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            aria-label="Tutup pemberitahuan"
            onClick={() => setToastMsg(null)}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-safe-border bg-surface text-safe hover:bg-safe hover:text-ink-inverse"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {sortedEggs.length === 0 ? (
        <div className="rounded-xl border-2 border-border-strong bg-surface p-6 text-center">
          <p className="text-base font-bold text-ink">
            Belum ada jenis telur aktif
          </p>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            Tambahkan master jenis telur di database terlebih dahulu.
          </p>
        </div>
      ) : (
        <section
          aria-label="Daftar stok telur"
          className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
        >
          {sortedEggs.map((egg) => {
            const status = getStockStatus(egg);
            const meta = STATUS_META[status];
            const isUrgent = status === "critical" || status === "low";
            const suggestedPeti = Math.max(
              2,
              Math.ceil(
                Math.max(egg.min_stock_kg * 2 - egg.stock_kg, egg.kg_per_peti * 2) /
                  (egg.kg_per_peti || 15)
              )
            );
            const waUrl = buildRestockWhatsAppUrl(egg, suggestedPeti);

            return (
              <article
                key={egg.id}
                className="flex flex-col justify-between rounded-xl border-2 border-border-strong bg-surface p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold leading-snug text-ink">
                      {egg.name}
                    </h2>
                    <span
                      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-bold ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2.5">
                    <span className="tabular-nums text-3xl font-extrabold leading-tight text-ink">
                      {formatKg(egg.stock_kg)} kg
                    </span>
                    <span className="tabular-nums text-sm font-bold text-ink-muted">
                      (~{formatPeti(egg.stock_kg, egg.kg_per_peti)} peti)
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border-subtle bg-tray px-3 py-2 text-xs">
                    <div>
                      <dt className="font-semibold text-ink-muted">Batas Min</dt>
                      <dd className="tabular-nums mt-0.5 font-bold text-ink">
                        {formatKg(egg.min_stock_kg)} kg
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink-muted">Modal/kg</dt>
                      <dd className="tabular-nums mt-0.5 font-bold text-ink">
                        {formatRupiah(egg.cost_per_kg)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink-muted">Jual/kg</dt>
                      <dd className="tabular-nums mt-0.5 font-bold text-ink">
                        {formatRupiah(egg.price_per_kg)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-bold transition-colors duration-150 active:scale-[0.98] ${
                      isUrgent
                        ? "border-wa bg-wa text-ink-inverse hover:border-wa-hover hover:bg-wa-hover"
                        : "border-wa bg-surface text-wa hover:bg-wa hover:text-ink-inverse"
                    }`}
                  >
                    <IconWhatsApp className="h-5 w-5 shrink-0" />
                    <span>Minta Kirim WA</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => openRestockModal(egg.id)}
                    className="flex min-h-12 items-center justify-center rounded-lg border-2 border-border-strong bg-tray px-3.5 text-sm font-bold text-ink transition-colors duration-150 hover:border-ink hover:bg-surface active:scale-[0.98]"
                  >
                    + Kiriman
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section
        aria-label="Riwayat stok terbaru"
        className="rounded-xl border-2 border-border-strong bg-surface p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-ink">Riwayat Terbaru</h2>

          <div
            role="tablist"
            aria-label="Jenis riwayat stok"
            className="grid grid-cols-2 gap-1.5 rounded-lg border-2 border-border-strong bg-tray p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={historyTab === "deliveries"}
              onClick={() => setHistoryTab("deliveries")}
              className={`min-h-11 rounded-md px-3 py-1.5 text-sm font-bold transition-colors duration-150 ${
                historyTab === "deliveries"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Kiriman Mobil ({deliveries.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={historyTab === "losses"}
              onClick={() => setHistoryTab("losses")}
              className={`min-h-11 rounded-md px-3 py-1.5 text-sm font-bold transition-colors duration-150 ${
                historyTab === "losses"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Telur Pecah ({losses.length})
            </button>
          </div>
        </div>

        {historyTab === "deliveries" ? (
          deliveries.length === 0 ? (
            <p className="mt-4 rounded-lg border border-border-subtle bg-tray p-4 text-center text-sm font-medium text-ink-muted">
              Belum ada riwayat kiriman mobil yang dicatat.
            </p>
          ) : (
            <ul className="mt-4 divide-y-2 divide-border-subtle">
              {deliveries.map((item) => {
                const eggName =
                  eggMap.get(item.egg_type_id)?.name ?? "Jenis Telur";
                const netKg = Math.max(
                  0,
                  Number((item.qty_kg - item.broken_kg).toFixed(2))
                );
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-ink">
                          {eggName}
                        </span>
                        <span className="tabular-nums rounded-md border border-safe-border bg-safe-bg px-2 py-0.5 text-xs font-bold text-safe">
                          +{formatKg(netKg)} kg ({formatKg(item.peti_count)} peti)
                        </span>
                        {item.broken_kg > 0 ? (
                          <span className="tabular-nums rounded-md border border-danger-border bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger">
                            Pecah {formatKg(item.broken_kg)} kg
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-medium text-ink-muted">
                        {item.supplier_name}
                        {item.driver_name ? ` / Supir: ${item.driver_name}` : ""}
                        {item.notes ? ` / ${item.notes}` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-0.5">
                      <span className="tabular-nums text-sm font-bold text-ink">
                        Modal {formatRupiah(item.cost_per_kg)}/kg
                      </span>
                      <span className="tabular-nums text-xs font-semibold text-ink-muted">
                        {formatDateTimeWib(item.created_at)} WIB
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : losses.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border-subtle bg-tray p-4 text-center text-sm font-medium text-ink-muted">
            Belum ada catatan telur pecah atau busuk.
          </p>
        ) : (
          <ul className="mt-4 divide-y-2 divide-border-subtle">
            {losses.map((item) => {
              const eggName =
                eggMap.get(item.egg_type_id)?.name ?? "Jenis Telur";
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-ink">
                        {eggName}
                      </span>
                      <span className="rounded-md border border-danger-border bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger">
                        {LOSS_REASON_LABELS[item.reason]}
                      </span>
                    </div>
                    <p className="tabular-nums mt-1 text-xs font-semibold text-ink-muted">
                      {formatDateTimeWib(item.created_at)} WIB
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tabular-nums text-base font-extrabold text-danger">
                      -{formatKg(item.qty_kg)} kg
                    </p>
                    <p className="tabular-nums text-xs font-bold text-ink-muted">
                      Rugi {formatRupiah(item.cost_loss)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {activeModal === "restock" ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-4"
          onClick={() => {
            if (!isPending) {
              setActiveModal(null);
              setModalError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-restock-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border-2 border-border-strong bg-surface p-5 sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b-2 border-border-subtle pb-3">
              <h2
                id="modal-restock-title"
                className="text-lg font-extrabold text-ink"
              >
                Terima Kiriman Mobil
              </h2>
              <button
                type="button"
                aria-label="Tutup form kiriman"
                disabled={isPending}
                onClick={() => {
                  setActiveModal(null);
                  setModalError(null);
                }}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 border-border-strong bg-tray text-ink hover:border-ink"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRestock} className="mt-4 space-y-4">
              {modalError ? (
                <p
                  role="alert"
                  className="rounded-lg border-2 border-danger-border bg-danger-bg px-3.5 py-2.5 text-sm font-bold text-danger"
                >
                  {modalError}
                </p>
              ) : null}

              <div>
                <label
                  htmlFor="restock-egg"
                  className="block text-sm font-bold text-ink"
                >
                  Jenis Telur
                </label>
                <select
                  id="restock-egg"
                  value={restockEggId}
                  onChange={(e) => handleRestockEggChange(e.target.value)}
                  className="mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3 text-base font-semibold text-ink"
                >
                  {eggs.map((egg) => (
                    <option key={egg.id} value={egg.id}>
                      {egg.name} ({egg.kg_per_peti} kg/peti)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="restock-peti"
                    className="text-sm font-bold text-ink"
                  >
                    Jumlah Peti Masuk
                  </label>
                  <span className="tabular-nums text-xs font-bold text-ink-muted">
                    Otomatis: {formatKg(computedRestockKg)} kg ({kgPerPeti} kg/peti)
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {PETI_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPetiInput(String(preset))}
                      className={`min-h-11 rounded-lg border-2 text-sm font-bold transition-colors duration-150 ${
                        Number(petiInput) === preset
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border-strong bg-tray text-ink hover:bg-surface"
                      }`}
                    >
                      {preset} Peti
                    </button>
                  ))}
                </div>
                <input
                  id="restock-peti"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0.5"
                  required
                  value={petiInput}
                  onChange={(e) => setPetiInput(e.target.value)}
                  className="tabular-nums mt-2 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-base font-bold text-ink"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="restock-cost"
                    className="block text-sm font-bold text-ink"
                  >
                    Harga Modal / kg (Rp)
                  </label>
                  <input
                    id="restock-cost"
                    type="number"
                    inputMode="numeric"
                    step="100"
                    min="1000"
                    required
                    value={costInput}
                    onChange={(e) => setCostInput(e.target.value)}
                    className="tabular-nums mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-base font-bold text-ink"
                  />
                </div>

                <div>
                  <label
                    htmlFor="restock-broken"
                    className="block text-sm font-bold text-ink"
                  >
                    Telur Pecah di Mobil (kg)
                  </label>
                  <input
                    id="restock-broken"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={brokenInput}
                    onChange={(e) => setBrokenInput(e.target.value)}
                    className="tabular-nums mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-base font-bold text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="restock-supplier"
                    className="block text-sm font-bold text-ink"
                  >
                    Nama Distributor / Gudang
                  </label>
                  <input
                    id="restock-supplier"
                    type="text"
                    required
                    placeholder="Contoh: Gudang Jaya Telur"
                    value={supplierInput}
                    onChange={(e) => setSupplierInput(e.target.value)}
                    className="mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-base font-semibold text-ink placeholder:text-ink-muted"
                  />
                </div>

                <div>
                  <label
                    htmlFor="restock-driver"
                    className="block text-sm font-bold text-ink"
                  >
                    Nama Supir (opsional)
                  </label>
                  <input
                    id="restock-driver"
                    type="text"
                    placeholder="Contoh: Pak Slamet"
                    value={driverInput}
                    onChange={(e) => setDriverInput(e.target.value)}
                    className="mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-base font-semibold text-ink placeholder:text-ink-muted"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="restock-notes"
                  className="block text-sm font-bold text-ink"
                >
                  Catatan (opsional)
                </label>
                <input
                  id="restock-notes"
                  type="text"
                  placeholder="Kondisi telur atau info pembayaran"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-base font-semibold text-ink placeholder:text-ink-muted"
                />
              </div>

              <div className="rounded-lg border-2 border-safe-border bg-safe-bg p-3.5">
                <div className="flex items-center justify-between text-sm font-bold text-safe">
                  <span>Stok Bersih Masuk</span>
                  <span className="tabular-nums text-base font-extrabold">
                    +{formatKg(netRestockKg)} kg
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs font-semibold text-ink">
                  <span>Estimasi Nilai Modal</span>
                  <span className="tabular-nums font-bold">
                    {formatRupiah(estimatedRestockValue)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-accent bg-accent px-4 text-base font-extrabold text-ink-inverse transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
              >
                {isPending ? "Menyimpan Kiriman…" : "Simpan Kiriman & Tambah Stok"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {activeModal === "loss" ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-4"
          onClick={() => {
            if (!isPending) {
              setActiveModal(null);
              setModalError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-loss-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border-2 border-border-strong bg-surface p-5 sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b-2 border-border-subtle pb-3">
              <h2
                id="modal-loss-title"
                className="text-lg font-extrabold text-ink"
              >
                Catat Telur Pecah / Busuk
              </h2>
              <button
                type="button"
                aria-label="Tutup form telur pecah"
                disabled={isPending}
                onClick={() => {
                  setActiveModal(null);
                  setModalError(null);
                }}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 border-border-strong bg-tray text-ink hover:border-ink"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLoss} className="mt-4 space-y-4">
              {modalError ? (
                <p
                  role="alert"
                  className="rounded-lg border-2 border-danger-border bg-danger-bg px-3.5 py-2.5 text-sm font-bold text-danger"
                >
                  {modalError}
                </p>
              ) : null}

              <div>
                <label
                  htmlFor="loss-egg"
                  className="block text-sm font-bold text-ink"
                >
                  Jenis Telur
                </label>
                <select
                  id="loss-egg"
                  value={lossEggId}
                  onChange={(e) => setLossEggId(e.target.value)}
                  className="mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3 text-base font-semibold text-ink"
                >
                  {eggs.map((egg) => (
                    <option key={egg.id} value={egg.id}>
                      {egg.name} (Sisa {formatKg(egg.stock_kg)} kg)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="loss-kg"
                  className="block text-sm font-bold text-ink"
                >
                  Berat Telur Dibuang (kg)
                </label>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {LOSS_KG_PRESETS.map((preset) => {
                    const exceedsStock =
                      selectedLossEgg !== null &&
                      preset > selectedLossEgg.stock_kg;
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={exceedsStock}
                        onClick={() => setLossKgInput(String(preset))}
                        className={`min-h-11 rounded-lg border-2 text-sm font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${
                          Number(lossKgInput) === preset
                            ? "border-danger-border bg-danger-bg text-danger"
                            : "border-border-strong bg-tray text-ink hover:bg-surface"
                        }`}
                      >
                        {formatKg(preset)} kg
                      </button>
                    );
                  })}
                </div>
                <input
                  id="loss-kg"
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  min="0.05"
                  max={selectedLossEgg?.stock_kg ?? undefined}
                  required
                  value={lossKgInput}
                  onChange={(e) => setLossKgInput(e.target.value)}
                  className="tabular-nums mt-2 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-base font-bold text-ink"
                />
              </div>

              <div>
                <span className="block text-sm font-bold text-ink">
                  Alasan Kerugian
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {LOSS_REASON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLossReason(opt.value)}
                      className={`min-h-12 rounded-lg border-2 px-2 py-2 text-sm font-bold transition-colors duration-150 ${
                        lossReason === opt.value
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border-strong bg-tray text-ink hover:bg-surface"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border-2 border-danger-border bg-danger-bg p-3.5">
                <div className="flex items-center justify-between text-sm font-bold text-danger">
                  <span>Estimasi Kerugian Modal</span>
                  <span className="tabular-nums text-base font-extrabold">
                    {formatRupiah(estimatedLossCost)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-ink">
                  Stok {selectedLossEgg?.name ?? "telur"} akan berkurang{" "}
                  <span className="tabular-nums font-bold">
                    {formatKg(parsedLossKg)} kg
                  </span>
                  .
                </p>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-danger bg-danger px-4 text-base font-extrabold text-ink-inverse transition-colors duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              >
                {isPending ? "Menyimpan…" : "Simpan Kerugian & Kurangi Stok"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
