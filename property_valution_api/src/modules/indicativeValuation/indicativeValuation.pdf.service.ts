import type { IndicativeValuationWithRelations } from "./indicativeValuation.repository";
import {
  resolveFeeAccessValueRangeNumber,
  sumComponentValueRangeNumber,
} from "./indicativeValuation.calculation";
import { FileUploadService } from "../../services/fileUpload.service";

const PDFDocument = require("pdfkit");

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 30,
  marginY: 28,
};

const COLORS = {
  brand: "#981B1E",
  brandDark: "#7F1D1D",
  navy: "#173B7A",
  navySoft: "#DCE6F8",
  text: "#111827",
  muted: "#6B7280",
  blue: "#1D4ED8",
  blueSoft: "#EFF6FF",
  blueBorder: "#BFDBFE",
  brandSoft: "#FEF2F2",
  brandBorder: "#FECACA",
  emerald: "#047857",
  emeraldSoft: "#ECFDF5",
  emeraldBorder: "#A7F3D0",
  amber: "#B45309",
  amberSoft: "#FFFBEB",
  amberBorder: "#FCD34D",
  slateSoft: "#F8FAFC",
  slateBorder: "#CBD5E1",
  border: "#D1D5DB",
  light: "#F9FAFB",
};

const COMPANY_FOOTER = {
  address: "#F-36, Street 417, Sangkat Tonle Basak, Khan Chamkar Mon, Phnom Penh, Cambodia.",
  phone: "T: (+855) 81 456 007 / (+855) 77 818 001",
  email: "valuation@camtopproperty.com",
  website: "www.camtopproperty.com",
};

const HEADER = {
  logoX: 86,
  logoY: 10,
  logoWidth: 170,
  logoHeight: 48,
  taglineX: 350,
  taglineY: 35,
  dividerY: 74,
  titleY: 120,
};

const FOOTER = {
  dividerY: PAGE.height - 102,
  addressY: PAGE.height - 90,
  phoneY: PAGE.height - 67,
  linksY: PAGE.height - 44,
};

const CONTENT = {
  leftX: 72,
  rightX: PAGE.width - 72,
  width: PAGE.width - 144,
  infoColonX: 268,
  infoValueX: 284,
  imageGap: 18,
  imageHeight: 126,
  tableX: 72,
  tableWidth: PAGE.width - 144,
};

