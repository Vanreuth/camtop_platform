"use client";

export type AppearanceStorageKey =
  | "themeColor"
  | "accentColor"
  | "fontSize"
  | "fontFamily"
  | "borderRadius"
  | "theme-preset";

const APPEARANCE_NAMESPACE = "appearance";

const toUserScope = (userId?: number | string | null): string | null => {
  if (userId === null || userId === undefined) return null;
  const value = String(userId).trim();
  return value.length ? value : null;
};

export const getAppearanceStorageKey = (
  key: AppearanceStorageKey,
  userId?: number | string | null
): string => {
  const scope = toUserScope(userId);
  return scope ? `${APPEARANCE_NAMESPACE}:${scope}:${key}` : key;
};

export const readAppearanceSetting = (
  key: AppearanceStorageKey,
  userId?: number | string | null
): string | null => {
  const scope = toUserScope(userId);
  if (scope) {
    const scoped = localStorage.getItem(getAppearanceStorageKey(key, scope));
    if (scoped !== null) return scoped;
  }
  return localStorage.getItem(key);
};

export const writeAppearanceSetting = (
  key: AppearanceStorageKey,
  value: string,
  userId?: number | string | null
): void => {
  const scope = toUserScope(userId);
  if (scope) {
    localStorage.setItem(getAppearanceStorageKey(key, scope), value);
  }
  // Keep legacy/global key for fast boot and backward compatibility.
  localStorage.setItem(key, value);
};

export const writeAppearanceSettings = (
  values: Partial<Record<AppearanceStorageKey, string>>,
  userId?: number | string | null
): void => {
  (Object.entries(values) as Array<[AppearanceStorageKey, string | undefined]>).forEach(
    ([key, value]) => {
      if (!value) return;
      writeAppearanceSetting(key, value, userId);
    }
  );
};
