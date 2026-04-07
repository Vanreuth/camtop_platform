const DEFAULT_NOTE =
  "This property value estimation is provided solely for the purpose of calculating professional fees and shall not be used for any other purpose.";
const DEFAULT_INTERNAL_SUGGESTION =
  "Next time, as suggestion from your internal team, please note if it new load, additional or review loan.";

const formatCurrency = (
  value?: number | string | null,
  currency: string = "USD",
  digits?: number,
) => {
  if (value === null || value === undefined || value === "") return "-";

  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "-";

  const resolvedDigits =
    digits ?? (Number.isInteger(numeric) ? 0 : 2);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: resolvedDigits,
    maximumFractionDigits: resolvedDigits,
  }).format(numeric);
};

const formatCurrencyRange = (
  minValue?: number | string | null,
  maxValue?: number | string | null,
  currency: string = "USD",
) => {
  const minLabel = formatCurrency(minValue, currency, 2);
  const maxLabel = formatCurrency(maxValue, currency, 2);

  if (minLabel === "-" && maxLabel === "-") return "-";
  if (minLabel === maxLabel) return minLabel;
  if (minLabel === "-") return maxLabel;
  if (maxLabel === "-") return minLabel;

  return `${minLabel} to ${maxLabel}`;
};

const normalizeFileNamePart = (value?: string | null) =>
  (value || "indicative-estimation")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "");

const getCreatorName = (creator?: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
} | null) => {
  const fullName = [creator?.firstName, creator?.lastName]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim();

  return fullName || creator?.username || "CAMTOP Property Group";
};

export const buildIndicativeTxtFileName = (indicationNo?: string | null) =>
  `${normalizeFileNamePart(indicationNo)}-estimate-template.txt`;

export const buildIndicativeTxtTemplate = (input: {
  code?: string | null;
  currency?: string | null;
  estimatedMinValue?: number | string | null;
  estimatedMaxValue?: number | string | null;
  estimatedFeeCharge?: number | string | null;
  instructedBy?: string | null;
  creator?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    phone?: string | null;
  } | null;
}) => {
  const currency = input.currency || "USD";
  const creatorName = getCreatorName(input.creator);
  const creatorPhone = input.creator?.phone?.trim() || "-";
  const lines = [
    "Dear",
    "",
    "We would like to provide you the primary estimation as below:",
    `Estimated Property Value: ${formatCurrencyRange(
      input.estimatedMinValue,
      input.estimatedMaxValue,
      currency,
    )}`,
    `Code: ${input.code?.trim() || "-"}`,
    `Estimate fee charge: ${formatCurrency(input.estimatedFeeCharge, currency)}`,
    "",
    `Note: ${DEFAULT_NOTE}`,
    DEFAULT_INTERNAL_SUGGESTION,
    "",
    "Best Regards",
    creatorName,
    `Tel:${creatorPhone}`,
  ];

  return lines.join("\r\n");
};
