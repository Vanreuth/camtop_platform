"use client";
import { Link, usePathname } from "@/lib/navigation";

import { cn } from "@/lib/utils";
import {
  User,
  Shield,
  Palette,
  Bell,
  Monitor,
  Key,
  Settings,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface SettingsSidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
  }[];
}

function SettingsSidebarNav({
  className,
  items,
  ...props
}: SettingsSidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1",
        className
      )}
      {...props}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              "hover:bg-accent/50",
              isActive
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span>{item.title}</span>
                {isActive && <ChevronRight className="h-3 w-3" />}
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5 hidden lg:block">
                  {item.description}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

interface SettingsLayoutProps {
  children: React.ReactNode;
}

import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const t = useTranslations("settings");

  const sidebarNavItems = [
  {
    title: t("profile"),
    href: "/dashboard/settings",
    icon: User,
    description: t("manageProfile"),
  },
  {
    title: t("account"),
    href: "/dashboard/settings/account",
    icon: Shield,
    description: t("manageAccount"),
  },
  {
    title: t("appearance"),
    href: "/dashboard/settings/appearance",
    icon: Palette,
    description: t("manageAppearance"),
  },
  {
    title: t("notifications"),
    href: "/dashboard/settings/notifications",
    icon: Bell,
    description: t("manageNotifications"),
  },
];
  
  return (
    <div className="space-y-8 p-2 min-h-dvh">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center">
            <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
          </div>
          <p className="text-primary">
            {t("description")}
          </p>
        </div>
      </div>
      <Separator />

      {/* Layout */}
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          <Card className="p-2 lg:p-3">
            <SettingsSidebarNav items={sidebarNavItems} />
          </Card>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="max-w-4xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