const STORAGE_PUBLIC_BASE_URL =
  (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").trim().replace(/\/+$/, "") ||
  "https://cdn.camtopproperty.site";
const INDICATIVE_PDF_PUBLIC_BASE_URL =
  process.env.INDICATIVE_PDF_PUBLIC_BASE_URL?.trim() ||
  `${STORAGE_PUBLIC_BASE_URL}/indicative`;

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
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

const formatCurrencyValue = (value?: number | string | null, currency = "USD") => {
  const formattedNumber = formatNumber(value, 2);
  if (formattedNumber === "-") return "-";
  return `${currency} ${formattedNumber}`;
};

const formatCurrencyRange = (
  minValue?: number | string | null,
  maxValue?: number | string | null,
  currency = "USD",
) => {
  const minLabel = formatCurrencyValue(minValue, currency);
  const maxLabel = formatCurrencyValue(maxValue, currency);

  if (minLabel === "-" && maxLabel === "-") return "-";
  if (minLabel === maxLabel) return minLabel;
  if (minLabel === "-") return maxLabel;
  if (maxLabel === "-") return minLabel;
  return `${minLabel} - ${maxLabel}`;
};

const truncateText = (value?: string | null, maxLength = 180) => {
  const text = value?.trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
};

const normalizeIndicationNoForFileName = (indicationNo: string) =>
  indicationNo.replace(/\s+/g, "");

const buildPdfFileName = (indicationNo: string, version: number = 1) =>
  `RefNo${normalizeIndicationNoForFileName(indicationNo)}v${version}.pdf`;

const buildPdfStorageKey = (indicationNo: string, version: number = 1) =>
  `indicative/${buildPdfFileName(indicationNo, version)}`;

const buildPdfPublicUrl = (fileName: string) =>
  `${INDICATIVE_PDF_PUBLIC_BASE_URL}/${encodeURIComponent(fileName)}`;

const getPropertyTypeLabel = (indication: IndicativeValuationWithRelations) =>
  indication.property?.propertyType?.propertyName ?? "Indicative Valuation";

const getAddressPartLabel = (
  part?: { nameEn?: string | null; nameKh?: string | null } | null
) => part?.nameEn ?? part?.nameKh ?? "";

const getAddressLine = (indication: IndicativeValuationWithRelations) =>
  [
    getAddressPartLabel(indication.property?.propertyAddress?.village),
    getAddressPartLabel(indication.property?.propertyAddress?.commune),
    getAddressPartLabel(indication.property?.propertyAddress?.district),
    getAddressPartLabel(indication.property?.propertyAddress?.province),
  ]
    .filter(Boolean)
    .join(", ");

const getCoordinatesLabel = (indication: IndicativeValuationWithRelations) => {
  const latitude = indication.property?.propertyLocation?.latitude;
  const longitude = indication.property?.propertyLocation?.longitude;
  if (latitude == null || longitude == null) return "-";
  return `${latitude}, ${longitude}`;
};

const getContactDetailLabel = (indication: IndicativeValuationWithRelations) => {
  const contactName = indication.contactName ?? indication.property?.dataSource?.contactName;
  const contactTel =
    indication.contactTel ??
    ((indication.property?.dataSource as { phoneNumber?: string | null } | undefined)
      ?.phoneNumber ?? null);

  if (contactName && contactTel) {
    return `${contactName} (${contactTel})`;
  }

  return contactName || contactTel || "-";
};

const fetchBinary = async (url?: string | null): Promise<Buffer | null> => {
  if (!url) return null;

  const storedAsset = await FileUploadService.downloadFileAsset(url);
  if (storedAsset?.buffer) {
    return storedAsset.buffer;
  }

  if (typeof fetch !== "function") return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
};

const addImageOrPlaceholder = (
  doc: any,
  imageBuffer: Buffer | null,
  x: number,
  y: number,
  width: number,
  height: number,
  caption: string
) => {
  const safeCaption = caption.trim();

  if (safeCaption) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.navy)
      .text(safeCaption.toUpperCase(), x, y - 14, {
        width,
        align: "left",
      });
  }

  doc.save();
  doc.roundedRect(x, y, width, height, 3).fillAndStroke("#FFFFFF", COLORS.blueBorder);
  doc.restore();

  doc.save();
  doc.roundedRect(x + 4, y + 4, width - 8, height - 8, 2).clip();

  if (imageBuffer) {
    try {
      doc.image(imageBuffer, x + 4, y + 4, {
        fit: [width - 8, height - 8],
        align: "center",
        valign: "center",
      });
    } catch {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text("Image unavailable", x + 10, y + height / 2 - 6, {
          width: width - 20,
          align: "center",
        });
    }
  } else {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("No image uploaded", x + 10, y + height / 2 - 6, {
        width: width - 20,
        align: "center",
      });
  }
  doc.restore();

  doc
    .roundedRect(x, y, width, height, 3)
    .lineWidth(0.8)
    .strokeColor(COLORS.navy)
    .stroke();
};

const drawHeaderLogoIcon = (doc: any, x: number, y: number) => {
  doc.save();
  doc.lineWidth(1.7).strokeColor("#39579B");
  doc
    .moveTo(x, y + 38)
    .lineTo(x + 12, y + 38)
    .lineTo(x + 12, y + 14)
    .lineTo(x + 24, y + 8)
    .lineTo(x + 24, y + 38)
    .lineTo(x + 34, y + 38)
    .lineTo(x + 34, y + 6)
    .lineTo(x + 48, y)
    .lineTo(x + 48, y + 38)
    .lineTo(x + 62, y + 38)
    .stroke();

  doc
    .moveTo(x + 24, y + 8)
    .lineTo(x + 48, y + 8)
    .lineTo(x + 48, y + 38)
    .stroke();
  doc.restore();
};

const drawHeaderBrand = (doc: any) => {
  drawHeaderLogoIcon(doc, HEADER.logoX, HEADER.logoY + 2);

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#232323")
    .text("CAMTOP", HEADER.logoX + 70, HEADER.logoY + 17, {
      width: 126,
      align: "left",
    });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#5B5F69")
    .text("PROPERTY GROUP", HEADER.logoX + 70, HEADER.logoY + 33, {
      width: 126,
      align: "left",
    });
};

