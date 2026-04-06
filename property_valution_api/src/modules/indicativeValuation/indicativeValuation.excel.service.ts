import ExcelJS from "exceljs";
import { NotFoundError } from "../../common/errors/notFound.error";
import type { IndicativeValuationFiltersDTO } from "./indicativeValuation.dto";
import {
  computeChargeFeeRangeNumber,
  normalizeFeePercent,
  resolveFeeAccessValueRangeNumber,
  sumComponentValueRangeNumber,
} from "./indicativeValuation.calculation";
import { IndicativeValuationRepository } from "./indicativeValuation.repository";

const COLORS = {
  brand: "FF981B1E",
  brandDark: "FF7F1D1D",
  brandSoft: "FFFEF2F2",
  navy: "FF173B7A",
  navySoft: "FFDCE6F8",
  text: "FF111827",
  muted: "FF6B7280",
  blue: "FF1D4ED8",
  blueSoft: "FFEFF6FF",
  blueBorder: "FFBFDBFE",
  amber: "FFB45309",
  amberSoft: "FFFFF3C7",
  light: "FFF9FAFB",
  border: "FFD1D5DB",
  white: "FFFFFFFF",
  successSoft: "FFECFDF5",
} as const;

const COMPANY_FOOTER = {
  address: "#F-36, Street 417, Sangkat Tonle Basak, Khan Chamkar Mon, Phnom Penh, Cambodia.",
  phone: "T: (+855) 81 456 007 / (+855) 77 818 001",
  email: "valuation@camtopproperty.com",
  website: "www.camtopproperty.com",
};

const repository = new IndicativeValuationRepository();

const formatDate = (value?: Date | null) => {
  if (!value) return "-";
  return value.toISOString().slice(0, 10);
};

const formatNumber = (value?: number | string | null, decimals = 2) => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatPercent = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "-";
  return Number.isInteger(numeric) ? `${numeric}%` : `${formatNumber(numeric, 2)}%`;
};

const formatCurrencyRange = (
  minValue?: number | string | null,
  maxValue?: number | string | null,
  currency = "USD",
) => {
  const minLabel =
    minValue === null || minValue === undefined ? "-" : `${currency} ${formatNumber(minValue, 2)}`;
  const maxLabel =
    maxValue === null || maxValue === undefined ? "-" : `${currency} ${formatNumber(maxValue, 2)}`;

  if (minLabel === "-" && maxLabel === "-") return "-";
  if (minLabel === maxLabel) return minLabel;
  if (minLabel === "-") return maxLabel;
  if (maxLabel === "-") return minLabel;
  return `${minLabel} - ${maxLabel}`;
};

const getCurrencyFormat = (currency?: string | null) => {
  if ((currency ?? "").toUpperCase() === "KHR") {
    return '#,##0.00 "KHR"';
  }
  return '$#,##0.00';
};

const getAddressPartLabel = (
  part?: {
    provinceName?: string | null;
    districtName?: string | null;
    communeName?: string | null;
    villageName?: string | null;
    nameEn?: string | null;
    nameKh?: string | null;
  } | null,
) =>
  part?.provinceName ??
  part?.districtName ??
  part?.communeName ??
  part?.villageName ??
  part?.nameEn ??
  part?.nameKh ??
  "";

const createBorder = (color: string = COLORS.border): Partial<ExcelJS.Borders> => ({
  top: { style: "thin", color: { argb: color } },
  left: { style: "thin", color: { argb: color } },
  bottom: { style: "thin", color: { argb: color } },
  right: { style: "thin", color: { argb: color } },
});

const applyCellStyle = (
  cell: ExcelJS.Cell,
  options?: {
    bold?: boolean;
    color?: string;
    fill?: string;
    align?: "left" | "center" | "right";
    vertical?: "top" | "middle" | "bottom";
    size?: number;
    wrapText?: boolean;
    borderColor?: string;
  },
) => {
  cell.font = {
    name: "Calibri",
    bold: options?.bold ?? false,
    size: options?.size ?? 11,
    color: { argb: options?.color ?? COLORS.text },
  };
  cell.alignment = {
    horizontal: options?.align ?? "left",
    vertical: options?.vertical ?? "middle",
    wrapText: options?.wrapText ?? false,
  };
  cell.border = createBorder(options?.borderColor ?? COLORS.border);

  if (options?.fill) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: options.fill },
    };
  }
};

