"use client";
import { Check, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { updatePreferences } = useAuth();

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    updatePreferences({ theme: newTheme }).catch(() => {});
  };

  const normalizedTheme =
    theme === "classic" || theme === "amber" ? "light" : theme || "system";

  const getIcon = () => {
    switch (normalizedTheme) {
      case "light":
        return (
          <Sun className="h-[1.2rem] w-[1.2rem] transition-all duration-200" />
        );
      case "dark":
        return (
          <Moon className="h-[1.2rem] w-[1.2rem] transition-all duration-200" />
        );
      case "system":
        return (
          <Monitor className="h-[1.2rem] w-[1.2rem] transition-all duration-200" />
        );
      default:
        return (
          <Sun className="h-[1.2rem] w-[1.2rem] transition-all duration-200" />
        );
    }
  };

  const currentTheme = normalizedTheme;
  const themeOptions = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {getIcon()}
          <span className="sr-only">Theme mode</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themeOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleThemeChange(option.value)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <option.icon className="h-4 w-4" />
              <span>{option.label}</span>
            </span>
            {currentTheme === option.value && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