const drawHeader = (doc: any) => {
  drawHeaderBrand(doc);

  doc
    .font("Times-Roman")
    .fontSize(10.5)
    .fillColor(COLORS.navy)
    .text("Your Trusted Realty Partner!", HEADER.taglineX, HEADER.taglineY, {
      width: PAGE.width - HEADER.taglineX - 54,
      align: "right",
    });

  doc
    .moveTo(CONTENT.leftX + 8, HEADER.dividerY)
    .lineTo(CONTENT.rightX + 2, HEADER.dividerY)
    .lineWidth(0.9)
    .strokeColor("#86A7DE")
    .stroke();
};

const drawFooterLinks = (doc: any, x: number, y: number) => {
  doc
    .font("Times-Roman")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text("E:", x, y, { continued: true });
  doc
    .font("Times-Roman")
    .fontSize(9)
    .fillColor(COLORS.blue)
    .text(` ${COMPANY_FOOTER.email}`, { continued: true, underline: true });
  doc
    .font("Times-Roman")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(", W:", { continued: true });
  doc
    .font("Times-Roman")
    .fontSize(9)
    .fillColor(COLORS.blue)
    .text(` ${COMPANY_FOOTER.website}`, {
      width: CONTENT.width,
      align: "left",
      underline: true,
    });
};

const drawTableCell = (
  doc: any,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  options?: {
    align?: "left" | "center" | "right";
    bold?: boolean;
    color?: string;
    fill?: string;
    fontName?: string;
    fontSize?: number;
    borderColor?: string;
    paddingX?: number;
    paddingY?: number;
  }
) => {
  if (options?.fill) {
    doc.save();
    doc.rect(x, y, width, height).fill(options.fill);
    doc.restore();
  }

  const paddingX = options?.paddingX ?? 6;
  const paddingY = options?.paddingY ?? 6;

  doc
    .rect(x, y, width, height)
    .lineWidth(0.6)
    .strokeColor(options?.borderColor ?? COLORS.border)
    .stroke();
  doc
    .font(options?.fontName ?? (options?.bold ? "Times-Bold" : "Times-Roman"))
    .fontSize(options?.fontSize ?? 9)
    .fillColor(options?.color ?? COLORS.text)
    .text(text, x + paddingX, y + paddingY, {
      width: width - paddingX * 2,
      align: options?.align ?? "left",
    });
};

const drawDivider = (doc: any, y: number) => {
  doc
    .moveTo(CONTENT.leftX, y)
    .lineTo(CONTENT.rightX, y)
    .lineWidth(1.1)
    .strokeColor("#86A7DE")
    .stroke();
};

const drawClassicInfoRow = (
  doc: any,
  y: number,
  label: string,
  value: string,
  options?: { valueWidth?: number; fontSize?: number }
) => {
  const labelX = CONTENT.leftX;
  const colonX = CONTENT.infoColonX;
  const valueX = CONTENT.infoValueX;
  const fontSize = options?.fontSize ?? 11;
  const safeValue = value || "-";

  doc
    .font("Times-Bold")
    .fontSize(fontSize)
    .fillColor(COLORS.text)
    .text(label, labelX, y, {
      width: colonX - labelX - 10,
      align: "left",
    });
  doc
    .font("Times-Bold")
    .fontSize(fontSize)
    .fillColor(COLORS.text)
    .text(":", colonX, y, { width: 8, align: "center" });

  doc
    .font("Times-Roman")
    .fontSize(fontSize)
    .fillColor(COLORS.text)
    .text(safeValue, valueX, y, {
      width: options?.valueWidth ?? 235,
      align: "left",
    });

  const textHeight = doc.heightOfString(safeValue, {
    width: options?.valueWidth ?? 235,
    align: "left",
  });
  return Math.max(22, textHeight + 4);
};

const formatPercent = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "-";
  return Number.isInteger(numeric) ? `${numeric}%` : `${formatNumber(numeric, 2)}%`;
};

const getTableRowHeight = (doc: any, values: string[], widths: number[]) => {
  doc.font("Times-Roman").fontSize(9);
  const heights = values.map((value, index) =>
    doc.heightOfString(value, {
      width: widths[index] - 12,
      align: index === 0 ? "left" : "right",
    }),
  );

  return Math.max(22, ...heights.map((height) => height + 10));
};

