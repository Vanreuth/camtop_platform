"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/lib/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import ReactCountryFlag from "react-country-flag";
import { useAuth } from "@/hooks/auth/useAuth";
import { Check } from "lucide-react";

const languages = [
  { code: "en", name: "English", countryCode: "US" },
  { code: "kh", name: "ខ្មែរ", countryCode: "KH" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const { updatePreferences } = useAuth();

  const handleLanguageChange = (newLocale: string) => {
    if (newLocale === locale) return;

    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
    updatePreferences({ language: newLocale as "en" | "kh" }).catch(() => {});
  };

  const currentLanguage = languages.find((lang) => lang.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-2"
          disabled={isPending}
        >
          {currentLanguage && (
            <ReactCountryFlag
              countryCode={currentLanguage.countryCode}
              svg
              style={{ width: "1.25em", height: "1.25em", borderRadius: "3px" }}
              title={currentLanguage.name}
            />
          )}
          <span className="hidden xl:inline text-xs font-medium">
            {currentLanguage?.code.toUpperCase()}
          </span>
          <span className="sr-only">{t("selectLanguage")}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("selectLanguage")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="cursor-pointer flex items-center gap-2"
            disabled={isPending}
          >
            <ReactCountryFlag
              countryCode={language.countryCode}
              svg
              style={{ width: "1.25em", height: "1.25em", borderRadius: "3px" }}
            />
            <span>{language.name}</span>
            {locale === language.code && (
              <Check className="ml-auto h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

