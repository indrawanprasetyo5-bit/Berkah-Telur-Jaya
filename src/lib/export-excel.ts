import type { SaleWithItems } from "@/lib/demo-data";
import type { PaymentMethod } from "@/types/database";
import {
  formatDateTimeWib,
  formatRupiah,
  formatTimeWib,
  getJakartaDateKey,
} from "@/lib/format";

export interface ExportSalesExcelParams {
  sales: SaleWithItems[];
  isOwner: boolean;
  startDate: string;
  endDate: string;
  todayKey: string;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
};

const RUPIAH_NUM_FMT = '"Rp "#,##0';
const KG_NUM_FMT = "#,##0.00";

function formatPeriodText(startDate: string, endDate: string): string {
  if (startDate && endDate) {
    return startDate === endDate ? startDate : `${startDate} s.d. ${endDate}`;
  }
  if (startDate) return `Mulai ${startDate}`;
  if (endDate) return `Sampai ${endDate}`;
  return "Semua Periode";
}

export async function exportSalesToExcel({
  sales,
  isOwner,
  startDate,
  endDate,
  todayKey,
}: ExportSalesExcelParams): Promise<void> {
  if (sales.length === 0) return;

  // exceljs berat, jadi baru dimuat saat tombol export ditekan.
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Berkah Telur Jaya (BTJ)";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Laporan Penjualan", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const lastColLetter = isOwner ? "J" : "H";
  const colCount = isOwner ? 10 : 8;

  worksheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PENJUALAN - BERKAH TELUR JAYA (BTJ)";
  titleCell.font = {
    name: "Calibri",
    size: 15,
    bold: true,
    color: { argb: "FF1C1917" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(`A2:${lastColLetter}2`);
  const addressCell = worksheet.getCell("A2");
  addressCell.value = "Jl. Letnan Sukarna, Kp. Gedong, Ciampea, Bogor";
  addressCell.font = {
    name: "Calibri",
    size: 10.5,
    bold: false,
    color: { argb: "FF57534E" },
  };
  addressCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 20;

  worksheet.mergeCells(`A3:${lastColLetter}3`);
  const metaCell = worksheet.getCell("A3");
  const printedAtWib = `${formatDateTimeWib(new Date().toISOString())} WIB`;
  metaCell.value = `Periode: ${formatPeriodText(startDate, endDate)}   |   Dicetak: ${printedAtWib}`;
  metaCell.font = {
    name: "Calibri",
    size: 9.5,
    italic: true,
    color: { argb: "FF57534E" },
  };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(3).height = 18;

  worksheet.getRow(4).height = 8;

  const headers = isOwner
    ? [
        "No",
        "Tanggal",
        "Waktu WIB",
        "ID Transaksi",
        "Metode Bayar",
        "Rincian Item",
        "Total Berat (kg)",
        "Total Omzet (Rp)",
        "Modal HPP (Rp)",
        "Laba Kotor (Rp)",
      ]
    : [
        "No",
        "Tanggal",
        "Waktu WIB",
        "ID Transaksi",
        "Metode Bayar",
        "Rincian Item",
        "Total Berat (kg)",
        "Total Omzet (Rp)",
      ];

  const headerRow = worksheet.getRow(5);
  headerRow.values = headers;
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF9A3412" },
    };
    cell.font = {
      name: "Calibri",
      size: 10.5,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF7C2D12" } },
      bottom: { style: "medium", color: { argb: "FF7C2D12" } },
      left: { style: "thin", color: { argb: "FF7C2D12" } },
      right: { style: "thin", color: { argb: "FF7C2D12" } },
    };
  });

  const maxColLens = headers.map((h) => h.length);
  const trackLen = (colIdx: number, text: string) => {
    const longestLine = text
      .split("\n")
      .reduce((max, line) => Math.max(max, line.length), 0);
    if (longestLine > maxColLens[colIdx]) {
      maxColLens[colIdx] = longestLine;
    }
  };

  const firstDataRow = 6;
  let sumKg = 0;
  let sumRevenue = 0;
  let sumCost = 0;
  let sumProfit = 0;

  sales.forEach((sale, idx) => {
    const rowNumber = firstDataRow + idx;
    const dateKey = getJakartaDateKey(sale.created_at);
    const timeText = `${formatTimeWib(sale.created_at)} WIB`;
    const paymentText = PAYMENT_LABELS[sale.payment_method];
    const itemsText = sale.items
      .map(
        (i) =>
          `${i.egg_name} (${i.unit_label}${i.is_cracked ? " - Retak" : ""})`
      )
      .join("\n");

    const totalKg = Number(
      sale.items.reduce((sum, i) => sum + i.qty_kg, 0).toFixed(2)
    );
    const revenue = Math.round(sale.total_amount);
    const cost = Math.round(sale.total_cost);
    const grossProfit = Math.round(revenue - cost);

    sumKg = Number((sumKg + totalKg).toFixed(2));
    sumRevenue += revenue;
    sumCost += cost;
    sumProfit += grossProfit;

    const rowValues = isOwner
      ? [
          idx + 1,
          dateKey,
          timeText,
          sale.id,
          paymentText,
          itemsText,
          totalKg,
          revenue,
          cost,
          grossProfit,
        ]
      : [
          idx + 1,
          dateKey,
          timeText,
          sale.id,
          paymentText,
          itemsText,
          totalKg,
          revenue,
        ];

    const row = worksheet.getRow(rowNumber);
    row.values = rowValues;

    const lineCount = Math.max(1, sale.items.length);
    row.height = Math.max(22, lineCount * 17 + 6);

    const isStriped = idx % 2 === 1;
    const fillColor = isStriped ? "FFFBF8F1" : "FFFFFFFF";

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillColor },
      };
      cell.font = {
        name: "Calibri",
        size: 10,
        color: { argb: "FF1C1917" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2DACB" } },
        bottom: { style: "thin", color: { argb: "FFE2DACB" } },
        left: { style: "thin", color: { argb: "FFE2DACB" } },
        right: { style: "thin", color: { argb: "FFE2DACB" } },
      };

      if (
        colNumber === 1 ||
        colNumber === 2 ||
        colNumber === 3 ||
        colNumber === 5
      ) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNumber === 4) {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      } else if (colNumber === 6) {
        cell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
      } else if (colNumber === 7) {
        cell.numFmt = KG_NUM_FMT;
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if (colNumber >= 8) {
        cell.numFmt = RUPIAH_NUM_FMT;
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }
    });

    trackLen(0, String(idx + 1));
    trackLen(1, dateKey);
    trackLen(2, timeText);
    trackLen(3, sale.id);
    trackLen(4, paymentText);
    trackLen(5, itemsText);
    trackLen(6, totalKg.toFixed(2));
    trackLen(7, formatRupiah(revenue));
    if (isOwner) {
      trackLen(8, formatRupiah(cost));
      trackLen(9, formatRupiah(grossProfit));
    }
  });

  const lastDataRow = firstDataRow + sales.length - 1;
  const totalRowNumber = lastDataRow + 1;

  worksheet.mergeCells(`A${totalRowNumber}:F${totalRowNumber}`);
  const totalRow = worksheet.getRow(totalRowNumber);
  totalRow.height = 26;

  const totalLabelCell = worksheet.getCell(`A${totalRowNumber}`);
  totalLabelCell.value = `TOTAL (${sales.length} Transaksi)`;
  totalLabelCell.alignment = { horizontal: "right", vertical: "middle" };

  const totalKgCell = worksheet.getCell(`G${totalRowNumber}`);
  totalKgCell.value = {
    formula: `SUM(G${firstDataRow}:G${lastDataRow})`,
    result: sumKg,
  };
  totalKgCell.numFmt = KG_NUM_FMT;
  totalKgCell.alignment = { horizontal: "right", vertical: "middle" };

  const totalRevCell = worksheet.getCell(`H${totalRowNumber}`);
  totalRevCell.value = {
    formula: `SUM(H${firstDataRow}:H${lastDataRow})`,
    result: sumRevenue,
  };
  totalRevCell.numFmt = RUPIAH_NUM_FMT;
  totalRevCell.alignment = { horizontal: "right", vertical: "middle" };

  trackLen(6, sumKg.toFixed(2));
  trackLen(7, formatRupiah(sumRevenue));

  if (isOwner) {
    const totalCostCell = worksheet.getCell(`I${totalRowNumber}`);
    totalCostCell.value = {
      formula: `SUM(I${firstDataRow}:I${lastDataRow})`,
      result: sumCost,
    };
    totalCostCell.numFmt = RUPIAH_NUM_FMT;
    totalCostCell.alignment = { horizontal: "right", vertical: "middle" };

    const totalProfitCell = worksheet.getCell(`J${totalRowNumber}`);
    totalProfitCell.value = {
      formula: `SUM(J${firstDataRow}:J${lastDataRow})`,
      result: sumProfit,
    };
    totalProfitCell.numFmt = RUPIAH_NUM_FMT;
    totalProfitCell.alignment = { horizontal: "right", vertical: "middle" };

    trackLen(8, formatRupiah(sumCost));
    trackLen(9, formatRupiah(sumProfit));
  }

  for (let c = 1; c <= colCount; c += 1) {
    const cell = totalRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEDD5" },
    };
    cell.font = {
      name: "Calibri",
      size: 10.5,
      bold: true,
      color: { argb: "FF1C1917" },
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF9A3412" } },
      bottom: { style: "double", color: { argb: "FF9A3412" } },
      left: { style: "thin", color: { argb: "FFC9BFAE" } },
      right: { style: "thin", color: { argb: "FFC9BFAE" } },
    };
  }

  // Dibatasi supaya kolom tidak terlalu sempit (muncul ########) atau terlalu lebar.
  const minWidths = isOwner
    ? [6, 14, 14, 18, 15, 30, 17, 20, 20, 20]
    : [6, 14, 14, 18, 15, 30, 17, 20];
  const maxWidths = isOwner
    ? [10, 18, 18, 38, 18, 48, 22, 26, 26, 26]
    : [10, 18, 18, 38, 18, 48, 22, 26];

  for (let i = 0; i < colCount; i += 1) {
    const computed = Math.min(
      maxWidths[i],
      Math.max(minWidths[i], maxColLens[i] + 4)
    );
    worksheet.getColumn(i + 1).width = computed;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const suffix =
    startDate && endDate ? `${startDate}_sd_${endDate}` : todayKey;
  link.href = url;
  link.download = `Laporan-Penjualan-Berkah-Telur-Jaya-${suffix}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