const drawNoteBlock = (doc: any, x: number, y: number, width: number, text: string) => {
  const noteContent = truncateText(text, 360);
  doc.font("Times-Italic").fontSize(8.5);
  const noteHeight =
    doc.heightOfString(noteContent, {
      width: width - 28,
      align: "left",
    }) + 8;

  doc
    .font("Times-BoldItalic")
    .fontSize(8.5)
    .fillColor(COLORS.text)
    .text("Note:", x, y, { width: 28, align: "left" });
  doc
    .font("Times-Italic")
    .fontSize(8.5)
    .fillColor(COLORS.text)
    .text(noteContent, x + 28, y, {
      width: width - 28,
      align: "left",
    });

  return noteHeight;
};

const drawFooter = (doc: any) => {
  drawDivider(doc, FOOTER.dividerY);

  doc
    .font("Times-Roman")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(COMPANY_FOOTER.address, CONTENT.leftX, FOOTER.addressY, {
      width: CONTENT.width,
      align: "left",
    });
  doc
    .font("Times-Roman")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(COMPANY_FOOTER.phone, CONTENT.leftX, FOOTER.phoneY, {
      width: CONTENT.width,
      align: "left",
    });
  drawFooterLinks(doc, CONTENT.leftX, FOOTER.linksY);
};

