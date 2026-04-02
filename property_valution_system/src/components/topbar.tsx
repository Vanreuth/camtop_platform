"use client";
import {
  Menu,
  User,
  Settings,
  KeyRound,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppSwitcher } from "./shared/app-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, usePathname, useRouter } from "@/lib/navigation";
import { useAuth } from "@/hooks/auth/useAuth";
import type { Preferences } from "@/hooks/auth/auth.schemas";
import { useTheme as useNextTheme } from "next-themes";
import { useLocale } from "next-intl";
import { useTheme as useThemePreset } from "@/hooks/use-theme";
import { useEffect, useRef, useState } from "react";
import {AdvancedNotificationDropdown} from "@/components/notification"
import { NotificationSoundWatcher } from "@/components/notificaation/NotificationSoundWatcher";
import { writeAppearanceSettings } from "@/lib/appearance-storage";

type TopbarUser = {
  username?: string;
  email?: string;
  profilePicture?: string | null;
} | null | undefined;

const applyThemeColor = (color: Preferences["themeColor"]) => {
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

const applyAccentColor = (color: Preferences["accentColor"]) => {
  const accentColorMap: Record<
    Preferences["accentColor"],
    { primary: string; foreground: string }
  > = {
      blue: {
        primary: "oklch(0.6231 0.1880 259.8145)",
        foreground: "oklch(1.0000 0 0)",
      },
      green: {
        primary: "oklch(0.5583 0.1276 142.5)",
        foreground: "oklch(1.0000 0 0)",
      },
      purple: {
        primary: "oklch(0.6231 0.1880 300.0)",
        foreground: "oklch(1.0000 0 0)",
      },
      orange: {
        primary: "oklch(0.6898 0.1581 50.0)",
        foreground: "oklch(0 0 0)",
      },
      red: {
        primary: "oklch(0.6368 0.2078 25.3313)",
        foreground: "oklch(1.0000 0 0)",
      },
      pink: {
        primary: "oklch(0.8500 0.1800 330.0)",
        foreground: "oklch(1.0000 0 0)",
      },
      teal: {
        primary: "oklch(0.6500 0.1500 180.0)",
        foreground: "oklch(1.0000 0 0)",
      },
      cyan: {
        primary: "oklch(0.7000 0.1400 200.0)",
        foreground: "oklch(0 0 0)",
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
  }
};

const applyFontSize = (size: Preferences["fontSize"]) => {
  const sizeMap: Record<Preferences["fontSize"], string> = {
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

const applyFontFamily = (font: Preferences["fontFamily"]) => {
  const khmerFallback =
    'var(--font-hanuman), "Hanuman", "Khmer OS Battambang", "Khmer OS", sans-serif';
  const fontMap: Record<Preferences["fontFamily"], string> = {
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

const applyBorderRadius = (radius: Preferences["borderRadius"]) => {
  const radiusMap: Record<Preferences["borderRadius"], string> = {
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

export const Topbar = ({
  variant = "dashboard",
}: {
  variant?: "dashboard" | "full";
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { setTheme } = useNextTheme();
  const { changeTheme: changeThemePreset } = useThemePreset();
  const { user, isLoading, logout, preferences } = useAuth();
  const appearanceUserId = user?.id;
  const appliedPreferencesRef = useRef<string | null>(null);
  const targetLocale = preferences.language;

  // Apply preferences when they change
  useEffect(() => {
    const signature = JSON.stringify(preferences);
    if (appliedPreferencesRef.current === signature) return;
    appliedPreferencesRef.current = signature;

    // Apply all theme preferences
    setTheme(preferences.theme);
    applyThemeColor(preferences.themeColor);
    applyAccentColor(preferences.accentColor);
    applyFontSize(preferences.fontSize);
    applyFontFamily(preferences.fontFamily);
    applyBorderRadius(preferences.borderRadius);
    
    changeThemePreset(preferences.themePreset);

    writeAppearanceSettings(
      {
        themeColor: preferences.themeColor,
        accentColor: preferences.accentColor,
        fontSize: preferences.fontSize,
        fontFamily: preferences.fontFamily,
        borderRadius: preferences.borderRadius,
        "theme-preset": preferences.themePreset,
      },
      appearanceUserId
    );

    // Handle language change
    if (targetLocale !== locale) {
      router.replace(pathname, { locale: targetLocale });
    }
  }, [appearanceUserId, preferences, changeThemePreset, locale, pathname, router, setTheme, targetLocale]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Logout failed");
      console.error("Logout error:", error);
    }
  };

  const getUserInitials = () => {
    if (!user?.username) return "U";
    return user.username.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Desktop View (lg and up) */}
      <div className="hidden lg:flex items-center gap-2 xl:gap-3">
        {variant === "full" ? <div className="flex-1" /> : null}

        <AppSwitcher />
        <LanguageSwitcher />
        <ThemeSwitcher />
        <ThemeToggle />
        <AdvancedNotificationDropdown />
        <ProfileDropdown
          isLoading={isLoading}
          user={user}
          getUserInitials={getUserInitials}
          handleLogout={handleLogout}
        />
      </div>

      {/* Tablet View (md to lg) */}
      <div className="hidden md:flex lg:hidden w-full items-center gap-2 min-w-0">
        <div className="ml-auto flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
          <AdvancedNotificationDropdown />
          <ProfileDropdown
            isLoading={isLoading}
            user={user}
            getUserInitials={getUserInitials}
            handleLogout={handleLogout}
          />
        </div>
      </div>

      {/* Mobile View (below md) */}
      <div className="flex md:hidden items-center gap-1.5">
        <MobileMenu
          user={user}
          isLoading={isLoading}
          getUserInitials={getUserInitials}
          handleLogout={handleLogout}
        />
        <AdvancedNotificationDropdown />
      </div>
      <NotificationSoundWatcher />
    </>
  );
};



// Profile Dropdown Component
const ProfileDropdown = ({
  isLoading,
  user,
  getUserInitials,
  handleLogout,
}: {
  isLoading: boolean;
  user: TopbarUser;
  getUserInitials: () => string;
  handleLogout: () => Promise<void>;
}) => {
  if (isLoading) {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-9 gap-2 rounded-full px-2 hover:bg-muted/50 transition-colors flex items-center border-0 bg-transparent cursor-pointer">
          <span className="relative inline-block">
            <Avatar className="h-7 w-7 ring-2 ring-offset-1 ring-offset-background ring-primary/10 transition-all hover:ring-primary/30">
              <AvatarImage
                src={user?.profilePicture || undefined}
                alt={user?.username || "User"}
              />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full ring-2 ring-background bg-green-500" title="Active" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 p-2" align="end" forceMount>
        <DropdownMenuLabel className="font-normal p-0">
          <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
            <span className="relative inline-block">
              <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
                <AvatarImage
                  src={user?.profilePicture || undefined}
                  alt={user?.username || "User"}
                />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background bg-green-500" title="Active" />
            </span>
            <div className="flex flex-col space-y-1 min-w-0 flex-1">
              <p className="text-sm font-semibold leading-none truncate">
                {user?.username || "User"}
              </p>
              <p className="text-xs leading-none text-muted-foreground truncate">
                {user?.email || ""}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link
            className="flex items-center gap-3 px-3 py-2.5 rounded-md"
            href="/dashboard/settings"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Profile</span>
              <span className="text-xs text-muted-foreground">
                Manage your account
              </span>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link
            className="flex items-center gap-3 px-3 py-2.5 rounded-md"
            href="/dashboard/settings/appearance"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Settings</span>
              <span className="text-xs text-muted-foreground">
                Preferences & Appearance
              </span>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link
            className="flex items-center gap-3 px-3 py-2.5 rounded-md"
            href="/dashboard/settings/account"
          >
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Update Password</span>
              <span className="text-xs text-muted-foreground">
                Updated recently
              </span>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 px-3 py-2.5 rounded-md"
        >
          <LogOut className="h-4 w-4 mr-3" />
          <span className="text-sm font-medium">Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Mobile Menu Component
const MobileMenu = ({
  user,
  isLoading,
  getUserInitials,
  handleLogout,
}: {
  user: TopbarUser;
  isLoading: boolean;
  getUserInitials: () => string;
  handleLogout: () => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-muted/50"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(88vw,22rem)] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col overflow-hidden">
          {/* Actions */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
              <span className="text-sm font-medium">Language</span>
              <LanguageSwitcher />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
              <span className="text-sm font-medium">Theme</span>
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
              <span className="text-sm font-medium">Switch Theme</span>
              <ThemeSwitcher />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
              <span className="text-sm font-medium">Apps</span>
              <AppSwitcher />
            </div>

            <div className="pt-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                asChild
              >
                <Link href="/dashboard/settings" onClick={() => setOpen(false)}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                asChild
              >
                <Link href="/dashboard/settings/appearance" onClick={() => setOpen(false)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                asChild
              >
                <Link href="/dashboard/settings/account" onClick={() => setOpen(false)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Update Password
                </Link>
              </Button>
            </div>
          </div>

          {/* User Info */}
          <div className="border-t p-4 space-y-2">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <span className="relative inline-block">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={user?.profilePicture || undefined}
                        alt={user?.username || "User"}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full ring-2 ring-background bg-green-500" title="Active" />
                  </span>
                  <div className="flex flex-col space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none truncate">
                      {user?.username || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user?.email || ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    void handleLogout();
                    setOpen(false);
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
