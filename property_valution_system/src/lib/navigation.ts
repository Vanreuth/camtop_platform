import { createNavigation } from "next-intl/navigation";

export const locales = ["en", "kh"] as const;
export const localeNames = {
  en: "English",
  kh: "ខ្មែរ",
};

export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
});