export const createIndicativeValuationPdf = async (
  indication: IndicativeValuationWithRelations,
  version: number = 1,
): Promise<{ buffer: Buffer; fileName: string }> => {
  const [frontBuffer, insideBuffer] = await Promise.all([
    fetchBinary(indication.property?.propertyPhotos?.frontSide),
    fetchBinary(indication.property?.propertyPhotos?.inside),
  ]);

  const propertyTypeLabel = getPropertyTypeLabel(indication);
  const addressLine = getAddressLine(indication) || "-";
  const coordinatesLabel = getCoordinatesLabel(indication);
  const contactDetailLabel = getContactDetailLabel(indication);
  const fileName = buildPdfFileName(indication.indicationNo, version);
  const marketTotals = sumComponentValueRangeNumber(indication.components);
  const totalMin = marketTotals.min ?? 0;
  const totalMax = marketTotals.max ?? 0;
  const forcedSalePercent =
    indication.forcedSalePercent != null ? Number(indication.forcedSalePercent) : 0;
  const forcedSaleMaxValue =
    indication.forcedSaleValue != null
      ? Number(indication.forcedSaleValue)
      : totalMax * (forcedSalePercent / 100);
  const accessValueRange = resolveFeeAccessValueRangeNumber({
    accessValue: (indication as any).accessValue,
    fallbackMinAccessValue: totalMin,
    fallbackMaxAccessValue: totalMax,
    treatMaxMatchAsAuto: true,
  });
  const referenceNo = indication.indicationNo || "-";
  const financerLabel = indication.instructedBy ?? "-";
  const purposeLabel = indication.intendedUse ?? "-";
  const noteText =
    indication.note?.trim() ||
    "All information such as land size, building size, location and pictures/images are provided by the bank/client; they are subject to inspection. We, CAMTOP Property Group, disclaim all responsibility and accept no liability to any party.";
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    bufferPages: true,
    autoFirstPage: true,
  });

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.rect(0, 0, PAGE.width, PAGE.height).fill("#FFFFFF");
  const titleY = 48;

  doc
    .font("Times-Bold")
    .fontSize(14.5)
    .fillColor(COLORS.text)
    .text("Indicated Value Summary", 0, titleY, {
      width: PAGE.width,
      align: "center",
    });

  let y = titleY + 34;
  const infoRows = [
    ["Reference", referenceNo],
    ["Instructed By", financerLabel],
    ["Contact Detail", contactDetailLabel],
    ["Access Value", formatCurrencyRange(accessValueRange.min, accessValueRange.max, indication.currency ?? "USD")],
    ["Purpose of Valuation", purposeLabel],
    ["Instructed Date", formatDate(indication.instructionDate)],
    ["Indicated Value Date", formatDate(indication.indicationDate)],
    ["Property Address", addressLine],
    ["Property Type", propertyTypeLabel],
    ["Google Earth Point", coordinatesLabel],
  ] as const;

  infoRows.forEach(([label, value]) => {
    y += drawClassicInfoRow(doc, y, label, value, {
      valueWidth: label === "Property Address" ? 216 : 226,
    });
  });

  const imageY = Math.max(y + 18, 350);
  const imageWidth = (CONTENT.width - CONTENT.imageGap) / 2;
  const secondImageX = CONTENT.leftX + imageWidth + CONTENT.imageGap;

  addImageOrPlaceholder(
    doc,
    frontBuffer,
    CONTENT.leftX,
    imageY,
    imageWidth,
    CONTENT.imageHeight,
    "Front Side",
  );
  addImageOrPlaceholder(
    doc,
    insideBuffer,
    secondImageX,
    imageY,
    imageWidth,
    CONTENT.imageHeight,
    "Inside View",
  );

  const tableY = imageY + CONTENT.imageHeight + 16;
  const columns = [120, 55, 56, 56, 82, 82];
  const tableX = CONTENT.tableX;
  const rowHeight = 22;
  const headerLabels = [
    "Description",
    "Area (sqm)",
    "Min Rate",
    "Max Rate",
    "Min Value",
    "Max Value",
  ];

  let cursorX = tableX;
  headerLabels.forEach((label, index) => {
    drawTableCell(doc, cursorX, tableY, columns[index], rowHeight, label, {
      align: "center",
      bold: true,
      color: "#FFFFFF",
      fill: COLORS.navy,
      fontName: "Times-Bold",
      fontSize: 8.5,
      paddingX: 4,
      paddingY: 6,
    });
    cursorX += columns[index];
  });

  let currentY = tableY + rowHeight;
  indication.components.forEach((component: any, index: number) => {
    const rowValues = [
      component.description ?? component.componentType,
      formatNumber(Number(component.area), 2),
      formatNumber(Number(component.minRate), 2),
      formatNumber(Number(component.maxRate), 2),
      formatNumber(Number(component.minValue), 2),
      formatNumber(Number(component.maxValue), 2),
    ];
    const componentRowHeight = getTableRowHeight(doc, rowValues, columns);

    let cellX = tableX;
    rowValues.forEach((value, valueIndex) => {
      drawTableCell(doc, cellX, currentY, columns[valueIndex], componentRowHeight, value, {
        align: valueIndex === 0 ? "left" : "right",
        bold: false,
        fill: index % 2 === 0 ? "#FFFFFF" : COLORS.light,
        fontName: "Times-Roman",
        fontSize: 8.5,
        paddingX: 5,
        paddingY: 5,
      });
      cellX += columns[valueIndex];
    });
    currentY += componentRowHeight;
  });

  const totalLabelWidth = columns[0] + columns[1] + columns[2] + columns[3];
  drawTableCell(
    doc,
    tableX,
    currentY,
    totalLabelWidth,
    rowHeight,
    "Grand Total IV Range",
    {
      bold: true,
      fill: "#F3F4F6",
      fontName: "Times-Bold",
    }
  );
  drawTableCell(
    doc,
    tableX + totalLabelWidth,
    currentY,
    columns[4],
    rowHeight,
    formatNumber(totalMin, 2),
    {
      align: "right",
      bold: true,
      fill: "#F3F4F6",
      fontName: "Times-Bold",
    }
  );
  drawTableCell(
    doc,
    tableX + totalLabelWidth + columns[4],
    currentY,
    columns[5],
    rowHeight,
    formatNumber(totalMax, 2),
    {
      align: "right",
      bold: true,
      fill: "#F3F4F6",
      fontName: "Times-Bold",
    }
  );
  currentY += rowHeight;

  drawTableCell(
    doc,
    tableX,
    currentY,
    totalLabelWidth,
    rowHeight,
    `Forced Sale Value (${formatPercent(forcedSalePercent)})`,
    {
      bold: true,
      fill: "#FEF3C7",
      fontName: "Times-Bold",
    }
  );
  drawTableCell(
    doc,
    tableX + totalLabelWidth,
    currentY,
    columns[4] + columns[5],
    rowHeight,
    formatNumber(forcedSaleMaxValue, 2),
    {
      align: "center",
      bold: true,
      fill: "#FEF3C7",
      fontName: "Times-Bold",
    }
  );
  currentY += rowHeight;

  drawNoteBlock(doc, tableX, currentY + 12, CONTENT.tableWidth, noteText);

  doc.end();

  const buffer = await bufferPromise;
  return { buffer, fileName };
};

export const indicativePdfHelpers = {
  buildPdfFileName,
  buildPdfStorageKey,
  buildPdfPublicUrl,
};
