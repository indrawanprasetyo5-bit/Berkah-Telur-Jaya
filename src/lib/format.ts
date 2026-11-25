import type { EggType, PaymentMethod } from "@/types/database";

export type StockStatus = "critical" | "low" | "safe";

export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(rounded);
}

export function formatKg(kg: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: kg % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(kg);
}

export function formatPeti(stockKg: number, kgPerPeti: number): string {
  const safeDivisor = kgPerPeti > 0 ? kgPerPeti : 15;
  const peti = stockKg / safeDivisor;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(peti);
}

export function getStockStatus(egg: Pick<EggType, "stock_kg" | "min_stock_kg">): StockStatus {
  if (egg.stock_kg < egg.min_stock_kg) {
    return "critical";
  }
  if (egg.stock_kg <= egg.min_stock_kg * 1.3) {
    return "low";
  }
  return "safe";
}

export function buildRestockWhatsAppUrl(
  egg: Pick<EggType, "name" | "stock_kg" | "kg_per_peti" | "distributor_wa">,
  suggestedPeti = 5
): string {
  const phone = (egg.distributor_wa || "6281390001122").replace(/[^0-9]/g, "");
  const kgText = formatKg(egg.stock_kg);
  const petiText = formatPeti(egg.stock_kg, egg.kg_per_peti);
  const message = `Halo, stok ${egg.name} di Berkah Telur Jaya (BTJ) tinggal ${kgText} kg (~${petiText} peti). Mohon kirim tambahan ${suggestedPeti} peti ya.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function formatTimeWib(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function formatDateTimeWib(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function getJakartaStartOfTodayIso(): string {
  const dateKey = getJakartaDateKey(new Date());
  return new Date(`${dateKey}T00:00:00+07:00`).toISOString();
}

export function getJakartaDateKey(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getJakartaDaysAgoStartIso(daysAgo: number): string {
  const now = new Date();
  const target = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const dateKey = getJakartaDateKey(target);
  return new Date(`${dateKey}T00:00:00+07:00`).toISOString();
}

export function formatShortDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const jt = abs / 1_000_000;
    return `${sign}${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 1,
    }).format(jt)} jt`;
  }
  if (abs >= 1_000) {
    const rb = Math.round(abs / 1_000);
    return `${sign}${rb} rb`;
  }
  return `${sign}${Math.round(abs)}`;
}

export interface SaleReceiptItem {
  eggName: string;
  qtyKg: number;
  unitLabel: string;
  isCracked: boolean;
  pricePerKg: number;
  subtotal: number;
}

export interface ThermalReceiptData {
  receiptNo: string;
  createdAtIso: string;
  cashierName: string;
  paymentMethod: PaymentMethod;
  items: SaleReceiptItem[];
  totalKg: number;
  totalAmount: number;
  cashReceived: number;
  changeAmount: number;
}

const PAYMENT_LABEL_MAP: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
};

export function formatReceiptNo(saleId: string, createdAtIso: string): string {
  const dateKey = getJakartaDateKey(createdAtIso).replace(/-/g, "").slice(2);
  const cleanSuffix = saleId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase()
    .padStart(4, "0");
  return `BTJ-${dateKey}-${cleanSuffix}`;
}

function padSides(left: string, right: string, width = 30): string {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`;
}

export function buildSaleReceiptWhatsAppUrl(
  payload: ThermalReceiptData
): string {
  const dateText = `${formatDateTimeWib(payload.createdAtIso)} WIB`;
  const divider = "-".repeat(30);

  const monoLines: string[] = [
    "BERKAH TELUR JAYA (BTJ)",
    "Jl. Letnan Sukarna, Ciampea",
    divider,
    `Nota  : ${payload.receiptNo}`,
    `Waktu : ${dateText}`,
    `Kasir : ${payload.cashierName}`,
    `Bayar : ${PAYMENT_LABEL_MAP[payload.paymentMethod]}`,
    divider,
  ];

  for (const item of payload.items) {
    const title = item.isCracked ? `${item.eggName} (Retak)` : item.eggName;
    const qtyDetail = `  ${formatKg(item.qtyKg)} kg x ${new Intl.NumberFormat("id-ID").format(Math.round(item.pricePerKg))}`;
    const subText = formatRupiah(item.subtotal);
    monoLines.push(title);
    monoLines.push(padSides(qtyDetail, subText));
  }

  monoLines.push(divider);
  monoLines.push(padSides("Total Berat", `${formatKg(payload.totalKg)} kg`));
  monoLines.push(padSides("TOTAL", formatRupiah(payload.totalAmount)));

  if (payload.paymentMethod === "cash") {
    const paid =
      payload.cashReceived > 0 ? payload.cashReceived : payload.totalAmount;
    monoLines.push(padSides("Tunai", formatRupiah(paid)));
    monoLines.push(padSides("Kembali", formatRupiah(payload.changeAmount)));
  }

  monoLines.push(padSides("Status", "LUNAS"));
  monoLines.push(divider);

  const message = [
    "```",
    ...monoLines,
    "```",
    "Terima kasih sudah berbelanja di Berkah Telur Jaya.",
  ].join("\n");

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
