"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PaymentMethod } from "@/types/database";
import {
  buildSaleReceiptWhatsAppUrl,
  formatDateTimeWib,
  formatKg,
  formatRupiah,
  type ThermalReceiptData,
} from "@/lib/format";
import { BrandLogo } from "./brand-logo";
import {
  IconClose,
  IconDownload,
  IconPrinter,
  IconWhatsApp,
} from "./icons";

interface ReceiptModalProps {
  receipt: ThermalReceiptData | null;
  onClose: () => void;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
};

function formatPlainNumber(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function renderReceiptToPngDataUrl(receipt: ThermalReceiptData): string {
  const scale = 3;
  const outerPad = 16;
  const paperWidth = 320;
  const canvasWidth = paperWidth + outerPad * 2;
  const padX = 20;
  const innerWidth = paperWidth - padX * 2;
  const monoFont =
    "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

  const baseHeight = 350;
  const itemRowsHeight = receipt.items.length * 44;
  const cashRowsHeight = receipt.paymentMethod === "cash" ? 42 : 0;
  const paperHeight = baseHeight + itemRowsHeight + cashRowsHeight;
  const teethHeight = 10;
  const canvasHeight = paperHeight + teethHeight + outerPad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth * scale;
  canvas.height = canvasHeight * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.scale(scale, scale);

  ctx.fillStyle = "#F2ECE1";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const paperX = outerPad;
  const paperY = outerPad;

  ctx.save();
  ctx.shadowColor = "rgba(28, 25, 23, 0.16)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(paperX, paperY);
  ctx.lineTo(paperX + paperWidth, paperY);
  ctx.lineTo(paperX + paperWidth, paperY + paperHeight);

  const toothCount = 20;
  const toothWidth = paperWidth / toothCount;
  for (let i = toothCount; i > 0; i -= 1) {
    const midX = paperX + (i - 0.5) * toothWidth;
    const leftX = paperX + (i - 1) * toothWidth;
    ctx.lineTo(midX, paperY + paperHeight + teethHeight);
    ctx.lineTo(leftX, paperY + paperHeight);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const centerX = paperX + paperWidth / 2;
  const leftX = paperX + padX;
  const rightX = paperX + paperWidth - padX;
  let y = paperY + 22;

  ctx.fillStyle = "#C2410C";
  ctx.beginPath();
  ctx.roundRect(centerX - 14, y, 28, 28, 6);
  ctx.fill();

  ctx.fillStyle = "#FBF8F1";
  ctx.beginPath();
  ctx.ellipse(centerX, y + 13, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F59E0B";
  ctx.beginPath();
  ctx.arc(centerX, y + 14, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F2ECE1";
  ctx.fillRect(centerX - 9, y + 17, 18, 6);

  y += 44;
  ctx.fillStyle = "#1C1917";
  ctx.font = `800 13px ${monoFont}`;
  ctx.textAlign = "center";
  ctx.fillText("BERKAH TELUR JAYA (BTJ)", centerX, y);

  y += 16;
  ctx.fillStyle = "#57534E";
  ctx.font = `500 10px ${monoFont}`;
  ctx.fillText("Jl. Letnan Sukarna, Kp. Gedong,", centerX, y);
  y += 13;
  ctx.fillText("Ciampea, Bogor", centerX, y);

  const drawDashedDivider = (posY: number) => {
    ctx.save();
    ctx.strokeStyle = "#A8A29E";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(leftX, posY);
    ctx.lineTo(rightX, posY);
    ctx.stroke();
    ctx.restore();
  };

  const drawKeyValue = (
    label: string,
    value: string,
    posY: number,
    bold = false,
    fontSize = 11
  ) => {
    ctx.fillStyle = "#1C1917";
    ctx.font = `${bold ? "700" : "500"} ${fontSize}px ${monoFont}`;
    ctx.textAlign = "left";
    ctx.fillText(label, leftX, posY);
    ctx.textAlign = "right";
    ctx.fillText(value, rightX, posY);
  };

  y += 14;
  drawDashedDivider(y);

  y += 17;
  drawKeyValue("No. Nota", receipt.receiptNo, y);
  y += 16;
  drawKeyValue("Waktu", `${formatDateTimeWib(receipt.createdAtIso)} WIB`, y);
  y += 16;
  drawKeyValue("Kasir", receipt.cashierName, y);
  y += 16;
  drawKeyValue("Bayar", PAYMENT_LABELS[receipt.paymentMethod], y);

  y += 12;
  drawDashedDivider(y);

  for (const item of receipt.items) {
    y += 18;
    const itemTitle = item.isCracked
      ? `${item.eggName} (Retak)`
      : item.eggName;
    ctx.fillStyle = "#1C1917";
    ctx.font = `700 11px ${monoFont}`;
    ctx.textAlign = "left";
    ctx.fillText(itemTitle, leftX, y, innerWidth);

    y += 15;
    ctx.fillStyle = "#57534E";
    ctx.font = `500 10.5px ${monoFont}`;
    ctx.textAlign = "left";
    ctx.fillText(
      `${formatKg(item.qtyKg)} kg x ${formatPlainNumber(item.pricePerKg)}`,
      leftX,
      y
    );

    ctx.fillStyle = "#1C1917";
    ctx.font = `700 11px ${monoFont}`;
    ctx.textAlign = "right";
    ctx.fillText(formatRupiah(item.subtotal), rightX, y);
  }

  y += 14;
  drawDashedDivider(y);

  y += 17;
  drawKeyValue("Total Berat", `${formatKg(receipt.totalKg)} kg`, y);

  y += 22;
  drawKeyValue("TOTAL", formatRupiah(receipt.totalAmount), y, true, 14);

  if (receipt.paymentMethod === "cash") {
    const paid =
      receipt.cashReceived > 0 ? receipt.cashReceived : receipt.totalAmount;
    y += 18;
    drawKeyValue("Tunai", formatRupiah(paid), y);
    y += 16;
    drawKeyValue("Kembali", formatRupiah(receipt.changeAmount), y, true);
  }

  y += 22;
  const badgeW = 84;
  const badgeH = 20;
  ctx.strokeStyle = "#15803D";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(centerX - badgeW / 2, y - 14, badgeW, badgeH);
  ctx.fillStyle = "#15803D";
  ctx.font = `800 11px ${monoFont}`;
  ctx.textAlign = "center";
  ctx.fillText("LUNAS", centerX, y);

  y += 16;
  drawDashedDivider(y);

  y += 18;
  ctx.fillStyle = "#57534E";
  ctx.font = `500 10px ${monoFont}`;
  ctx.textAlign = "center";
  ctx.fillText("Terima kasih sudah berbelanja", centerX, y);
  y += 14;
  ctx.fillText("di Berkah Telur Jaya", centerX, y);

  return canvas.toDataURL("image/png");
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!receipt) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [receipt, onClose]);

  if (!mounted || !receipt) return null;

  function handleDownloadPng() {
    if (!receipt || isDownloading) return;
    setIsDownloading(true);
    try {
      const dataUrl = renderReceiptToPngDataUrl(receipt);
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Struk-${receipt.receiptNo}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const paidCash =
    receipt.cashReceived > 0 ? receipt.cashReceived : receipt.totalAmount;

  return createPortal(
    <div
      id="thermal-receipt-modal"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-ink/65 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
        className="my-auto flex w-full max-w-sm flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex w-full max-w-[320px] items-center justify-between print:hidden">
          <span
            id="receipt-modal-title"
            className="rounded-md bg-surface/95 px-2.5 py-1 text-xs font-extrabold text-ink"
          >
            Struk Digital
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup struk"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 border-border-strong bg-surface text-ink hover:bg-tray active:scale-[0.98]"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div
          id="thermal-receipt-paper"
          className="w-full max-w-[320px] shadow-[0_12px_28px_rgba(28,25,23,0.28)]"
        >
          <div className="bg-surface px-5 pt-5 pb-4 font-mono text-xs leading-relaxed text-ink tabular-nums">
            <div className="flex flex-col items-center text-center">
              <BrandLogo size={30} className="mb-2" />
              <p className="text-sm font-extrabold tracking-tight text-ink">
                BERKAH TELUR JAYA (BTJ)
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                Jl. Letnan Sukarna, Kp. Gedong, Ciampea, Bogor
              </p>
            </div>

            <div
              aria-hidden="true"
              className="my-3 border-b border-dashed border-ink/40"
            />

            <dl className="space-y-1 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">No. Nota</dt>
                <dd className="font-bold text-ink">{receipt.receiptNo}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Tanggal</dt>
                <dd className="text-right font-semibold text-ink">
                  {formatDateTimeWib(receipt.createdAtIso)} WIB
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Kasir</dt>
                <dd className="truncate font-semibold text-ink">
                  {receipt.cashierName}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Metode Bayar</dt>
                <dd className="font-bold text-ink">
                  {PAYMENT_LABELS[receipt.paymentMethod]}
                </dd>
              </div>
            </dl>

            <div
              aria-hidden="true"
              className="my-3 border-b border-dashed border-ink/40"
            />

            <ul className="space-y-2.5">
              {receipt.items.map((item, idx) => (
                <li key={`${item.eggName}-${idx}`}>
                  <p className="font-bold text-ink">
                    {item.eggName}
                    {item.isCracked ? " (Retak)" : ""}
                  </p>
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="text-ink-muted">
                      {formatKg(item.qtyKg)} kg x{" "}
                      {formatPlainNumber(item.pricePerKg)} ({item.unitLabel})
                    </span>
                    <span className="shrink-0 font-bold text-ink">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div
              aria-hidden="true"
              className="my-3 border-b border-dashed border-ink/40"
            />

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-ink-muted">Total Berat</span>
                <span className="font-bold text-ink">
                  {formatKg(receipt.totalKg)} kg
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <span className="text-sm font-extrabold text-ink">TOTAL</span>
                <span className="text-base font-extrabold text-ink">
                  {formatRupiah(receipt.totalAmount)}
                </span>
              </div>

              {receipt.paymentMethod === "cash" ? (
                <div className="space-y-0.5 pt-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Uang Diterima</span>
                    <span className="font-semibold text-ink">
                      {formatRupiah(paidCash)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Kembalian</span>
                    <span className="font-bold text-ink">
                      {formatRupiah(receipt.changeAmount)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-3.5 flex justify-center">
              <span className="border border-safe px-3 py-0.5 text-[11px] font-extrabold tracking-widest text-safe print:border-ink print:text-ink">
                LUNAS
              </span>
            </div>

            <div
              aria-hidden="true"
              className="my-3 border-b border-dashed border-ink/40"
            />

            <p className="text-center text-[11px] leading-snug text-ink-muted">
              Terima kasih sudah berbelanja di Berkah Telur Jaya
            </p>
          </div>

          <svg
            viewBox="0 0 320 12"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="block h-3 w-full text-surface print:hidden"
          >
            <polygon
              fill="currentColor"
              points="0,0 320,0 320,2 312,12 304,2 296,12 288,2 280,12 272,2 264,12 256,2 248,12 240,2 232,12 224,2 216,12 208,2 200,12 192,2 184,12 176,2 168,12 160,2 152,12 144,2 136,12 128,2 120,12 112,2 104,12 96,2 88,12 80,2 72,12 64,2 56,12 48,2 40,12 32,2 24,12 16,2 8,12 0,2"
            />
          </svg>
        </div>

        <div className="mt-3.5 grid w-full max-w-[320px] grid-cols-1 gap-2 print:hidden">
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadPng}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-accent bg-accent px-4 text-sm font-extrabold text-ink-inverse transition-colors duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            <IconDownload className="h-4 w-4 shrink-0" />
            <span>
              {isDownloading ? "Menyiapkan Gambar…" : "Unduh Gambar Struk (.png)"}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 border-border-strong bg-surface px-3 text-xs font-extrabold text-ink transition-colors duration-150 hover:bg-tray active:scale-[0.98]"
            >
              <IconPrinter className="h-4 w-4 shrink-0" />
              <span>Cetak Struk</span>
            </button>

            <a
              href={buildSaleReceiptWhatsAppUrl(receipt)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 border-wa bg-wa px-3 text-xs font-extrabold text-ink-inverse transition-colors duration-150 hover:bg-wa-hover active:scale-[0.98]"
            >
              <IconWhatsApp className="h-4 w-4 shrink-0" />
              <span>Kirim Teks WA</span>
            </a>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full rounded-lg border-2 border-border-strong bg-tray px-4 text-xs font-extrabold text-ink transition-colors duration-150 hover:bg-surface active:scale-[0.98]"
          >
            Tutup &amp; Lanjut Kasir
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