const styleMergedRange = (
  worksheet: ExcelJS.Worksheet,
  range: string,
  options?: Parameters<typeof applyCellStyle>[1],
) => {
  const [startRef] = range.split(":");
  applyCellStyle(worksheet.getCell(startRef), options);
};

const addLabelValueRow = (
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  leftLabel: string,
  leftValue: string,
  rightLabel?: string,
  rightValue?: string,
) => {
  worksheet.mergeCells(`B${rowNumber}:D${rowNumber}`);
  worksheet.mergeCells(`F${rowNumber}:H${rowNumber}`);

  worksheet.getCell(`A${rowNumber}`).value = leftLabel;
  worksheet.getCell(`B${rowNumber}`).value = leftValue || "-";
  applyCellStyle(worksheet.getCell(`A${rowNumber}`), {
    bold: true,
    fill: COLORS.light,
    borderColor: COLORS.border,
  });
  applyCellStyle(worksheet.getCell(`B${rowNumber}`), {
    fill: COLORS.white,
    wrapText: true,
  });

  if (rightLabel) {
    worksheet.getCell(`E${rowNumber}`).value = rightLabel;
    worksheet.getCell(`F${rowNumber}`).value = rightValue || "-";
    applyCellStyle(worksheet.getCell(`E${rowNumber}`), {
      bold: true,
      fill: COLORS.light,
      borderColor: COLORS.border,
    });
    applyCellStyle(worksheet.getCell(`F${rowNumber}`), {
      fill: COLORS.white,
      wrapText: true,
    });
  } else {
    worksheet.mergeCells(`E${rowNumber}:H${rowNumber}`);
    worksheet.getCell(`E${rowNumber}`).value = "";
    applyCellStyle(worksheet.getCell(`E${rowNumber}`), { fill: COLORS.white });
  }

  worksheet.getRow(rowNumber).height = 22;
};

