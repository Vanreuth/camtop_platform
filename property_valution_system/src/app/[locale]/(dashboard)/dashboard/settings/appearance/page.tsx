"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useTheme as useNextTheme } from "next-themes";
import {
  Monitor,
  Moon,
  Sun,
  Palette,
  Check,
  Type,
  Sparkles,
  Zap,
  Settings2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/auth/useAuth";
import { useTheme as useThemePreset, type ThemePreset } from "@/hooks/use-theme";
import {
  readAppearanceSetting,
  writeAppearanceSettings,
} from "@/lib/appearance-storage";

const appearanceFormSchema = z.object({
  theme: z.enum(["light", "dark", "system"], {
    required_error: "Please select a theme.",
  }),
  themeColor: z.enum(
    ["default", "classic", "amber", "rose", "slate", "violet"],
    {
      required_error: "Please select a theme color.",
    }
  ),
  accentColor: z.enum(
    ["blue", "green", "purple", "orange", "red", "pink", "teal", "cyan"],
    {
      required_error: "Please select an accent color.",
    }
  ),
  fontSize: z.enum(["small", "medium", "large", "xlarge"], {
    required_error: "Please select a font size.",
  }),
  fontFamily: z.enum(["inter", "system", "roboto", "open-sans", "poppins"], {
    required_error: "Please select a font family.",
  }),
  borderRadius: z.enum(["none", "small", "medium", "large", "full"], {
    required_error: "Please select a border radius.",
  }),
});

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>;

const defaultValues: Partial<AppearanceFormValues> = {
  theme: "light",
  themeColor: "default",
  accentColor: "blue",
  fontSize: "medium",
  fontFamily: "inter",
  borderRadius: "medium",
};

const getThemeOptions = (t: any) => [
  {
    value: "light",
    label: t("light"),
    icon: Sun,
    description: t("brightClean"),
    gradient: "from-amber-50 to-orange-50",
  },
  {
    value: "dark",
    label: t("dark"),
    icon: Moon,
    description: t("easyOnEyes"),
    gradient: "from-slate-900 to-slate-800",
  },
  {
    value: "system",
    label: t("system"),
    icon: Monitor,
    description: t("followSystem"),
    gradient: "from-blue-50 to-purple-50",
  },
];

const getThemeColors = (t: any) => [
  {
    value: "default",
    label: t("default"),
    primaryColor: "hsl(259, 100%, 65%)",
    description: t("modernBlue"),
  },
  {
    value: "classic",
    label: t("classic"),
    primaryColor: "hsl(39, 100%, 57%)",
    description: t("warmAmber"),
  },
  {
    value: "amber",
    label: t("amber"),
    primaryColor: "hsl(349, 100%, 74%)",
    description: t("vibrantCoral"),
  },
  {
    value: "rose",
    label: t("rose"),
    primaryColor: "hsl(330, 81%, 60%)",
    description: t("elegantRose"),
  },
  {
    value: "slate",
    label: t("slate"),
    primaryColor: "hsl(215, 16%, 47%)",
    description: t("professionalSlate"),
  },
  {
    value: "violet",
    label: t("violet"),
    primaryColor: "hsl(263, 70%, 50%)",
    description: t("boldViolet"),
  },
];

const getAccentColors = (t: any) => [
  { value: "blue", label: t("blue"), color: "bg-blue-500", hex: "#3b82f6" },
  { value: "green", label: t("green"), color: "bg-green-500", hex: "#22c55e" },
  { value: "purple", label: t("purple"), color: "bg-purple-500", hex: "#a855f7" },
  { value: "orange", label: t("orange"), color: "bg-orange-500", hex: "#f97316" },
  { value: "red", label: t("red"), color: "bg-red-500", hex: "#ef4444" },
  { value: "pink", label: t("pink"), color: "bg-pink-500", hex: "#ec4899" },
  { value: "teal", label: t("teal"), color: "bg-teal-500", hex: "#14b8a6" },
  { value: "cyan", label: t("cyan"), color: "bg-cyan-500", hex: "#06b6d4" },
];

const getFontSizes = (t: any) => [
  { value: "small", label: t("small"), preview: "text-sm", size: "14px" },
  { value: "medium", label: t("medium"), preview: "text-base", size: "16px" },
  { value: "large", label: t("large"), preview: "text-lg", size: "18px" },
  { value: "xlarge", label: t("extraLarge"), preview: "text-xl", size: "20px" },
];

const getFontFamilies = (t: any) => [
  {
    value: "inter",
    label: t("inter"),
    description: t("modernVersatile"),
    fontClass: "font-sans",
    preview: "The quick brown fox jumps",
  },
  {
    value: "system",
    label: t("systemUI"),
    description: t("nativeSystem"),
    fontClass: "font-system",
    preview: "The quick brown fox jumps",
  },
  {
    value: "roboto",
    label: t("roboto"),
    description: t("cleanReadable"),
    fontClass: "font-roboto",
    preview: "The quick brown fox jumps",
  },
  {
    value: "open-sans",
    label: t("openSans"),
    description: t("friendlyOpen"),
    fontClass: "font-open-sans",
    preview: "The quick brown fox jumps",
  },
  {
    value: "poppins",
    label: t("poppins"),
    description: t("geometricModern"),
    fontClass: "font-poppins",
    preview: "The quick brown fox jumps",
  },
];

const getBorderRadiusOptions = (t: any) => [
  { value: "none", label: t("none"), preview: "0px", radius: "0rem" },
  { value: "small", label: t("small"), preview: "4px", radius: "0.25rem" },
  { value: "medium", label: t("medium"), preview: "6px", radius: "0.375rem" },
  { value: "large", label: t("large"), preview: "12px", radius: "0.75rem" },
  { value: "full", label: t("full"), preview: "24px", radius: "1.5rem" },
];

export default function SettingsAppearancePage() {
  const { theme, setTheme } = useNextTheme();
  const { theme: themePreset, changeTheme: changeThemePreset } = useThemePreset();
  const [mounted, setMounted] = useState(false);
  const lastAppliedPreferences = useRef<string | null>(null);
  const t = useTranslations("settings");
  const { user, preferences, updatePreferences } = useAuth();
  const appearanceUserId = user?.id;

  const themeOptions = getThemeOptions(t);
  const themeColors = getThemeColors(t);
  const accentColors = getAccentColors(t);
  const fontSizes = getFontSizes(t);
  const fontFamilies = getFontFamilies(t);
  const borderRadiusOptions = getBorderRadiusOptions(t);

  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: {
      ...defaultValues,
      theme: (theme as AppearanceFormValues["theme"]) || "light",
    },
  });

  // Load saved settings from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const currentTheme = (theme as AppearanceFormValues["theme"]) || "system";
    form.setValue("theme", currentTheme);

    const savedThemeColor = readAppearanceSetting("themeColor", appearanceUserId);
    const savedAccentColor = readAppearanceSetting("accentColor", appearanceUserId);
    const savedFontSize = readAppearanceSetting("fontSize", appearanceUserId);
    const savedFontFamily = readAppearanceSetting("fontFamily", appearanceUserId);
    const savedBorderRadius = readAppearanceSetting("borderRadius", appearanceUserId);
    const savedThemePreset = readAppearanceSetting("theme-preset", appearanceUserId);

    if (savedThemeColor) {
      form.setValue(
        "themeColor",
        savedThemeColor as AppearanceFormValues["themeColor"]
      );
      applyThemeColor(savedThemeColor);
    }
    if (savedAccentColor) {
      form.setValue(
        "accentColor",
        savedAccentColor as AppearanceFormValues["accentColor"]
      );
      applyAccentColor(savedAccentColor);
    }
    if (savedFontSize) {
      form.setValue(
        "fontSize",
        savedFontSize as AppearanceFormValues["fontSize"]
      );
      applyFontSize(savedFontSize);
    }
    if (savedFontFamily) {
      form.setValue(
        "fontFamily",
        savedFontFamily as AppearanceFormValues["fontFamily"]
      );
      applyFontFamily(savedFontFamily);
    }
    if (savedBorderRadius) {
      form.setValue(
        "borderRadius",
        savedBorderRadius as AppearanceFormValues["borderRadius"]
      );
      applyBorderRadius(savedBorderRadius);
    }
    if (savedThemePreset) {
      changeThemePreset(savedThemePreset as ThemePreset);
    }
  }, [appearanceUserId, changeThemePreset, form, theme]);

  const isDirty = form.formState.isDirty;

  useEffect(() => {
    if (!preferences || isDirty) return;
    const signature = JSON.stringify(preferences);
    if (lastAppliedPreferences.current === signature) return;

    const prefs = preferences;
    form.reset({
      ...defaultValues,
      theme: prefs.theme,
      themeColor: prefs.themeColor,
      accentColor: prefs.accentColor,
      fontSize: prefs.fontSize,
      fontFamily: prefs.fontFamily,
      borderRadius: prefs.borderRadius,
    });

    setTheme(prefs.theme);
    applyThemeColor(prefs.themeColor);
    applyAccentColor(prefs.accentColor);
    applyFontSize(prefs.fontSize);
    applyFontFamily(prefs.fontFamily);
    applyBorderRadius(prefs.borderRadius);
    if (prefs.themePreset) {
      changeThemePreset(prefs.themePreset);
    }

    writeAppearanceSettings(
      {
        themeColor: prefs.themeColor,
        accentColor: prefs.accentColor,
        fontSize: prefs.fontSize,
        fontFamily: prefs.fontFamily,
        borderRadius: prefs.borderRadius,
        "theme-preset": prefs.themePreset || themePreset,
      },
      appearanceUserId
    );

    lastAppliedPreferences.current = signature;
  }, [appearanceUserId, changeThemePreset, form, isDirty, preferences, setTheme, themePreset]);

  const applyThemeColor = (color: string) => {
    const root = document.documentElement;
    root.classList.remove(
      "default",
      "classic",
      "amber",
      "rose",
      "slate",
      "violet"
    );
    if (color !== "default") {
      root.classList.add(color);
    }
  };

  const applyAccentColor = (color: string) => {
    const accentColorMap: Record<
      string,
      {
        primary: string;
        foreground: string;
        sidebarAccent: string;
        sidebarAccentForeground: string;
      }
    > = {
      blue: {
        primary: "oklch(0.6231 0.1880 259.8145)",
        foreground: "oklch(1.0000 0 0)",
        sidebarAccent: "oklch(0.92 0.08 259.8145)",
        sidebarAccentForeground: "oklch(0.25 0.02 259.8145)",
      },
      green: {
        primary: "oklch(0.5583 0.1276 142.5)",
        foreground: "oklch(1.0000 0 0)",
        sidebarAccent: "oklch(0.92 0.08 142.5)",
        sidebarAccentForeground: "oklch(0.25 0.02 142.5)",
      },
      purple: {
        primary: "oklch(0.6231 0.1880 300.0)",
        foreground: "oklch(1.0000 0 0)",
        sidebarAccent: "oklch(0.92 0.10 300.0)",
        sidebarAccentForeground: "oklch(0.25 0.02 300.0)",
      },
      orange: {
        primary: "oklch(0.6898 0.1581 50.0)",
        foreground: "oklch(0 0 0)",
        sidebarAccent: "oklch(0.93 0.07 50.0)",
        sidebarAccentForeground: "oklch(0.22 0.02 50.0)",
      },
      red: {
        primary: "oklch(0.6368 0.2078 25.3313)",
        foreground: "oklch(1.0000 0 0)",
        sidebarAccent: "oklch(0.93 0.08 25.3313)",
        sidebarAccentForeground: "oklch(0.22 0.02 25.3313)",
      },
      pink: {
        primary: "oklch(0.8500 0.1800 330.0)",
        foreground: "oklch(1.0000 0 0)",
        sidebarAccent: "oklch(0.93 0.09 330.0)",
        sidebarAccentForeground: "oklch(0.22 0.02 330.0)",
      },
      teal: {
        primary: "oklch(0.6500 0.1500 180.0)",
        foreground: "oklch(1.0000 0 0)",
        sidebarAccent: "oklch(0.92 0.07 180.0)",
        sidebarAccentForeground: "oklch(0.22 0.02 180.0)",
      },
      cyan: {
        primary: "oklch(0.7000 0.1400 200.0)",
        foreground: "oklch(0 0 0)",
        sidebarAccent: "oklch(0.93 0.07 200.0)",
        sidebarAccentForeground: "oklch(0.22 0.02 200.0)",
      },
    };

    const colors = accentColorMap[color];
    if (colors) {
      document.documentElement.style.setProperty("--primary", colors.primary);
      document.documentElement.style.setProperty(
        "--primary-foreground",
        colors.foreground
      );
      document.documentElement.style.setProperty("--ring", colors.primary);
      document.documentElement.style.setProperty(
        "--sidebar-accent",
        colors.sidebarAccent
      );
      document.documentElement.style.setProperty(
        "--sidebar-accent-foreground",
        colors.sidebarAccentForeground
      );
    }
  };

  const applyFontSize = (size: string) => {
    const sizeMap: Record<string, string> = {
      small: "14px",
      medium: "16px",
      large: "18px",
      xlarge: "20px",
    };
    const fontSize = sizeMap[size] || "16px";
    document.documentElement.style.setProperty("--base-font-size", fontSize);
    document.documentElement.style.fontSize = fontSize;
    document.body.style.fontSize = fontSize;
  };

  const applyFontFamily = (font: string) => {
  const khmerFallback =
    'var(--font-hanuman), "Hanuman", "Khmer OS Battambang", "Khmer OS", sans-serif';
  const fontMap: Record<string, string> = {
    inter: `var(--font-inter), ${khmerFallback}`,
    system: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", ${khmerFallback}`,
    roboto: `"Roboto", ${khmerFallback}`,
    "open-sans": `"Open Sans", ${khmerFallback}`,
    poppins: `"Poppins", ${khmerFallback}`,
  };
    const fontFamily = fontMap[font] || fontMap.inter;
    document.documentElement.style.setProperty("--font-family", fontFamily);
    document.body.style.fontFamily = fontFamily;
  };

  const applyBorderRadius = (radius: string) => {
    const radiusMap: Record<string, string> = {
      none: "0rem",
      small: "0.25rem",
      medium: "0.375rem",
      large: "0.75rem",
      full: "1.5rem",
    };
    document.documentElement.style.setProperty(
      "--radius",
      radiusMap[radius] || "0.375rem"
    );
  };

  const applyAppearancePreview = (data: AppearanceFormValues) => {
    setTheme(data.theme);
    applyThemeColor(data.themeColor);
    applyAccentColor(data.accentColor);
    applyFontSize(data.fontSize);
    applyFontFamily(data.fontFamily);
    applyBorderRadius(data.borderRadius);
  };

  async function onSubmit(data: AppearanceFormValues) {
    applyAppearancePreview(data);

    writeAppearanceSettings(
      {
        themeColor: data.themeColor,
        accentColor: data.accentColor,
        fontSize: data.fontSize,
        fontFamily: data.fontFamily,
        borderRadius: data.borderRadius,
        "theme-preset": themePreset,
      },
      appearanceUserId
    );

    try {
      await updatePreferences({
        theme: data.theme,
        themeColor: data.themeColor,
        accentColor: data.accentColor,
        fontSize: data.fontSize,
        fontFamily: data.fontFamily,
        borderRadius: data.borderRadius,
        themePreset,
      });
      toast.success(t("appearanceUpdated"), {
        description: t("preferenceSaved"),
        duration: 3000,
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to save preferences.";
      toast.error(message);
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold tracking-tight">{t("appearance")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("customizeDescription")}
        </p>
      </div>
      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Theme Mode Selection */}
          <FormField
            control={form.control}
            name="theme"
            render={({ field }) => (
              <FormItem className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
                <div>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    {t("themeMode")}
                  </FormLabel>
                  <FormDescription>
                    {t("selectTheme")}
                  </FormDescription>
                </div>
                <FormControl>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {themeOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <Card
                          key={option.value}
                          className={cn(
                            "cursor-pointer border-border/70 transition-colors hover:border-primary/40 hover:bg-muted/30",
                            field.value === option.value &&
                              "border-primary ring-1 ring-primary/30"
                          )}
                          onClick={() => {
                            field.onChange(option.value);
                            setTheme(option.value as AppearanceFormValues["theme"]);
                          }}
                        >
                          <CardContent className="p-4">
                            <div
                              className={cn(
                                "h-24 rounded-lg mb-3 bg-gradient-to-br",
                                option.gradient
                              )}
                            />
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "p-2 rounded-md transition-colors",
                                  field.value === option.value
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium">{option.label}</p>
                                  {field.value === option.value && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {option.description}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Theme Color Selection */}
          <FormField
            control={form.control}
            name="themeColor"
            render={({ field }) => (
              <FormItem className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
                <div>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {t("themeColor")}
                  </FormLabel>
                  <FormDescription>
                    {t("chooseThemeColor")}
                  </FormDescription>
                </div>
                <FormControl>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {themeColors.map((color) => (
                      <Card
                        key={color.value}
                        className={cn(
                          "cursor-pointer border-border/70 transition-colors hover:border-primary/40 hover:bg-muted/30",
                          field.value === color.value &&
                            "border-primary ring-1 ring-primary/30"
                        )}
                        onClick={() => {
                          field.onChange(color.value);
                          applyThemeColor(color.value);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-12 w-12 rounded-md border-2 border-background shadow-sm"
                              style={{ backgroundColor: color.primaryColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm truncate">
                                  {color.label}
                                </p>
                                {field.value === color.value && (
                                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {color.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Accent Color */}
          <FormField
            control={form.control}
            name="accentColor"
            render={({ field }) => (
              <FormItem className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
                <div>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    {t("accentColor")}
                  </FormLabel>
                  <FormDescription>
                    {t("setAccentColor")}
                  </FormDescription>
                </div>
                <FormControl>
                  <div className="flex flex-wrap gap-3">
                    {accentColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => {
                          field.onChange(color.value);
                          applyAccentColor(color.value);
                        }}
                        className={cn(
                          "group relative flex flex-col items-center gap-2 transition-all hover:scale-110",
                          field.value === color.value && "scale-110"
                        )}
                      >
                        <div
                          className={cn(
                            "h-12 w-12 rounded-lg shadow-md transition-all",
                            color.color,
                            field.value === color.value
                              ? "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                              : "hover:ring-2 hover:ring-offset-2 hover:ring-offset-background hover:ring-muted-foreground/30"
                          )}
                        />
                        {field.value === color.value && (
                          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-foreground flex items-center justify-center">
                            <Check className="h-3 w-3 text-background" />
                          </div>
                        )}
                        <span className="text-xs font-medium">
                          {color.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Font Size */}
          <FormField
            control={form.control}
            name="fontSize"
            render={({ field }) => (
              <FormItem className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
                <div>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    {t("fontSize")}
                  </FormLabel>
                  <FormDescription>
                    {t("adjustFontSize")}
                  </FormDescription>
                </div>
                <FormControl>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {fontSizes.map((size) => (
                      <Card
                        key={size.value}
                        className={cn(
                          "cursor-pointer border-border/70 transition-colors hover:border-primary/40 hover:bg-muted/30",
                          field.value === size.value &&
                            "border-primary ring-1 ring-primary/30"
                        )}
                        onClick={() => {
                          field.onChange(size.value);
                          applyFontSize(size.value);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm">{size.label}</p>
                            {field.value === size.value && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <p
                            className={cn(
                              size.preview,
                              "text-muted-foreground"
                            )}
                          >
                            Aa
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {size.size}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Font Family */}
          <FormField
            control={form.control}
            name="fontFamily"
            render={({ field }) => (
              <FormItem className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
                <div>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    {t("fontFamily")}
                  </FormLabel>
                  <FormDescription>
                    {t("chooseFont")}
                  </FormDescription>
                </div>
                <FormControl>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fontFamilies.map((font) => (
                      <Card
                        key={font.value}
                        className={cn(
                          "cursor-pointer border-border/70 transition-colors hover:border-primary/40 hover:bg-muted/30",
                          field.value === font.value &&
                            "border-primary ring-1 ring-primary/30"
                        )}
                        onClick={() => {
                          field.onChange(font.value);
                          applyFontFamily(font.value);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm">{font.label}</p>
                            {field.value === font.value && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {font.description}
                          </p>
                          <p className={cn("text-sm", font.fontClass)}>
                            {font.preview}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Border Radius */}
          <FormField
            control={form.control}
            name="borderRadius"
            render={({ field }) => (
              <FormItem className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
                <div>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    {t("borderRadius")}
                  </FormLabel>
                  <FormDescription>
                    {t("adjustRoundness")}
                  </FormDescription>
                </div>
                <FormControl>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {borderRadiusOptions.map((option) => (
                      <Card
                        key={option.value}
                        className={cn(
                          "cursor-pointer border-border/70 transition-colors hover:border-primary/40 hover:bg-muted/30",
                          field.value === option.value &&
                            "border-primary ring-1 ring-primary/30"
                        )}
                        onClick={() => {
                          field.onChange(option.value);
                          applyBorderRadius(option.value);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-medium text-sm">
                              {option.label}
                            </p>
                            {field.value === option.value && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div
                            className="h-12 w-full bg-primary/20 border-2 border-primary/50"
                            style={{ borderRadius: option.radius }}
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            {option.preview}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Preview Section */}
          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("livePreview")}</CardTitle>
                <Badge variant="secondary" className="ml-auto">
                  {t("realTime")}
                </Badge>
              </div>
              <CardDescription>
                Preview how your selected appearance settings look in common UI blocks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="p-4">
                  <h5 className="font-semibold mb-2">{t("sampleCard")}</h5>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("previewDashboard")}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm">{t("primaryButton")}</Button>
                    <Button size="sm" variant="outline">
                      {t("outlineButton")}
                    </Button>
                    <Button size="sm" variant="secondary">
                      {t("secondaryButton")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t("typography")}</span>
                      <Badge>{t("new")}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("quickBrownFox")}
                    </p>
                    <Separator />
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-md bg-primary" />
                      <div className="h-8 w-8 rounded-md bg-secondary" />
                      <div className="h-8 w-8 rounded-md bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const resetValues = {
                  ...defaultValues,
                  theme: "light",
                  themeColor: "default",
                  accentColor: "blue",
                  fontSize: "medium",
                  fontFamily: "inter",
                  borderRadius: "medium",
                } as AppearanceFormValues;
                form.reset(resetValues);
                applyAppearancePreview(resetValues);
                changeThemePreset("default");
                writeAppearanceSettings(
                  {
                    themeColor: resetValues.themeColor,
                    accentColor: resetValues.accentColor,
                    fontSize: resetValues.fontSize,
                    fontFamily: resetValues.fontFamily,
                    borderRadius: resetValues.borderRadius,
                    "theme-preset": "default",
                  },
                  appearanceUserId
                );
                toast.info(t("settingsReset"));
              }}
            >
              {t("resetToDefaults")}
            </Button>
            <Button type="submit" className="min-w-32">
              <Check className="h-4 w-4 mr-2" />
              {t("saveChanges")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
