export const PHYSICAL_CONDITIONS = [
  "POOR",
  "FAIR",
  "GOOD",
  "EXCELLENT",
] as const;

export type PhysicalCondition = (typeof PHYSICAL_CONDITIONS)[number];

const LEGACY_PHYSICAL_CONDITION_MAP: Record<string, PhysicalCondition> = {
  MODERATE: "FAIR",
  WELL_MAINTENANCE: "GOOD",
  POOR_MAINTENANCE: "POOR",
};

const PHYSICAL_CONDITION_LABELS: Record<PhysicalCondition, string> = {
  POOR: "Poor",
  FAIR: "Fair",
  GOOD: "Good",
  EXCELLENT: "Excellent",
};

export function normalizePhysicalCondition(
  value?: string | null
): PhysicalCondition | "" {
  if (!value) return "";

  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");

  if (PHYSICAL_CONDITIONS.includes(normalized as PhysicalCondition)) {
    return normalized as PhysicalCondition;
  }

  return LEGACY_PHYSICAL_CONDITION_MAP[normalized] ?? "";
}

export function formatPhysicalCondition(value?: string | null): string {
  const normalized = normalizePhysicalCondition(value);
  if (!normalized) return value ? value.replace(/_/g, " ") : "";
  return PHYSICAL_CONDITION_LABELS[normalized];
}
