"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  BellRing,
  CheckCheck,
  ChevronRight,
  Megaphone,
  Trash2,
  Bell,
  Sparkles,
  FileText,
  CheckCircle,
  XCircle,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/notification/useNotification";
import { cn } from "@/lib/utils";
import { useNotificationSettings } from "@/hooks/notification/useNotificationSettings";
import type { Notification } from "@/hooks/notification/notification.api";

type NotificationType =
  | "VALUATION_SUBMITTED"
  | "VALUATION_APPROVED"
  | "VALUATION_REJECTED"
  | "INDICATIVE_VALUATION_SUBMITTED"
  | "INDICATIVE_VALUATION_APPROVED"
  | "INDICATIVE_VALUATION_REJECTED"
  | "PROPERTY_SUBMITTED"
  | "PROPERTY_APPROVED"
  | "PROPERTY_REJECTED"
  | "SYSTEM_ANNOUNCEMENT"
  | string;

function iconForType(type: NotificationType) {
  switch (type) {
    case "SYSTEM_ANNOUNCEMENT":
      return Megaphone;
    default:
      if (type.endsWith("_SUBMITTED")) return FileText;
      if (type.endsWith("_APPROVED")) return CheckCircle;
      if (type.endsWith("_REJECTED")) return XCircle;
      return Bell;
  }
}

function iconChipClass(type: NotificationType) {
  switch (type) {
    case "SYSTEM_ANNOUNCEMENT":
      return "bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400";
    default:
      if (type.endsWith("_SUBMITTED")) {
        return "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
      }
      if (type.endsWith("_APPROVED")) {
        return "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
      }
      if (type.endsWith("_REJECTED")) {
        return "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400";
      }
      return "bg-gray-500/15 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400";
  }
}

function formatTimeAgo(value: string | Date) {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "";
  }
}

