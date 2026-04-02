const TOKEN_TO_PERCENT: Record<string, number> = {
  TEN_PERCENT: 10,
  TWENTY_PERCENT: 20,
  THIRTY_PERCENT: 30,
  FORTY_PERCENT: 40,
  FIFTY_PERCENT: 50,
  SIXTY_PERCENT: 60,
  SEVENTY_PERCENT: 70,
  EIGHTY_PERCENT: 80,
  NINETY_PERCENT: 90,
  FULLY_COMPLETED: 100,
};

export function toConstructionPercentageNumber(
  value?: string | number | null
): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return value <= 1 ? value * 100 : value;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;

  if (TOKEN_TO_PERCENT[normalized] !== undefined) {
    return TOKEN_TO_PERCENT[normalized];
  }

  const hasPercentSign = normalized.includes("%");
  const numeric = parseFloat(normalized.replace("%", ""));
  if (!Number.isFinite(numeric)) return undefined;

  if (hasPercentSign) return numeric;
  return numeric <= 1 ? numeric * 100 : numeric;
}

export function toConstructionPercentageSelectValue(
  value?: string | number | null
): string {
  const percent = toConstructionPercentageNumber(value);
  if (percent === undefined) return "";

  const rounded = Math.round(percent);
  if (rounded < 10 || rounded > 100) return "";
  if (rounded % 10 !== 0) return "";
  return String(rounded);
}
