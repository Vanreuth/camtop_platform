"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "@/lib/navigation";
import { useAuth } from "@/hooks/auth/useAuth";
import { useUnreadCount } from "@/hooks/notification/useNotification";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Grid3X3,
  Home,
  Building2,
  Users,
  BarChart3,
  Settings,
  Shield,
  MessageSquare,
  Calendar,
  Bell,
  Search,
  BadgeDollarSign,
  MapPinned,
  UserCog,
  HelpCircle,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AppItem = {
  name: string;
  icon: LucideIcon;
  href: string;
  description: string;
  group: "general" | "property" | "management" | "tools";
  color: string;
  bgColor: string;
  badge?: string | null;
  maxHierarchyLevel?: number;
};

const GROUP_ORDER: AppItem["group"][] = [
  "general",
  "property",
  "management",
  "tools",
];

export function AppSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { hasHierarchyLevel } = useAuth();
  const unreadCountQuery = useUnreadCount();
  const unreadCount = typeof unreadCountQuery.data === "number" ? unreadCountQuery.data : 0;
  const tNav = useTranslations("nav");
  const tApp = useTranslations("appSwitcher");
  const tCommon = useTranslations("common");

  const appItems = useMemo<AppItem[]>(
    () => [
      {
        name: tNav("dashboard"),
        icon: Home,
        href: "/dashboard",
        description: tApp("overviewStatistics"),
        group: "general",
        color: "text-blue-600",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        maxHierarchyLevel: 3,
      },
      {
        name: tNav("analytics"),
        icon: BarChart3,
        href: "/dashboard/analytics",
        description: tApp("dataInsights"),
        group: "general",
        color: "text-violet-600",
        bgColor: "bg-violet-100 dark:bg-violet-900/30",
        maxHierarchyLevel: 3,
      },
      {
        name: tNav("propertyData"),
        icon: Building2,
        href: "/dashboard/property",
        description: tApp("manageProperties"),
        group: "property",
        color: "text-emerald-600",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      },
      {
        name: tNav("propertyValuation"),
        icon: BadgeDollarSign,
        href: "/dashboard/propertyValuation",
        description: "Valuation workflows",
        group: "property",
        color: "text-fuchsia-600",
        bgColor: "bg-fuchsia-100 dark:bg-fuchsia-900/30",
        maxHierarchyLevel: 3,
      },
      {
        name: tNav("propertyMap"),
        icon: MapPinned,
        href: "/dashboard/propertyMap",
        description: "Location and map tools",
        group: "property",
        color: "text-cyan-600",
        bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
        maxHierarchyLevel: 3,
      },
      {
        name: tNav("users"),
        icon: Users,
        href: "/dashboard/users",
        description: tApp("userManagement"),
        group: "management",
        color: "text-orange-600",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        maxHierarchyLevel: 2,
      },
      {
        name: tNav("rolePermission"),
        icon: UserCog,
        href: "/dashboard/role_permission",
        description: "Roles and permission matrix",
        group: "management",
        color: "text-amber-600",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
        maxHierarchyLevel: 2,
      },
      {
        name: tNav("messages"),
        icon: MessageSquare,
        href: "/dashboard/messages",
        description: "Team communication",
        group: "tools",
        color: "text-pink-600",
        bgColor: "bg-pink-100 dark:bg-pink-900/30",
      },
      {
        name: tNav("calendar"),
        icon: Calendar,
        href: "/dashboard/calendar",
        description: tApp("scheduleEvents"),
        group: "tools",
        color: "text-teal-600",
        bgColor: "bg-teal-100 dark:bg-teal-900/30",
      },
      {
        name: tNav("notifications"),
        icon: Bell,
        href: "/dashboard/notifications",
        description: "Alerts and updates",
        group: "tools",
        color: "text-indigo-600",
        bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
        badge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null,
      },
      {
        name: tNav("security"),
        icon: Shield,
        href: "/dashboard/security",
        description: tApp("accessControl"),
        group: "tools",
        color: "text-red-600",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        badge: "!",
        maxHierarchyLevel: 2,
      },
      {
        name: tNav("help"),
        icon: HelpCircle,
        href: "/dashboard/help",
        description: "Guides and support",
        group: "tools",
        color: "text-slate-600",
        bgColor: "bg-slate-100 dark:bg-slate-800/50",
      },
      {
        name: tNav("settings"),
        icon: Settings,
        href: "/dashboard/settings",
        description: tApp("systemConfig"),
        group: "tools",
        color: "text-gray-600",
        bgColor: "bg-gray-100 dark:bg-gray-800",
      },
    ],
    [tApp, tNav, unreadCount]
  );

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const visibleApps = useMemo(
    () =>
      appItems.filter(
        (app) =>
          app.maxHierarchyLevel === undefined ||
          hasHierarchyLevel(app.maxHierarchyLevel)
      ),
    [appItems, hasHierarchyLevel]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredApps = useMemo(() => {
    if (!normalizedQuery) return visibleApps;
    return visibleApps.filter(
      (app) =>
        app.name.toLowerCase().includes(normalizedQuery) ||
        app.description.toLowerCase().includes(normalizedQuery) ||
        app.href.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, visibleApps]);

  const groupedApps = useMemo(() => {
    const appMap = new Map<AppItem["group"], AppItem[]>();

    GROUP_ORDER.forEach((group) => appMap.set(group, []));
    filteredApps.forEach((app) => {
      const groupApps = appMap.get(app.group);
      if (groupApps) groupApps.push(app);
    });

    return GROUP_ORDER
      .map((group) => ({
        group,
        apps: appMap.get(group) ?? [],
      }))
      .filter((entry) => entry.apps.length > 0);
  }, [filteredApps]);

  const groupLabels: Record<AppItem["group"], string> = useMemo(
    () => ({
      general: tCommon("general"),
      property: tCommon("propertymanagement"),
      management: tCommon("usermanagement"),
      tools: "Tools",
    }),
    [tCommon]
  );

  const handleAppClick = (href: string) => {
    router.push(href);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-accent transition-colors"
          aria-label="Switch applications"
        >
          <Grid3X3 className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[min(94vw,30rem)] p-0"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        <div className="p-4 pb-2">
          <DropdownMenuLabel className="mb-3 px-0 text-base font-semibold">
            {tApp("applications")}
          </DropdownMenuLabel>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={tApp("searchApps")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-9 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[26rem] overflow-y-auto px-4 pb-3">
          {filteredApps.length > 0 ? (
            <div className="space-y-3">
              {groupedApps.map(({ group, apps }) => (
                <section key={group} className="space-y-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {groupLabels[group]}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {apps.map((app) => {
                      const Icon = app.icon;
                      const isActive =
                        pathname === app.href || pathname.startsWith(`${app.href}/`);

                      return (
                        <DropdownMenuItem
                          key={app.name}
                          className={cn(
                            "relative h-auto cursor-pointer flex-col items-center rounded-lg border p-3 text-center transition-all focus:bg-accent hover:bg-accent",
                            isActive
                              ? "border-primary/50 bg-primary/5"
                              : "border-transparent"
                          )}
                          onClick={() => handleAppClick(app.href)}
                        >
                          <div
                            className={cn(
                              "mb-2 flex h-11 w-11 items-center justify-center rounded-xl transition-transform hover:scale-105",
                              app.bgColor
                            )}
                          >
                            <Icon className={cn("h-5 w-5", app.color)} />
                          </div>

                          <span className="line-clamp-1 text-xs font-medium">
                            {app.name}
                          </span>
                          <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                            {app.description}
                          </span>

                          {app.badge && (
                            <Badge
                              variant={app.badge === "!" ? "destructive" : "secondary"}
                              className="absolute -right-1 -top-1 h-5 px-1.5 text-[10px]"
                            >
                              {app.badge}
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {tApp("noAppsFound")} {searchQuery}
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="my-0" />

        <div className="bg-muted/30 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {filteredApps.length} {tApp("appsCount", { total: visibleApps.length })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleAppClick("/dashboard/settings")}
            >
              <Settings className="mr-1 h-3 w-3" />
              {tApp("manage")}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