function normalizeActionUrl(url: string) {
  const stripped = url.replace(/^\/[a-z]{2}\//, "/");
  const m = stripped.match(/^\/valuations\/(\d+)/);
  const p = stripped.match(/^\/properties\/(\d+)/);
  const i =
    stripped.match(/^\/indicative-valuations\/(\d+)/) ??
    stripped.match(/^\/property-indicativeValuation\/(\d+)/);
  if (p) return `/dashboard/property/${p[1]}`;
  if (m) return `/dashboard/propertyValuation/${m[1]}`;
  if (i) return `/dashboard/propertyIndicativeValuation/${i[1]}`;

  return stripped;
}

type NotificationPerson = NonNullable<Notification["user"]> | NonNullable<Notification["createdByUser"]>;

function getUserDisplayName(user?: NotificationPerson | null) {
  if (!user) return "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return user.username || name || `User #${user.id}`;
}

function getUserRoleLabel(user?: NotificationPerson | null) {
  const roles = user?.roles ?? [];
  if (!roles.length) return "";
  const sorted = [...roles].sort(
    (a, b) => a.role.hierarchyLevel - b.role.hierarchyLevel
  );
  return sorted[0]?.role?.roleName || sorted[0]?.role?.roleCode || "";
}

function getCreatorDisplayName(notification: Notification) {
  if (notification.createdByUser) {
    return getUserDisplayName(notification.createdByUser);
  }
  if (notification.createdBy) {
    return `User #${notification.createdBy}`;
  }
  return "System";
}

function getCreatorRoleLabel(notification: Notification) {
  if (!notification.createdByUser) return "";
  return getUserRoleLabel(notification.createdByUser);
}

// ✅ map notification type -> category id (for filtering)
function typeToCategoryId(type: string) {
  if (
    type.startsWith("VALUATION_") ||
    type.startsWith("INDICATIVE_VALUATION_")
  ) {
    return "valuations";
  }
  if (type.startsWith("SYSTEM_")) return "system";
  if (type.startsWith("PROPERTY_")) return "property";
  return "system";
}

export const AdvancedNotificationDropdown = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications({ limit: 5 });

  // ✅ optional: respect settings
  const { masterEnabled, settings } = useNotificationSettings();

  const allowedInApp = useMemo(() => {
    const cats = settings?.categories ?? [];
    const enabled = new Set(
      cats
        .filter((c) => c.channels?.inApp)
        .map((c) => (c.id === "properties" ? "property" : c.id))
    );
    return enabled;
  }, [settings]);

  const filteredNotifications = useMemo(() => {
    if (!masterEnabled) return [];
    // if settings not loaded yet, show everything (fallback)
    if (!settings) return notifications;

    return notifications.filter((n) => {
      const categoryId = typeToCategoryId(n.type);
      const categoryExists = settings.categories.some(
        (c) => c.id === categoryId || (categoryId === "property" && c.id === "properties")
      );

      // Fail-open for newly added categories that are missing in older local settings payloads.
      if (!categoryExists) return true;
      return allowedInApp.has(categoryId);
    });
  }, [notifications, masterEnabled, settings, allowedInApp]);

  const effectiveUnreadCount = useMemo(() => {
    // keep the badge accurate with filtering if settings exist
    if (!masterEnabled) return 0;
    if (!settings) return unreadCount;

    return filteredNotifications.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0);
  }, [masterEnabled, settings, unreadCount, filteredNotifications]);

  const hasNotifications = filteredNotifications.length > 0;

  const openCenter = () => {
    router.push("/dashboard/notifications");
    setOpen(false);
  };

  const openNotification = (n: any) => {
    if (!n) return;

    const unread = !n.isRead;
    if (unread) markAsRead(n.id);

    if (n.actionUrl) {
      router.push(normalizeActionUrl(n.actionUrl)); // ✅ always normalize
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 transition-all duration-200",
            "hover:bg-muted/80 hover:scale-105",
            open && "bg-muted"
          )}
          aria-label="Open notifications"
        >
          <BellRing
            className={cn(
              "h-[18px] w-[18px] transition-transform",
              effectiveUnreadCount > 0 && "animate-pulse"
            )}
          />
          {effectiveUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] flex items-center justify-center font-semibold shadow-md animate-in zoom-in-50 duration-200">
              {effectiveUnreadCount > 99 ? "99+" : effectiveUnreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[380px] p-0 overflow-hidden shadow-xl"
        align="end"
        sideOffset={8}
        forceMount
      >
        {/* Header */}
        <DropdownMenuLabel className="p-0">
          <div className="px-4 py-3.5 bg-gradient-to-r from-muted/50 to-muted/30 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold leading-none">
                    Notifications
                  </h3>
                  {effectiveUnreadCount > 0 && (
                    <Badge
                      variant="default"
                      className="h-5 px-2 text-[10px] font-semibold shadow-sm"
                    >
                      {effectiveUnreadCount} new
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  {effectiveUnreadCount > 0 ? (
                    <>
                      <Sparkles className="h-3 w-3" />
                      <span>
                        {effectiveUnreadCount} unread notification
                        {effectiveUnreadCount > 1 ? "s" : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-3 w-3" />
                      <span>You're all caught up!</span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {effectiveUnreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markAllAsRead();
                    }}
                    aria-label="Mark all as read"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openCenter();
                  }}
                >
                  View all
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        {/* Body */}
        <div className="max-h-[440px] overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3.5 flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !masterEnabled ? (
            <div className="py-10 px-6 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-sm">
                <Bell className="h-7 w-7 text-muted-foreground" />
              </div>
              <h4 className="text-sm font-semibold mb-1">
                Notifications are disabled
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                Enable notifications in Settings to see updates here.
              </p>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={() => openCenter()}>
                  Open Notification Center
                </Button>
              </div>
            </div>
          ) : !hasNotifications ? (
            <div className="py-12 px-6 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-sm">
                <Bell className="h-7 w-7 text-muted-foreground" />
              </div>
              <h4 className="text-sm font-semibold mb-1">No notifications yet</h4>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                When you receive notifications, they'll appear here for quick access.
              </p>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={openCenter}>
                  Open Notification Center
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((n) => {
                const Icon = iconForType(n.type);
                const unread = !n.isRead;
                const creatorName = getCreatorDisplayName(n);
                const creatorRole = getCreatorRoleLabel(n);
                const creatorIsSystem = creatorName === "System";

                return (
                  <DropdownMenuItem
                    key={n.id}
                    className="p-0 focus:bg-transparent"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <div
                      className={cn(
                        "w-full px-4 py-3.5 flex items-start gap-3 group",
                        "hover:bg-muted/60 active:bg-muted/80 transition-all duration-150 cursor-pointer",
                        unread &&
                          "bg-blue-50/50 hover:bg-blue-50/70 dark:bg-blue-950/10 dark:hover:bg-blue-950/20"
                      )}
                      role="button"
                      tabIndex={0}
                      onClick={() => openNotification(n)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openNotification(n); // ✅ normalized push
                        }
                      }}
                      aria-label={`Notification: ${n.title}`}
                    >
                      <div
                        className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                          "group-hover:scale-105 transition-transform duration-200",
                          iconChipClass(n.type)
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p
                            className={cn(
                              "text-sm leading-snug line-clamp-1",
                              unread ? "font-semibold" : "font-medium"
                            )}
                            title={n.title}
                          >
                            {n.title}
                          </p>

                          {unread && (
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0 shadow-sm animate-pulse" />
                          )}
                        </div>

                        <p
                          className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2"
                          title={n.message}
                        >
                          {n.message}
                        </p>

                        <div className="flex items-center gap-2 mb-2">
                          {!creatorIsSystem && n.createdByUser?.profilePicture ? (
                            <img
                              src={n.createdByUser.profilePicture}
                              alt={creatorName}
                              className="h-5 w-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center">
                              {creatorIsSystem ? "S" : creatorName.charAt(0).toUpperCase() || "U"}
                            </div>
                          )}
                          <span className="text-xs text-slate-500">By</span>
                          <span className="text-xs font-medium text-slate-700 truncate">
                            {creatorName}
                          </span>
                          {creatorRole && (
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">
                              {creatorRole}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground font-medium">
                            {formatTimeAgo(n.createdAt)}
                          </p>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteNotification(n.id);
                              }}
                              aria-label="Delete notification"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>

                            {n.actionUrl && (
                              <div className="h-7 w-7 flex items-center justify-center">
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </div>

        {hasNotifications && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <div className="p-2 bg-muted/20">
              <Button
                variant="ghost"
                className="w-full justify-center text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={openCenter}
              >
                Open Notification Center
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
