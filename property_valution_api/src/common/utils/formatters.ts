import { de } from "zod/v4/locales";

export const parseConstructionPercentage = (percentage: any): number => {
  if (percentage == null) return 1.0;
  if (typeof percentage === "number") {
    // If already a decimal (0-1), return as is; if 10-100, convert to decimal
    if (percentage > 1 && percentage <= 100) return percentage / 100;
    if (percentage >= 0 && percentage <= 1) return percentage;
    return 1.0;
  }
  if (typeof percentage === "string") {
    // Try to extract a number from string (e.g. "80%", "EIGHTY_PERCENT")
    const percentMatch = percentage.match(/(\d+)/);
    if (percentMatch) {
      const value = parseInt(percentMatch[1], 10);
      if (value > 1 && value <= 100) return value / 100;
      if (value >= 0 && value <= 1) return value;
    }
    // Handle enum string (e.g. "EIGHTY_PERCENT", "FULLY_COMPLETED")
    const enumMap: Record<string, number> = {
      TEN_PERCENT: 0.1,
      TWENTY_PERCENT: 0.2,
      THIRTY_PERCENT: 0.3,
      FORTY_PERCENT: 0.4,
      FIFTY_PERCENT: 0.5,
      SIXTY_PERCENT: 0.6,
      SEVENTY_PERCENT: 0.7,
      EIGHTY_PERCENT: 0.8,
      NINETY_PERCENT: 0.9,
      FULLY_COMPLETED: 1.0,
      "100%": 1.0,
      "0%": 0.0,
    };
    const key = percentage.toUpperCase().replace(/\s+/g, "_");
    if (enumMap[key] !== undefined) return enumMap[key];
  }
  return 1.0; // Default to 100%
}

export const truncateString = (
  str: string | null | undefined,
  maxLength: number
): string | null => {
  if (!str) return null;
  return str.length > maxLength ? str.substring(0, maxLength) : str;
};

