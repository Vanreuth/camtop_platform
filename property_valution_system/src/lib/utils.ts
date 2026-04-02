import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatCurrency(
  value: number | string | undefined | null,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  if (value === undefined || value === null || value === "") {
    return "$0.00";
  }
  
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return "$0.00";
  }
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Safely extracts error message from various error types
 * Prevents passing error objects directly to toast
 */
export function getErrorMessage(error: unknown, fallback: string = "An error occurred"): string {
  if (typeof error === "string") {
    return error;
  }
  
  if (error && typeof error === "object") {
    // Axios error structure
    if ("response" in error && error.response && typeof error.response === "object") {
      const response = error.response as any;
      if (response.data) {
        if (typeof response.data === "string") return response.data;
        if (response.data.message) return response.data.message;
        if (response.data._responseMessage) return response.data._responseMessage;
        if (response.data.error) return response.data.error;
      }
      if (response.statusText) return response.statusText;
    }
    
    // Standard Error object
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
  }
  
  return fallback;
}
