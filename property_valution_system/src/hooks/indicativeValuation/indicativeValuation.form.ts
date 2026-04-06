export const AUTO_VALUE_TOLERANCE = 0.005;

export type IndicativeComponentDraftValue = {
  localId: string;
  id?: number;
  componentType: "LAND" | "BUILDING" | "OTHER";
  description: string;
  area: string | number;
  minRate: string | number;
  maxRate: string | number;
};

type NullableNumberish = string | number | null | undefined;

export const toNumber = (value?: NullableNumberish) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const parseNullableNumber = (value?: NullableNumberish) => {
  if (value === null || value === undefined) return null;

  const normalized = typeof value === "string" ? value.trim() : String(value);
  if (!normalized) return null;

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : undefined;
};

export const roundMoneyValue = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
};

export const formatMoney = (value: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
};

export const formatMoneyRange = (
  minValue: number | null | undefined,
  maxValue: number | null | undefined,
  currency = "USD",
) => {
  if (minValue === null || minValue === undefined) {
    return maxValue === null || maxValue === undefined ? "-" : formatMoney(maxValue, currency);
  }

  if (
    maxValue === null ||
    maxValue === undefined ||
    Math.abs(minValue - maxValue) < AUTO_VALUE_TOLERANCE
  ) {
    return formatMoney(minValue, currency);
  }

  return `${formatMoney(minValue, currency)} - ${formatMoney(maxValue, currency)}`;
};

export const createComponentDraft = (
  componentType: "LAND" | "BUILDING" | "OTHER" = "LAND",
  description?: string,
): IndicativeComponentDraftValue => ({
  localId: `${componentType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  componentType,
  description:
    description ??
    (componentType === "LAND"
      ? "Land"
      : componentType === "BUILDING"
        ? "Building"
        : "Other"),
  area: "",
  minRate: "",
  maxRate: "",
});

export const shouldUseAutomaticAccessRange = (args: {
  accessValue?: number | null;
  minAccessValue?: number | null;
  maxAccessValue?: number | null;
  minMarketValue?: number | null;
  maxMarketValue?: number | null;
}) => {
  if (args.accessValue === null || args.accessValue === undefined) {
    return true;
  }

  const minValue = args.minAccessValue ?? args.minMarketValue ?? null;
  const maxValue = args.maxAccessValue ?? args.maxMarketValue ?? null;

  if (maxValue === null || maxValue === undefined) {
    return false;
  }

  return (
    Math.abs(args.accessValue - maxValue) < AUTO_VALUE_TOLERANCE &&
    minValue !== null &&
    minValue !== undefined &&
    Math.abs(minValue - maxValue) >= AUTO_VALUE_TOLERANCE
  );
};

export const getAccessValueFieldValue = (args: {
  accessValue?: number | null;
  minAccessValue?: number | null;
  maxAccessValue?: number | null;
  minMarketValue?: number | null;
  maxMarketValue?: number | null;
}) =>
  shouldUseAutomaticAccessRange(args)
    ? ""
    : args.accessValue != null
      ? String(args.accessValue)
      : "";

export const buildIndicativeComponentRows = <T extends IndicativeComponentDraftValue>(
  components: T[],
) =>
  components.map((component) => {
    const area = toNumber(component.area);
    const minRate = toNumber(component.minRate);
    const maxRate = toNumber(component.maxRate);

    return {
      ...component,
      areaValue: area,
      minRateValue: minRate,
      maxRateValue: maxRate,
      minValue: area * minRate,
      maxValue: area * maxRate,
    };
  });

export const calculateIndicativeMetrics = <T extends IndicativeComponentDraftValue>(args: {
  components: T[];
  accessValueInput?: NullableNumberish;
  feeRateInput?: NullableNumberish;
  discountInput?: NullableNumberish;
  forcedSalePercentInput?: NullableNumberish;
  currency?: string;
}) => {
  const componentRows = buildIndicativeComponentRows(args.components);
  const totalMinMarketValue = componentRows.reduce((sum, component) => sum + component.minValue, 0);
  const totalMaxMarketValue = componentRows.reduce((sum, component) => sum + component.maxValue, 0);
  const accessValueOverride = parseNullableNumber(args.accessValueInput);
  const automaticAccessValue = accessValueOverride === null || accessValueOverride === undefined;
  const minAccessValue = roundMoneyValue(accessValueOverride ?? totalMinMarketValue);
  const maxAccessValue = roundMoneyValue(accessValueOverride ?? totalMaxMarketValue);
  const feeRateValue = toNumber(args.feeRateInput);
  const discountValue = toNumber(args.discountInput);
  const forcedSalePercentValue = toNumber(args.forcedSalePercentInput);
  const minChargeFeeValue = roundMoneyValue(
    minAccessValue * (feeRateValue / 100) * Math.max(0, 1 - discountValue / 100),
  );
  const maxChargeFeeValue = roundMoneyValue(
    maxAccessValue * (feeRateValue / 100) * Math.max(0, 1 - discountValue / 100),
  );
  const forcedSaleValue = roundMoneyValue(totalMaxMarketValue * (forcedSalePercentValue / 100));
  const currency = args.currency ?? "USD";

  return {
    componentRows,
    totalMinMarketValue,
    totalMaxMarketValue,
    accessValueOverride,
    automaticAccessValue,
    minAccessValue,
    maxAccessValue,
    feeRateValue,
    discountValue,
    forcedSalePercentValue,
    minChargeFeeValue,
    maxChargeFeeValue,
    forcedSaleValue,
    accessValueRangeLabel: formatMoneyRange(minAccessValue, maxAccessValue, currency),
    chargeFeeRangeLabel: formatMoneyRange(minChargeFeeValue, maxChargeFeeValue, currency),
  };
};