const buildImagePayload = async (
  url?: string | null,
): Promise<{ base64: string; extension: "png" | "jpeg" } | null> => {
  if (!url || typeof fetch !== "function") return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const extension: "png" | "jpeg" =
      contentType.includes("png") || url.toLowerCase().includes(".png") ? "png" : "jpeg";

    const arrayBuffer = await response.arrayBuffer();
    const base64 = `data:image/${extension};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
    return {
      base64,
      extension,
    };
  } catch {
    return null;
  }
};

const addPhotoBlock = async (
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  options: {
    title: string;
    imageUrl?: string | null;
    startColumn: "A" | "E";
    startRow: number;
  },
) => {
  const endColumn = options.startColumn === "A" ? "D" : "H";
  const titleCell = `${options.startColumn}${options.startRow}`;
  const imageTopRow = options.startRow + 1;
  const imageBottomRow = options.startRow + 7;
  const captionRow = options.startRow + 8;

  worksheet.mergeCells(`${options.startColumn}${options.startRow}:${endColumn}${options.startRow}`);
  worksheet.getCell(titleCell).value = options.title.toUpperCase();
  styleMergedRange(worksheet, `${options.startColumn}${options.startRow}:${endColumn}${options.startRow}`, {
    bold: true,
    color: COLORS.navy,
    fill: COLORS.navySoft,
    align: "center",
    size: 10,
  });

  for (let row = imageTopRow; row <= imageBottomRow; row += 1) {
    worksheet.mergeCells(`${options.startColumn}${row}:${endColumn}${row}`);
    applyCellStyle(worksheet.getCell(`${options.startColumn}${row}`), {
      fill: COLORS.white,
      borderColor: COLORS.blueBorder,
    });
    worksheet.getRow(row).height = 18;
  }

  const imagePayload = await buildImagePayload(options.imageUrl);

  if (imagePayload) {
    const imageId = workbook.addImage({
      base64: imagePayload.base64,
      extension: imagePayload.extension,
    });

    worksheet.addImage(imageId, {
      tl: {
        col: options.startColumn === "A" ? 0.15 : 4.15,
        row: imageTopRow - 1 + 0.15,
      },
      ext: {
        width: options.startColumn === "A" ? 292 : 292,
        height: 126,
      },
      editAs: "oneCell",
    });
  } else {
    worksheet.mergeCells(`${options.startColumn}${imageTopRow}:${endColumn}${imageBottomRow}`);
    worksheet.getCell(`${options.startColumn}${imageTopRow}`).value = "No image uploaded";
    styleMergedRange(
      worksheet,
      `${options.startColumn}${imageTopRow}:${endColumn}${imageBottomRow}`,
      {
        color: COLORS.muted,
        fill: COLORS.light,
        align: "center",
        wrapText: true,
      },
    );
  }

  worksheet.mergeCells(`${options.startColumn}${captionRow}:${endColumn}${captionRow}`);
  worksheet.getCell(`${options.startColumn}${captionRow}`).value = options.imageUrl || "-";
  styleMergedRange(worksheet, `${options.startColumn}${captionRow}:${endColumn}${captionRow}`, {
    color: COLORS.blue,
    fill: COLORS.blueSoft,
    align: "center",
    wrapText: true,
    size: 9,
  });
};

export const exportIndicativeValuationsToExcel = async (
  filters: IndicativeValuationFiltersDTO,
): Promise<Uint8Array> => {
  const valuations = await repository.findForExport(filters);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CAMTOP Property Group";
  workbook.company = "CAMTOP Property Group";
  workbook.subject = "Indicative Valuations Export";
  workbook.title = "Indicative Valuations Export";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("indicative-valuations");
  worksheet.columns = [
    { header: "indicationNo", key: "indicationNo", width: 24 },
    { header: "propertyTypeName", key: "propertyTypeName", width: 22 },
    { header: "instructedBy", key: "instructedBy", width: 24 },
    { header: "intendedUse", key: "intendedUse", width: 24 },
    { header: "instructionDate", key: "instructionDate", width: 18 },
    { header: "indicationDate", key: "indicationDate", width: 18 },
    { header: "minValue", key: "minValue", width: 16 },
    { header: "maxValue", key: "maxValue", width: 16 },
    { header: "forcedSaleValue", key: "forcedSaleValue", width: 18 },
    { header: "currency", key: "currency", width: 12 },
    { header: "valuerName", key: "valuerName", width: 22 },
    { header: "provinceName", key: "provinceName", width: 18 },
    { header: "districtName", key: "districtName", width: 18 },
    { header: "communeName", key: "communeName", width: 18 },
    { header: "villageName", key: "villageName", width: 18 },
    { header: "contactName", key: "contactName", width: 22 },
    { header: "contactTel", key: "contactTel", width: 18 },
  ];

  valuations.forEach((valuation) => {
    const marketTotals = sumComponentValueRangeNumber(valuation.components);
    const valuerName =
      valuation.valuer?.firstName || valuation.valuer?.lastName
        ? `${valuation.valuer?.firstName ?? ""} ${valuation.valuer?.lastName ?? ""}`.trim()
        : valuation.valuer?.username || "";

    worksheet.addRow({
      indicationNo: valuation.indicationNo ?? "",
      propertyTypeName: valuation.property?.propertyType?.propertyName ?? "",
      instructedBy: valuation.instructedBy ?? "",
      intendedUse: valuation.intendedUse ?? "",
      instructionDate: formatDate(valuation.instructionDate),
      indicationDate: formatDate(valuation.indicationDate),
      minValue: marketTotals.min ?? 0,
      maxValue: marketTotals.max ?? 0,
      forcedSaleValue: Number(valuation.forcedSaleValue ?? 0),
      currency: valuation.currency ?? "",
      valuerName,
      provinceName: getAddressPartLabel(valuation.property?.propertyAddress?.province),
      districtName: getAddressPartLabel(valuation.property?.propertyAddress?.district),
      communeName: getAddressPartLabel(valuation.property?.propertyAddress?.commune),
      villageName: getAddressPartLabel(valuation.property?.propertyAddress?.village),
      contactName: valuation.contactName ?? "",
      contactTel: valuation.contactTel ?? "",
    });
  });

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.eachCell((cell) => {
    cell.border = createBorder();
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navySoft },
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = createBorder();
    });
  });

  ["G", "H", "I"].forEach((column) => {
    worksheet.getColumn(column).numFmt = "$#,##0.00";
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
};

export const exportIndicativeValuationToExcel = async (
  indicationId: number,
): Promise<Uint8Array> => {
  const indication = await repository.findWithComponents(indicationId);

  if (!indication || !indication.components.length) {
    throw new NotFoundError(`Indicative valuation ${indicationId} not found`);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CAMTOP Property Group";
  workbook.company = "CAMTOP Property Group";
  workbook.subject = "Indicative Value Summary";
  workbook.title = `${indication.indicationNo} Indicative Value Summary`;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Indicative Summary", {
    views: [{ state: "frozen", ySplit: 12 }],
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  const property = indication.property;
  const indicationRecord = indication as any;
  const propertyPhotos = property?.propertyPhotos ?? null;
  const addressLine = [
    getAddressPartLabel(property?.propertyAddress?.village),
    getAddressPartLabel(property?.propertyAddress?.commune),
    getAddressPartLabel(property?.propertyAddress?.district),
    getAddressPartLabel(property?.propertyAddress?.province),
  ]
    .filter(Boolean)
    .join(", ");
  const valuerName =
    indication.valuer?.firstName || indication.valuer?.lastName
      ? `${indication.valuer?.firstName ?? ""} ${indication.valuer?.lastName ?? ""}`.trim()
      : indication.valuer?.username || "-";
  const contactName =
    indicationRecord.contactName ?? property?.dataSource?.contactName ?? valuerName;
  const contactTel =
    indicationRecord.contactTel ?? property?.dataSource?.phoneNumber ?? "-";
  const forcedSalePercent =
    indication.forcedSalePercent != null ? Number(indication.forcedSalePercent) : 0;
  const marketTotals = sumComponentValueRangeNumber(indication.components);
  const totalMin = marketTotals.min ?? 0;
  const totalMax = marketTotals.max ?? 0;
  const forcedSaleValue =
    indication.forcedSaleValue != null
      ? Number(indication.forcedSaleValue)
      : totalMax * (forcedSalePercent / 100);
  const accessValueRange = resolveFeeAccessValueRangeNumber({
    accessValue: indicationRecord.accessValue,
    fallbackMinAccessValue: totalMin,
    fallbackMaxAccessValue: totalMax,
    treatMaxMatchAsAuto: true,
  });
  const feeRate =
    indicationRecord.feeRate != null ? normalizeFeePercent(indicationRecord.feeRate) : null;
  const discount =
    indicationRecord.discount != null ? normalizeFeePercent(indicationRecord.discount) : null;
  const chargeFeeRange = computeChargeFeeRangeNumber({
    accessValue: indicationRecord.accessValue,
    fallbackMinAccessValue: totalMin,
    fallbackMaxAccessValue: totalMax,
    feeRate: indicationRecord.feeRate,
    discount: indicationRecord.discount,
    treatMaxMatchAsAuto: true,
  });
  const currencyFormat = getCurrencyFormat(indication.currency);

  worksheet.columns = [
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
  ];

  worksheet.mergeCells("A1:H1");
  worksheet.getCell("A1").value = "CAMTOP PROPERTY GROUP";
  styleMergedRange(worksheet, "A1:H1", {
    bold: true,
    color: COLORS.white,
    fill: COLORS.brand,
    align: "center",
    size: 18,
  });
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells("A2:H2");
  worksheet.getCell("A2").value = "INDICATED VALUE SUMMARY";
  styleMergedRange(worksheet, "A2:H2", {
    bold: true,
    color: COLORS.navy,
    fill: COLORS.navySoft,
    align: "center",
    size: 13,
  });
  worksheet.getRow(2).height = 24;

  worksheet.mergeCells("A3:H3");
  worksheet.getCell("A3").value = `${indication.indicationNo} - ${property?.propertyType?.propertyName ?? "Indicative Valuation"}`;
  styleMergedRange(worksheet, "A3:H3", {
    bold: true,
    color: COLORS.brandDark,
    fill: COLORS.light,
    align: "center",
    size: 11,
  });

  const summaryCards = [
    {
      range: "A5:B6",
      label: "Reference",
      value: indication.indicationNo || "-",
      fill: COLORS.brandSoft ?? COLORS.light,
      color: COLORS.brand,
    },
    {
      range: "C5:D6",
      label: "Property Type",
      value: property?.propertyType?.propertyName ?? "-",
      fill: COLORS.navySoft,
      color: COLORS.navy,
    },
    {
      range: "E5:F6",
      label: "Instructed By",
      value: indication.instructedBy ?? "-",
      fill: COLORS.blueSoft,
      color: COLORS.blue,
    },
    {
      range: "G5:H6",
      label: "Value Date",
      value: formatDate(indication.indicationDate),
      fill: COLORS.successSoft,
      color: COLORS.brandDark,
    },
  ];

  for (const card of summaryCards) {
    worksheet.mergeCells(card.range);
    const [startRef] = card.range.split(":");
    worksheet.getCell(startRef).value = `${card.label}\n${card.value}`;
    styleMergedRange(worksheet, card.range, {
      bold: true,
      fill: card.fill,
      color: card.color,
      align: "center",
      wrapText: true,
      size: 11,
      borderColor: COLORS.border,
    });
  }
  worksheet.getRow(5).height = 24;
  worksheet.getRow(6).height = 32;

  worksheet.mergeCells("A8:H8");
  worksheet.getCell("A8").value = "VALUATION OVERVIEW";
  styleMergedRange(worksheet, "A8:H8", {
    bold: true,
    color: COLORS.white,
    fill: COLORS.navy,
    align: "left",
    size: 11,
  });

  addLabelValueRow(
    worksheet,
    9,
    "Instruction Date",
    formatDate(indication.instructionDate),
    "Indication Date",
    formatDate(indication.indicationDate),
  );
  addLabelValueRow(
    worksheet,
    10,
    "Contact Name",
    contactName || "-",
    "Contact Tel",
    contactTel || "-",
  );
  addLabelValueRow(
    worksheet,
    11,
    "Valuer",
    valuerName,
    "Access Value",
    formatCurrencyRange(accessValueRange.min, accessValueRange.max, indication.currency ?? "USD"),
  );
  addLabelValueRow(
    worksheet,
    12,
    "Fee Rate",
    formatPercent(feeRate),
    "Discount",
    formatPercent(discount),
  );
  addLabelValueRow(
    worksheet,
    13,
    "Fee Charge",
    formatCurrencyRange(chargeFeeRange.min, chargeFeeRange.max, indication.currency ?? "USD"),
    "Currency",
    indication.currency ?? "USD",
  );
  addLabelValueRow(
    worksheet,
    14,
    "Intended Use",
    indication.intendedUse ?? "-",
    "Coordinates",
    property?.propertyLocation?.latitude != null &&
      property?.propertyLocation?.longitude != null
      ? `${property.propertyLocation.latitude}, ${property.propertyLocation.longitude}`
      : "-",
  );
  addLabelValueRow(
    worksheet,
    15,
    "Property Type",
    property?.propertyType?.propertyName ?? "-",
  );
  addLabelValueRow(worksheet, 16, "Property Address", addressLine || "-");

  worksheet.mergeCells("A18:H18");
  worksheet.getCell("A18").value = "PROPERTY PHOTOS";
  styleMergedRange(worksheet, "A18:H18", {
    bold: true,
    color: COLORS.white,
    fill: COLORS.navy,
    align: "left",
    size: 11,
  });

  await addPhotoBlock(workbook, worksheet, {
    title: "Front Side",
    imageUrl: propertyPhotos?.frontSide,
    startColumn: "A",
    startRow: 19,
  });
  await addPhotoBlock(workbook, worksheet, {
    title: "Inside View",
    imageUrl: propertyPhotos?.inside,
    startColumn: "E",
    startRow: 19,
  });

  worksheet.mergeCells("A29:H29");
  worksheet.getCell("A29").value = "INDICATED VALUE BREAKDOWN";
  styleMergedRange(worksheet, "A29:H29", {
    bold: true,
    color: COLORS.white,
    fill: COLORS.navy,
    align: "left",
    size: 11,
  });

  const tableHeaderRow = 30;
  const headerValues = [
    "No.",
    "Description",
    null,
    "Area (sqm)",
    "Min Rate",
    "Max Rate",
    "Min Value",
    "Max Value",
  ] as const;

  worksheet.mergeCells(`B${tableHeaderRow}:C${tableHeaderRow}`);

  headerValues.forEach((value, index) => {
    if (value === null) return;
    const cell = worksheet.getCell(tableHeaderRow, index + 1);
    cell.value = value;
    applyCellStyle(cell, {
      bold: true,
      color: COLORS.white,
      fill: COLORS.navy,
      align: "center",
      size: 10,
    });
  });
  applyCellStyle(worksheet.getCell(`B${tableHeaderRow}`), {
    bold: true,
    color: COLORS.white,
    fill: COLORS.navy,
    align: "center",
    size: 10,
  });
  worksheet.getRow(tableHeaderRow).height = 22;

  let currentRow = tableHeaderRow + 1;
  for (const [index, component] of indication.components.entries()) {
    worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = index + 1;
    worksheet.getCell(`B${currentRow}`).value = component.description ?? component.componentType;
    worksheet.getCell(`D${currentRow}`).value = Number(component.area);
    worksheet.getCell(`E${currentRow}`).value = Number(component.minRate);
    worksheet.getCell(`F${currentRow}`).value = Number(component.maxRate);
    worksheet.getCell(`G${currentRow}`).value = Number(component.minValue);
    worksheet.getCell(`H${currentRow}`).value = Number(component.maxValue);

    const fill = index % 2 === 0 ? COLORS.white : COLORS.light;
    ["A", "B", "D", "E", "F", "G", "H"].forEach((column) => {
      applyCellStyle(worksheet.getCell(`${column}${currentRow}`), {
        fill,
        align: column === "B" ? "left" : "right",
      });
    });
    applyCellStyle(worksheet.getCell(`A${currentRow}`), {
      fill,
      align: "center",
    });

    worksheet.getCell(`D${currentRow}`).numFmt = '#,##0.00 "sqm"';
    worksheet.getCell(`E${currentRow}`).numFmt = currencyFormat;
    worksheet.getCell(`F${currentRow}`).numFmt = currencyFormat;
    worksheet.getCell(`G${currentRow}`).numFmt = currencyFormat;
    worksheet.getCell(`H${currentRow}`).numFmt = currencyFormat;
    worksheet.getRow(currentRow).height = 20;
    currentRow += 1;
  }

  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "Grand Total IV Range";
  worksheet.getCell(`G${currentRow}`).value = totalMin;
  worksheet.getCell(`H${currentRow}`).value = totalMax;
  styleMergedRange(worksheet, `A${currentRow}:F${currentRow}`, {
    bold: true,
    fill: COLORS.light,
  });
  applyCellStyle(worksheet.getCell(`G${currentRow}`), {
    bold: true,
    fill: COLORS.light,
    align: "right",
  });
  applyCellStyle(worksheet.getCell(`H${currentRow}`), {
    bold: true,
    fill: COLORS.light,
    align: "right",
  });
  worksheet.getCell(`G${currentRow}`).numFmt = currencyFormat;
  worksheet.getCell(`H${currentRow}`).numFmt = currencyFormat;
  currentRow += 1;

  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  worksheet.mergeCells(`G${currentRow}:H${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = `Forced Sale Value (${formatPercent(forcedSalePercent)})`;
  worksheet.getCell(`G${currentRow}`).value = forcedSaleValue;
  styleMergedRange(worksheet, `A${currentRow}:F${currentRow}`, {
    bold: true,
    fill: COLORS.amberSoft,
    color: COLORS.amber,
  });
  styleMergedRange(worksheet, `G${currentRow}:H${currentRow}`, {
    bold: true,
    fill: COLORS.amberSoft,
    color: COLORS.amber,
    align: "center",
  });
  worksheet.getCell(`G${currentRow}`).numFmt = currencyFormat;
  currentRow += 2;

  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "NOTE";
  styleMergedRange(worksheet, `A${currentRow}:H${currentRow}`, {
    bold: true,
    color: COLORS.white,
    fill: COLORS.navy,
    align: "left",
    size: 11,
  });
  currentRow += 1;

  worksheet.mergeCells(`A${currentRow}:H${currentRow + 2}`);
  worksheet.getCell(`A${currentRow}`).value =
    indication.note?.trim() ||
    "All information such as land size, building size, location and pictures/images are provided by the bank/client; they are subject to inspection. We, CAMTOP Property Group, disclaim all responsibility and accept no liability to any party.";
  styleMergedRange(worksheet, `A${currentRow}:H${currentRow + 2}`, {
    fill: COLORS.light,
    wrapText: true,
    vertical: "top",
  });
  worksheet.getRow(currentRow).height = 24;
  worksheet.getRow(currentRow + 1).height = 24;
  worksheet.getRow(currentRow + 2).height = 24;
  currentRow += 4;

  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = COMPANY_FOOTER.address;
  styleMergedRange(worksheet, `A${currentRow}:H${currentRow}`, {
    color: COLORS.muted,
    align: "center",
    size: 9,
  });
  currentRow += 1;

  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = `${COMPANY_FOOTER.phone} | ${COMPANY_FOOTER.email} | ${COMPANY_FOOTER.website}`;
  styleMergedRange(worksheet, `A${currentRow}:H${currentRow}`, {
    color: COLORS.muted,
    align: "center",
    size: 9,
  });

  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (!cell.border) {
        cell.border = createBorder();
      }
      if (!cell.alignment) {
        cell.alignment = { vertical: "middle" };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
};
