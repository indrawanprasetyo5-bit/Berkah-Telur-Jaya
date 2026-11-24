"use client";

import { useMemo, useState, useTransition } from "react";
import type { Expense, ExpenseCategory } from "@/types/database";
import { formatRupiah, formatTimeWib } from "@/lib/format";
import {
  createExpense,
  deleteExpense,
} from "@/app/(app)/kas-keluar/actions";
import { IconCheck, IconClose, IconPlus, IconTrash } from "@/components/icons";

interface ExpenseManagerProps {
  initialExpenses: Expense[];
  isDemoLocal: boolean;
}

const CATEGORY_OPTIONS: {
  value: ExpenseCategory;
  label: string;
  placeholder: string;
}[] = [
  {
    value: "plastik",
    label: "Plastik",
    placeholder: "Contoh: Plastik kresek tanggung 1 pack",
  },
  {
    value: "parkir",
    label: "Parkir",
    placeholder: "Contoh: Parkir & retribusi toko",
  },
  {
    value: "konsumsi",
    label: "Konsumsi",
    placeholder: "Contoh: Makan siang / es teh staff",
  },
  {
    value: "lainnya",
    label: "Lainnya",
    placeholder: "Contoh: Lakban, tali rafia, atau tray bekas",
  },
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  plastik: "Plastik",
  parkir: "Parkir",
  konsumsi: "Konsumsi",
  lainnya: "Lainnya",
};

const QUICK_AMOUNTS = [5000, 10000, 15000, 20000, 25000, 50000] as const;

