import { Decimal } from "@prisma/client/runtime/library";

type DecimalInput = Decimal | number | string | null | undefined;
type DecimalRange = {
  min: Decimal | null;
  max: Decimal | null;
};
type NumberRange = {
  min: number | null;
  max: number | null;
};
type ComponentValueInput = {
  minValue?: DecimalInput;
  maxValue?: DecimalInput;
};

const HUNDRED = new Decimal(100);
const AUTO_VALUE_TOLERANCE = 0.005;

function toFiniteNumber(value: DecimalInput) {
  if (value === undefined || value === null || value === "") return null;
  const numeric =
    value instanceof Decimal ? Number(value) : typeof value === "string" ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeFeePercent(value: DecimalInput) {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric < 0) return 0;
  return numeric;
}

export function resolveFeeAccessValue(accessValue: DecimalInput, fallbackValue: DecimalInput) {
  const resolvedNumeric = toFiniteNumber(accessValue) ?? toFiniteNumber(fallbackValue);
  if (resolvedNumeric === null) return null;
  return new Decimal(resolvedNumeric);
}

export function resolveFeeAccessValueNumber(accessValue: DecimalInput, fallbackValue: DecimalInput) {
  const resolvedValue = resolveFeeAccessValue(accessValue, fallbackValue);
  return resolvedValue ? Number(resolvedValue) : null;
}

function resolveFallbackRange(
  minValue: DecimalInput,
  maxValue: DecimalInput,
): NumberRange {
  const normalizedMin = toFiniteNumber(minValue);
  const normalizedMax = toFiniteNumber(maxValue);

  if (normalizedMin === null && normalizedMax === null) {
    return { min: null, max: null };
  }

  const resolvedMin = normalizedMin ?? normalizedMax;
  const resolvedMax = normalizedMax ?? normalizedMin;

  if (resolvedMin === null || resolvedMax === null) {
    return { min: null, max: null };
  }

  return {
    min: Math.min(resolvedMin, resolvedMax),
    max: Math.max(resolvedMin, resolvedMax),
  };
}

export function resolveFeeAccessValueRange(args: {
  accessValue?: DecimalInput;
  fallbackMinAccessValue?: DecimalInput;
  fallbackMaxAccessValue?: DecimalInput;
  treatMaxMatchAsAuto?: boolean;
}): DecimalRange {
  const explicitAccessValue = toFiniteNumber(args.accessValue);
  const fallbackRange = resolveFallbackRange(
    args.fallbackMinAccessValue,
    args.fallbackMaxAccessValue,
  );

  const shouldUseFallbackRange =
    explicitAccessValue === null ||
    (
      args.treatMaxMatchAsAuto === true &&
      explicitAccessValue !== null &&
      fallbackRange.max !== null &&
      Math.abs(explicitAccessValue - fallbackRange.max) < AUTO_VALUE_TOLERANCE
    );

  if (shouldUseFallbackRange) {
    return {
      min: fallbackRange.min === null ? null : new Decimal(fallbackRange.min),
      max: fallbackRange.max === null ? null : new Decimal(fallbackRange.max),
    };
  }

  return {
    min: new Decimal(explicitAccessValue),
    max: new Decimal(explicitAccessValue),
  };
}

export function resolveFeeAccessValueRangeNumber(args: {
  accessValue?: DecimalInput;
  fallbackMinAccessValue?: DecimalInput;
  fallbackMaxAccessValue?: DecimalInput;
  treatMaxMatchAsAuto?: boolean;
}): NumberRange {
  const resolvedRange = resolveFeeAccessValueRange(args);
  return {
    min: resolvedRange.min ? Number(resolvedRange.min) : null,
    max: resolvedRange.max ? Number(resolvedRange.max) : null,
  };
}

export function shouldAutoComputeChargeFee(args: {
  accessValue?: DecimalInput;
  feeRate?: DecimalInput;
  discount?: DecimalInput;
}) {
  return [args.accessValue, args.feeRate, args.discount].some(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

export function computeChargeFee(args: {
  accessValue?: DecimalInput;
  fallbackAccessValue?: DecimalInput;
  feeRate?: DecimalInput;
  discount?: DecimalInput;
}) {
  if (!shouldAutoComputeChargeFee(args)) return null;

  const resolvedAccessValue = resolveFeeAccessValue(args.accessValue, args.fallbackAccessValue);
  if (!resolvedAccessValue) return null;

  const feeRate = normalizeFeePercent(args.feeRate);
  const discount = Math.min(100, normalizeFeePercent(args.discount));

  return resolvedAccessValue
    .mul(new Decimal(feeRate).div(HUNDRED))
    .mul(HUNDRED.minus(new Decimal(discount)).div(HUNDRED));
}

export function computeChargeFeeRange(args: {
  accessValue?: DecimalInput;
  fallbackMinAccessValue?: DecimalInput;
  fallbackMaxAccessValue?: DecimalInput;
  feeRate?: DecimalInput;
  discount?: DecimalInput;
  treatMaxMatchAsAuto?: boolean;
}): DecimalRange {
  if (!shouldAutoComputeChargeFee(args)) {
    return { min: null, max: null };
  }

  const accessValueRange = resolveFeeAccessValueRange({
    accessValue: args.accessValue,
    fallbackMinAccessValue: args.fallbackMinAccessValue,
    fallbackMaxAccessValue: args.fallbackMaxAccessValue,
    treatMaxMatchAsAuto: args.treatMaxMatchAsAuto,
  });

  if (!accessValueRange.min || !accessValueRange.max) {
    return { min: null, max: null };
  }

  const feeRate = normalizeFeePercent(args.feeRate);
  const discount = Math.min(100, normalizeFeePercent(args.discount));
  const multiplier = new Decimal(feeRate)
    .div(HUNDRED)
    .mul(HUNDRED.minus(new Decimal(discount)).div(HUNDRED));

  return {
    min: accessValueRange.min.mul(multiplier),
    max: accessValueRange.max.mul(multiplier),
  };
}

export function computeChargeFeeRangeNumber(args: {
  accessValue?: DecimalInput;
  fallbackMinAccessValue?: DecimalInput;
  fallbackMaxAccessValue?: DecimalInput;
  feeRate?: DecimalInput;
  discount?: DecimalInput;
  treatMaxMatchAsAuto?: boolean;
}): NumberRange {
  const range = computeChargeFeeRange(args);
  return {
    min: range.min ? Number(range.min) : null,
    max: range.max ? Number(range.max) : null,
  };
}

export function sumComponentValueRangeNumber(
  components?: Array<ComponentValueInput | null | undefined> | null,
): NumberRange {
  if (!components?.length) {
    return { min: null, max: null };
  }

  let min = 0;
  let max = 0;
  let hasValue = false;

  for (const component of components) {
    if (!component) continue;

    const componentMin = toFiniteNumber(component.minValue) ?? 0;
    const componentMax = toFiniteNumber(component.maxValue) ?? 0;

    min += componentMin;
    max += componentMax;
    hasValue = true;
  }

  if (!hasValue) {
    return { min: null, max: null };
  }

  return { min, max };
}
