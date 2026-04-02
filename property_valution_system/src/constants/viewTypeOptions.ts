export const VIEW_TYPE_OPTIONS = [
  { value: "CITY_VIEW", label: "City View" },
  { value: "PARK_VIEW", label: "Park View" },
  { value: "RIVER_VIEW", label: "River View" },
  { value: "SEA_VIEW", label: "Sea View" },
  { value: "MOUNTAIN_VIEW", label: "Mountain View" },
  { value: "NO_VIEW", label: "No View" },
] as const;

export const formatViewTypeLabel = (value?: string | null): string => {
  const raw = (value || "").trim();
  if (!raw) return "";

  return (
    VIEW_TYPE_OPTIONS.find((option) => option.value === raw)?.label ??
    raw
      .toLowerCase()
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ")
  );
};