export function ExpenseManager({
  initialExpenses,
  isDemoLocal,
}: ExpenseManagerProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [amountInput, setAmountInput] = useState<string>("");
  const [category, setCategory] = useState<ExpenseCategory>("plastik");
  const [notesInput, setNotesInput] = useState<string>("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalToday = useMemo(
    () => expenses.reduce((sum, item) => sum + Number(item.amount), 0),
    [expenses]
  );

  const activeCategoryOption =
    CATEGORY_OPTIONS.find((opt) => opt.value === category) ??
    CATEGORY_OPTIONS[0];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedAmount = Number(amountInput);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Masukkan nominal pengeluaran lebih dari Rp 0.");
      return;
    }

    setErrorMsg(null);
    setToastMsg(null);

    startTransition(async () => {
      const result = await createExpense({
        amount: parsedAmount,
        category,
        notes: notesInput.trim(),
      });

      if (!result.ok || !result.expense) {
        setErrorMsg(result.error ?? "Gagal mencatat kas keluar.");
        return;
      }

      setExpenses((prev) => [result.expense!, ...prev]);
      setAmountInput("");
      setNotesInput("");
      setToastMsg(
        `Kas keluar ${formatRupiah(result.expense.amount)} (${CATEGORY_LABELS[result.expense.category]}) tercatat.`
      );
    });
  }

  function handleConfirmDelete(expenseId: string) {
    setErrorMsg(null);
    setToastMsg(null);

    startTransition(async () => {
      const result = await deleteExpense(expenseId);

      if (!result.ok) {
        setErrorMsg(result.error ?? "Gagal menghapus catatan.");
        setConfirmDeleteId(null);
        return;
      }

      setExpenses((prev) => prev.filter((item) => item.id !== expenseId));
      setConfirmDeleteId(null);
      setToastMsg("Catatan kas keluar berhasil dihapus.");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Kas Keluar Operasional
          </h1>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            Catat pengeluaran harian dari uang laci agar cocok saat tutup kasir.
          </p>
        </div>

        <div className="rounded-xl border-2 border-border-strong bg-surface px-4 py-3 sm:min-w-60 sm:text-right">
          <p className="text-xs font-bold text-ink-muted">
            Total Kas Keluar Hari Ini
          </p>
          <p className="tabular-nums mt-0.5 text-2xl font-extrabold leading-tight text-danger">
            {formatRupiah(totalToday)}
          </p>
          <p className="tabular-nums mt-0.5 text-xs font-semibold text-ink-muted">
            {expenses.length} catatan{isDemoLocal ? " (Demo Lokal)" : ""}
          </p>
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

      {errorMsg ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-danger-border bg-danger-bg px-4 py-3 text-sm font-bold text-danger"
        >
          {errorMsg}
        </p>
      ) : null}

      <section
        aria-label="Form input cepat kas keluar"
        className="rounded-xl border-2 border-border-strong bg-surface p-4 sm:p-5"
      >
        <h2 className="text-lg font-bold text-ink">Catat Pengeluaran Cepat</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="expense-amount"
              className="block text-sm font-bold text-ink"
            >
              Nominal (Rp)
            </label>
            <input
              id="expense-amount"
              type="number"
              inputMode="numeric"
              min="500"
              step="500"
              required
              placeholder="Contoh: 15000"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="tabular-nums mt-1.5 min-h-14 w-full rounded-lg border-2 border-border-strong bg-surface px-4 text-xl font-extrabold text-ink placeholder:text-base placeholder:font-semibold placeholder:text-ink-muted"
            />
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {QUICK_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountInput(String(preset))}
                  className={`tabular-nums min-h-11 rounded-lg border-2 px-2 text-sm font-bold transition-colors duration-150 active:scale-[0.98] ${
                    Number(amountInput) === preset
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border-strong bg-tray text-ink hover:bg-surface"
                  }`}
                >
                  {preset / 1000}rb
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-bold text-ink">Kategori</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {CATEGORY_OPTIONS.map((opt) => {
                const active = category === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(opt.value)}
                    className={`min-h-12 rounded-lg border-2 px-3 py-2 text-sm font-bold transition-colors duration-150 active:scale-[0.98] ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border-strong bg-tray text-ink hover:bg-surface"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="expense-notes"
              className="block text-sm font-bold text-ink"
            >
              Catatan Singkat (opsional)
            </label>
            <input
              id="expense-notes"
              type="text"
              maxLength={120}
              placeholder={activeCategoryOption.placeholder}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-surface px-3.5 text-base font-semibold text-ink placeholder:text-ink-muted"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border-2 border-accent bg-accent px-4 text-base font-extrabold text-ink-inverse transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            <IconPlus className="h-5 w-5" />
            <span>{isPending ? "Menyimpan…" : "Simpan Kas Keluar"}</span>
          </button>
        </form>
      </section>

      <section
        aria-label="Daftar kas keluar hari ini"
        className="rounded-xl border-2 border-border-strong bg-surface p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">Riwayat Hari Ini</h2>
          <span className="tabular-nums rounded-md border border-border-strong bg-tray px-2.5 py-1 text-xs font-bold text-ink">
            {expenses.length} item
          </span>
        </div>

        {expenses.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border-subtle bg-tray p-5 text-center text-sm font-medium text-ink-muted">
            Belum ada pengeluaran dari uang laci hari ini.
          </p>
        ) : (
          <ul className="mt-4 divide-y-2 divide-border-subtle">
            {expenses.map((item) => {
              const isConfirming = confirmDeleteId === item.id;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-border-strong bg-tray px-2 py-0.5 text-xs font-bold text-ink">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      <span className="tabular-nums text-xs font-semibold text-ink-muted">
                        {formatTimeWib(item.created_at)} WIB
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-ink">
                      {item.notes || "Tanpa catatan"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="tabular-nums text-base font-extrabold text-danger">
                      -{formatRupiah(item.amount)}
                    </span>

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleConfirmDelete(item.id)}
                          className="min-h-11 rounded-lg border-2 border-danger bg-danger px-3 text-xs font-extrabold text-ink-inverse active:scale-[0.98] disabled:opacity-60"
                        >
                          Hapus
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-11 rounded-lg border-2 border-border-strong bg-tray px-2.5 text-xs font-bold text-ink"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        aria-label={`Hapus pengeluaran ${CATEGORY_LABELS[item.category]} ${formatRupiah(item.amount)}`}
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 border-border-strong bg-tray text-ink-muted transition-colors duration-150 hover:border-danger-border hover:bg-danger-bg hover:text-danger active:scale-[0.98] disabled:opacity-50"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
