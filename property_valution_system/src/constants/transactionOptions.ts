export const VALID_TRANSACTION_TYPES = [
  "SALE",
  "RENTAL",
  "SOLD",
  "RENTED",
  "SALE_RENTAL",
  "CANCELED_TRANSACTION",
] as const;

export type TransactionType = (typeof VALID_TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_OPTIONS: Array<{
  value: TransactionType;
  label: string;
}> = [
  { value: "SALE", label: "Sale" },
  { value: "RENTAL", label: "Rental" },
  { value: "SOLD", label: "Sold" },
  { value: "RENTED", label: "Rented" },
  { value: "SALE_RENTAL", label: "Sale Rental" },
  { value: "CANCELED_TRANSACTION", label: "Canceled Transaction" },
];

const LEGACY_TRANSACTION_TYPE_MAP: Record<string, TransactionType> = {
  RENT: "RENTAL",
  LEASE: "RENTAL",
  RENT_SALE: "SALE_RENTAL",
  RENTAL_SALE: "SALE_RENTAL",
  CANCELLED: "CANCELED_TRANSACTION",
  CANCELLED_TRANSACTION: "CANCELED_TRANSACTION",
  CANCELED: "CANCELED_TRANSACTION",
};

export const normalizeTransactionType = (
  value?: string | null
): TransactionType | undefined => {
  const raw = (value || "").trim().toUpperCase();

  if (!raw) {
    return undefined;
  }

  if (VALID_TRANSACTION_TYPES.includes(raw as TransactionType)) {
    return raw as TransactionType;
  }

  return LEGACY_TRANSACTION_TYPE_MAP[raw];
};

export const formatTransactionTypeLabel = (value?: string | null): string => {
  const normalized = normalizeTransactionType(value);

  if (normalized) {
    return (
      TRANSACTION_TYPE_OPTIONS.find((option) => option.value === normalized)
        ?.label ?? normalized
    );
  }

  const raw = (value || "").trim();
  if (!raw) {
    return "";
  }

  return raw
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};
