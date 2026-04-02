"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { enUS, km } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Bell,
  CheckCheck,
  Trash2,
  Eye,
  RefreshCw,
  Shield,
  Search,
  Archive,
  MoreVertical,
  Filter,
  X,
  Inbox,
  AlertCircle,
  FileText,
  CheckCircle,
  XCircle,
  Megaphone,
  Trash,
  Clock,
  DeleteIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

import type { Notification } from "@/hooks/notification/notification.api";
import {
  useNotifications,
  useAdminNotifications,
  useAdminDeleteUserNotification,
  useAdminForceDelete,
  useAdminBulkDelete,
  useAdminClearUser,
  useAdminDeleteByType,
} from "@/hooks/notification/useNotification";

import { NotificationsAdminToolbar } from "@/components/notificaation/NotificationsAdminToolbar";
import { useAuth } from "@/hooks/auth/useAuth";

// Debounce hook
function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type Mode = "my" | "admin";
const EMPTY_NOTIFICATION_LIST: Notification[] = [];

function normalizeActionUrl(url: string) {
  const stripped = url.replace(/^\/[a-z]{2}\//, "/");
  const p = stripped.match(/^\/properties\/(\d+)/);
  const m = stripped.match(/^\/valuations\/(\d+)/);
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

  const normalized = roles
    .map((entry) => {
      const roleNode =
        entry && typeof entry === "object" && "role" in entry
          ? (entry.role as unknown)
          : (entry as unknown);
      const role =
        roleNode && typeof roleNode === "object"
          ? (roleNode as Record<string, unknown>)
          : null;
      if (!role) return null;

      return {
        roleName: typeof role.roleName === "string" ? role.roleName : "",
        roleCode: typeof role.roleCode === "string" ? role.roleCode : "",
        hierarchyLevel:
          typeof role.hierarchyLevel === "number" ? role.hierarchyLevel : 999,
      };
    })
    .filter((role): role is { roleName: string; roleCode: string; hierarchyLevel: number } => Boolean(role));

  if (!normalized.length) return "";
  normalized.sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);
  return normalized[0]?.roleName || normalized[0]?.roleCode || "";
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

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function formatRelativeTime(
  value: string | null | undefined,
  dateLocale: Locale,
  unknownLabel: string,
) {
  const ts = toTimestamp(value);
  if (!ts) return unknownLabel;
  return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: dateLocale });
}

export default function NotificationsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("notifications");
  const { hasHierarchyLevel } = useAuth();
  const isAdmin = hasHierarchyLevel(2);
  const dateLocale = locale === "kh" ? km : enUS;

  const [mode, setMode] = useState<Mode>("my");

  useEffect(() => {
    if (!isAdmin && mode === "admin") setMode("my");
  }, [isAdmin, mode]);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const limit = 30;

  // MY MODE STATE
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [skipMy, setSkipMy] = useState(0);
  const [myItems, setMyItems] = useState<Notification[]>([]);
  const [mySelectedId, setMySelectedId] = useState<number | null>(null);

  // ADMIN MODE STATE
  const [skipAdmin, setSkipAdmin] = useState(0);
  const [adminItems, setAdminItems] = useState<Notification[]>([]);
  const [adminSelectedId, setAdminSelectedId] = useState<number | null>(null);

  const [adminUserId, setAdminUserId] = useState("");
  const [adminType, setAdminType] = useState("");
  const [adminIsRead, setAdminIsRead] = useState<"" | "true" | "false">("");
  const [adminDateFrom, setAdminDateFrom] = useState("");
  const [adminDateTo, setAdminDateTo] = useState("");

  // BULK SELECTION STATE
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);

  // DELETION DIALOGS
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearUserDialogOpen, setClearUserDialogOpen] = useState(false);
  const [deleteTypeDialogOpen, setDeleteTypeDialogOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<number | null>(null);
  const [targetType, setTargetType] = useState<string>("");

  // USER HOOK
  const myParams = useMemo(
    () => ({
      unreadOnly: filter === "unread",
      limit,
      skip: skipMy,
    }),
    [filter, limit, skipMy]
  );

  const my = useNotifications(myParams, { enabled: mode === "my" });
  const myResetInitializedRef = useRef(false);

  useEffect(() => {
    if (mode !== "my") return;
    const page = my.notifications ?? [];

    setMyItems((prev) => {
      if (skipMy === 0) return page;

      const map = new Map<number, Notification>();
      for (const n of prev) map.set(n.id, n);
      for (const n of page) map.set(n.id, n);

      return Array.from(map.values()).sort(
        (a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)
      );
    });
  }, [mode, skipMy, my.notifications]);

  useEffect(() => {
    if (!myResetInitializedRef.current) {
      myResetInitializedRef.current = true;
      return;
    }
    if (mode !== "my") return;
    setSkipMy(0);
    setMySelectedId(null);
    setSelectedIds(new Set());
  }, [filter, mode]);

  useEffect(() => {
    if (mode !== "my") return;
    if (mySelectedId != null) return;
    if (myItems.length > 0) setMySelectedId(myItems[0].id);
  }, [mode, myItems, mySelectedId]);

  // ADMIN HOOK
  const adminParams = useMemo(() => {
    return {
      userId: adminUserId ? Number(adminUserId) : undefined,
      type: adminType || undefined,
      isRead:
        adminIsRead === ""
          ? undefined
          : adminIsRead === "true"
          ? true
          : false,
      dateFrom: adminDateFrom || undefined,
      dateTo: adminDateTo || undefined,
      limit,
      skip: skipAdmin,
    };
  }, [adminUserId, adminType, adminIsRead, adminDateFrom, adminDateTo, limit, skipAdmin]);

  const admin = useAdminNotifications(adminParams, {
    enabled: isAdmin && mode === "admin",
  });

  const adminPageItems: Notification[] = useMemo(() => {
    const raw = admin.data as unknown;
    const root =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const dataNode = root?.data;
    const data =
      dataNode && typeof dataNode === "object"
        ? (dataNode as Record<string, unknown>)
        : null;
    const candidates = [
      data?.items,
      data?.notifications,
      root?.items,
      root?.notifications,
      dataNode,
      raw,
    ];
    const list = candidates.find((value) => Array.isArray(value));
    return (list ?? EMPTY_NOTIFICATION_LIST) as Notification[];
  }, [admin.data]);

  useEffect(() => {
    if (!isAdmin) return;
    if (mode !== "admin") return;

    setAdminItems((prev) => {
      if (skipAdmin === 0) return adminPageItems;

      const map = new Map<number, Notification>();
      for (const n of prev) map.set(n.id, n);
      for (const n of adminPageItems) map.set(n.id, n);

      return Array.from(map.values()).sort(
        (a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)
      );
    });
  }, [isAdmin, mode, skipAdmin, adminPageItems]);

  useEffect(() => {
    if (!isAdmin) return;
    if (mode !== "admin") return;
    setSkipAdmin(0);
    setAdminSelectedId(null);
    setSelectedIds(new Set());
  }, [isAdmin, adminUserId, adminType, adminIsRead, adminDateFrom, adminDateTo, mode]);

  useEffect(() => {
    if (!isAdmin) return;
    if (mode !== "admin") return;
    if (adminSelectedId != null) return;
    if (adminItems.length > 0) setAdminSelectedId(adminItems[0].id);
  }, [isAdmin, mode, adminItems, adminSelectedId]);

  // CURRENT VIEW
  const items = mode === "my" ? myItems : adminItems;
  const selectedId = mode === "my" ? mySelectedId : adminSelectedId;
  const setSelectedId = mode === "my" ? setMySelectedId : setAdminSelectedId;

  const isLoading = mode === "my" ? my.isLoading : admin.isLoading;
  const isError = mode === "my" ? my.isError : admin.isError;

  const selectedNotification = useMemo(
    () => items.find((n) => n.id === selectedId) ?? null,
    [items, selectedId]
  );

  const filteredNotifications = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => {
      const title = typeof n.title === "string" ? n.title : "";
      const message = typeof n.message === "string" ? n.message : "";
      return title.toLowerCase().includes(q) || message.toLowerCase().includes(q);
    });
  }, [items, debouncedSearch]);

  const hasMore =
    mode === "my"
      ? (my.notifications?.length ?? 0) === limit
      : adminPageItems.length === limit;

  const stats = useMemo(() => {
    const total = items.length;
    const read = items.filter((n) => n.isRead).length;
    const pending = items.filter((n) => n.type.endsWith("_SUBMITTED")).length;
    const selected = selectedIds.size;
    return { total, read, pending, selected };
  }, [items, selectedIds]);

  // ADMIN MUTATIONS
  const adminDelete = useAdminDeleteUserNotification();
  const adminForceDelete = useAdminForceDelete();
  const adminBulkDelete = useAdminBulkDelete();
  const adminClearUser = useAdminClearUser();
  const adminDeleteByType = useAdminDeleteByType();

  const getLocalizedCreatorDisplayName = (notification: Notification) => {
    if (notification.createdByUser) {
      return getUserDisplayName(notification.createdByUser);
    }
    if (notification.createdBy) {
      return t("userNumber", { id: notification.createdBy });
    }
    return t("system");
  };

  const getLocalizedUserDisplayName = (user?: NotificationPerson | null, userId?: number | null) => {
    const display = getUserDisplayName(user);
    if (display) return display;
    if (userId) return t("userIdLabel", { id: userId });
    return t("unknownUser");
  };

  const formatTypeLabel = (type: string) => {
    switch (type) {
      case "PROPERTY_SUBMITTED":
        return t("types.propertySubmitted");
      case "PROPERTY_APPROVED":
        return t("types.propertyApproved");
      case "PROPERTY_REJECTED":
        return t("types.propertyRejected");
      case "VALUATION_SUBMITTED":
        return t("types.valuationSubmitted");
      case "VALUATION_APPROVED":
        return t("types.valuationApproved");
      case "VALUATION_REJECTED":
        return t("types.valuationRejected");
      case "INDICATIVE_VALUATION_SUBMITTED":
        return t("types.indicativeValuationSubmitted");
      case "INDICATIVE_VALUATION_APPROVED":
        return t("types.indicativeValuationApproved");
      case "INDICATIVE_VALUATION_REJECTED":
        return t("types.indicativeValuationRejected");
      case "SYSTEM_ANNOUNCEMENT":
        return t("types.systemAnnouncement");
      default:
        return type.replace(/_/g, " ");
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case "SYSTEM_ANNOUNCEMENT":
        return <Megaphone className={cn(iconClass, "text-purple-600 dark:text-purple-400")} />;
      default:
        if (type.endsWith("_SUBMITTED")) {
          return <FileText className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />;
        }
        if (type.endsWith("_APPROVED")) {
          return <CheckCircle className={cn(iconClass, "text-green-600 dark:text-green-400")} />;
        }
        if (type.endsWith("_REJECTED")) {
          return <XCircle className={cn(iconClass, "text-red-600 dark:text-red-400")} />;
        }
        return <Bell className={cn(iconClass, "text-gray-600 dark:text-gray-400")} />;
    }
  };

  const getNotificationIconBg = (type: string) => {
    switch (type) {
      case "SYSTEM_ANNOUNCEMENT":
        return "bg-purple-100 dark:bg-purple-900/30";
      default:
        if (type.endsWith("_SUBMITTED")) return "bg-blue-100 dark:bg-blue-900/30";
        if (type.endsWith("_APPROVED")) return "bg-green-100 dark:bg-green-900/30";
        if (type.endsWith("_REJECTED")) return "bg-red-100 dark:bg-red-900/30";
        return "bg-gray-100 dark:bg-gray-800/30";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "SYSTEM_ANNOUNCEMENT":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        if (type.endsWith("_SUBMITTED")) {
          return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
        }
        if (type.endsWith("_APPROVED")) {
          return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
        }
        if (type.endsWith("_REJECTED")) {
          return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
        }
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  // ACTIONS
  const handleNotificationClick = (n: Notification) => {
    setSelectedId(n.id);
    if (mode === "my" && !n.isRead) my.markAsRead(n.id);
  };

  const handleViewAction = (n: Notification) => {
    if (mode === "my" && !n.isRead) my.markAsRead(n.id);
    if (n.actionUrl) router.push(normalizeActionUrl(n.actionUrl));
  };

  const handleDeleteSelected = (n: Notification) => {
    if (mode === "my") {
      setMyItems((prev) => prev.filter((x) => x.id !== n.id));
      if (mySelectedId === n.id) setMySelectedId(null);
      my.deleteNotification(n.id);
      return;
    }

    if (!isAdmin) return;

    setAdminItems((prev) => prev.filter((x) => x.id !== n.id));
    if (adminSelectedId === n.id) setAdminSelectedId(null);
    adminDelete.mutate({ userId: n.userId, notificationId: n.id });
  };

  const handleRefresh = () => {
    if (mode === "my") my.refetch();
    else admin.refetch();
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoading) return;
    if (mode === "my") setSkipMy((s) => s + limit);
    else setSkipAdmin((s) => s + limit);
  };

  // BULK SELECTION HANDLERS
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    }
  };

  const toggleSelectNotification = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    if (mode === "my") {
      // Delete each one individually for user mode
      ids.forEach((id) => my.deleteNotification(id));
      setMyItems((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    } else {
      // Use bulk delete for admin mode
      adminBulkDelete.mutate(ids, {
        onSuccess: () => {
          setAdminItems((prev) => prev.filter((n) => !selectedIds.has(n.id)));
          setSelectedIds(new Set());
          setBulkActionOpen(false);
        },
      });
    }
  };

  const handleClearUserInbox = () => {
    if (!targetUserId) return;
    adminClearUser.mutate(targetUserId, {
      onSuccess: () => {
        setClearUserDialogOpen(false);
        setTargetUserId(null);
        admin.refetch();
      },
    });
  };

  const handleDeleteByType = () => {
    if (!targetType) return;
    adminDeleteByType.mutate(targetType, {
      onSuccess: () => {
        setDeleteTypeDialogOpen(false);
        setTargetType("");
        admin.refetch();
      },
    });
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto p-2 space-y-4">
        {/* Enhanced Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shadow-sm">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                  {t("title")}
                  {isAdmin && mode === "admin" && (
                    <Badge variant="default" className="gap-1.5">
                      <Shield className="h-3 w-3" />
                      {t("adminMode")}
                    </Badge>
                  )}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isAdmin && mode === "admin"
                    ? t("adminDescription")
                    : t("description")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="flex gap-2 rounded-lg border bg-background p-1 shadow-sm">
                <Button
                  variant={mode === "my" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("my")}
                  className="gap-2"
                >
                  <Bell className="h-4 w-4" />
                  {t("myNotifications")}
                </Button>
                <Button
                  variant={mode === "admin" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("admin")}
                  className="gap-2"
                >
                  <Shield className="h-4 w-4" />
                  {t("adminView")}
                </Button>
              </div>
            )}

            <Button variant="outline" onClick={handleRefresh} className="gap-2 shadow-sm">
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              {t("refresh")}
            </Button>

            {mode === "my" && my.unreadCount > 0 && (
              <Button variant="outline" onClick={() => my.markAllAsRead()} className="gap-2 shadow-sm">
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{t("markAllRead")}</span>
                <Badge variant="secondary" className="ml-1">
                  {my.unreadCount}
                </Badge>
              </Button>
            )}
          </div>
        </div>

        {/* Admin Toolbar */}
        {isAdmin && mode === "admin" && (
          <NotificationsAdminToolbar
            adminUserId={adminUserId}
            setAdminUserId={setAdminUserId}
            adminType={adminType}
            setAdminType={setAdminType}
            adminIsRead={adminIsRead}
            setAdminIsRead={setAdminIsRead}
            adminDateFrom={adminDateFrom}
            setAdminDateFrom={setAdminDateFrom}
            adminDateTo={adminDateTo}
            setAdminDateTo={setAdminDateTo}
            onRefresh={() => admin.refetch()}
            onSent={() => admin.refetch()}
            onClearUser={(userId) => {
              setTargetUserId(userId);
              setClearUserDialogOpen(true);
            }}
            onDeleteByType={(type) => {
              setTargetType(type);
              setDeleteTypeDialogOpen(true);
            }}
          />
        )}

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="shadow-sm border-primary/50">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t("selectedCount", { count: selectedIds.size })}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                    className="h-8"
                  >
                    {t("clearSelection")}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkActionOpen(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("deleteSelected")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Notifications List */}
          <Card className="shadow-md">
            <CardHeader className="border-b bg-muted/30">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Inbox className="h-5 w-5 text-primary" />
                    {mode === "admin" ? t("allNotifications") : t("inbox")}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {filteredNotifications.length > 0 && (
                      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1">
                        <Checkbox
                          checked={selectedIds.size === filteredNotifications.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label={t("selectAllNotifications")}
                        />
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="text-xs font-medium text-foreground/80 hover:text-foreground"
                        >
                          {t("selectAll")}
                        </button>
                      </div>
                    )}
                    {mode === "my" && my.unreadCount > 0 && (
                      <Badge variant="destructive" className="rounded-full px-2.5 shadow-sm">
                        {my.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    className="pl-9 pr-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1 hover:bg-muted"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Filter Tabs - My Mode Only */}
                {mode === "my" && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={filter === "all" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setFilter("all")}
                    >
                      {t("all")}
                    </Button>
                    <Button
                      type="button"
                      variant={filter === "unread" ? "default" : "outline"}
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => setFilter("unread")}
                    >
                      {t("unread")}
                      {my.unreadCount > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {my.unreadCount}
                        </Badge>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
                {isError ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <AlertCircle className="h-12 w-12 text-destructive mb-3" />
                    <p className="text-sm font-medium mb-1">{t("failedToLoad")}</p>
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                      {t("failedToLoadDescription")}
                    </p>
                    <Button variant="outline" onClick={handleRefresh} className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      {t("tryAgain")}
                    </Button>
                  </div>
                ) : isLoading && items.length === 0 ? (
                  <div className="divide-y">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                      {debouncedSearch ? (
                        <Search className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <Bell className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {debouncedSearch ? t("noMatchesFound") : t("noNotificationsYet")}
                    </h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      {debouncedSearch
                        ? t("noMatchesDescription")
                        : t("noNotificationsDescription")}
                    </p>
                    {debouncedSearch && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchQuery("")}
                        className="mt-4 gap-2"
                      >
                        <X className="h-4 w-4" />
                        {t("clearSearch")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="divide-y">
                      {filteredNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            "group flex items-start gap-3 p-4 cursor-pointer transition-all hover:bg-muted/50",
                            selectedId === n.id && "bg-primary/5 border-l-4 border-l-primary",
                            mode === "my" && !n.isRead && "bg-blue-50/50 dark:bg-blue-950/10"
                          )}
                        >
                          <Checkbox
                            checked={selectedIds.has(n.id)}
                            onCheckedChange={() => toggleSelectNotification(n.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                          />

                          <div
                            className="flex-1 flex items-start gap-3"
                            onClick={() => handleNotificationClick(n)}
                          >
                            <div
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                                getNotificationIconBg(n.type)
                              )}
                            >
                              {getNotificationIcon(n.type)}
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <h4
                                  className={cn(
                                    "font-medium text-sm leading-tight",
                                    mode === "my" && !n.isRead && "font-semibold"
                                  )}
                                >
                                  {n.title}
                                </h4>
                                {mode === "my" && !n.isRead && (
                                  <div className="h-2 w-2 bg-primary rounded-full shrink-0 mt-1.5" />
                                )}
                              </div>

                              <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
                                {n.message}
                              </p>

                              <div className="flex items-center gap-2 pt-1">
                                <Badge
                                  variant="secondary"
                                  className={cn("text-xs px-2 py-0", getNotificationColor(n.type))}
                                >
                                  {formatTypeLabel(n.type)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(n.createdAt, dateLocale, t("unknownTime"))}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                                {n.createdByUser?.profilePicture ? (
                                  <img
                                    src={n.createdByUser.profilePicture}
                                    alt={getLocalizedCreatorDisplayName(n)}
                                    className="h-5 w-5 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center">
                                    {getLocalizedCreatorDisplayName(n).charAt(0).toUpperCase() || "S"}
                                  </div>
                                )}
                                <span>{t("by")}</span>
                                <span className="font-medium text-slate-700">
                                  {getLocalizedCreatorDisplayName(n)}
                                </span>
                                {getCreatorRoleLabel(n) && (
                                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                    {getCreatorRoleLabel(n)}
                                  </span>
                                )}
                              </div>

                              {isAdmin && mode === "admin" && (
                                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                                  {n.user?.profilePicture ? (
                                    <img
                                      src={n.user.profilePicture}
                                      alt={getLocalizedUserDisplayName(n.user, n.userId)}
                                      className="h-5 w-5 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center">
                                      {getLocalizedUserDisplayName(n.user, n.userId).charAt(0).toUpperCase() || "U"}
                                    </div>
                                  )}
                                  <span>{t("to")}</span>
                                  <span className="font-medium text-slate-700">
                                    {getLocalizedUserDisplayName(n.user, n.userId)}
                                  </span>
                                  {getUserRoleLabel(n.user) && (
                                    <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                      {getUserRoleLabel(n.user)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Load More */}
                    <div className="p-4 border-t">
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={!hasMore || isLoading}
                        onClick={handleLoadMore}
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            {t("loading")}
                          </>
                        ) : hasMore ? (
                          t("loadMore")
                        ) : (
                          t("noMoreNotifications")
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notification Details */}
          <Card className="shadow-md">
            {selectedNotification ? (
              <>
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-xl shrink-0",
                          getNotificationIconBg(selectedNotification.type)
                        )}
                      >
                        <div className="scale-150">{getNotificationIcon(selectedNotification.type)}</div>
                      </div>

                      <div className="flex-1 space-y-2">
                        <h2 className="text-xl font-semibold leading-tight">
                          {selectedNotification.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("text-xs", getNotificationColor(selectedNotification.type))}>
                            {formatTypeLabel(selectedNotification.type)}
                          </Badge>

                          <Separator orientation="vertical" className="h-4" />

                          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="font-medium">
                              {formatRelativeTime(selectedNotification.createdAt, dateLocale, t("unknownTime"))}
                            </span>
                          </span>

                          {mode === "my" && !selectedNotification.isRead && (
                            <>
                              <Separator orientation="vertical" className="h-4" />
                              <Badge variant="default" className="text-xs gap-1">
                                <div className="h-1.5 w-1.5 bg-white rounded-full" />
                                {t("unread")}
                              </Badge>
                            </>
                          )}

                          <>
                            <Separator orientation="vertical" className="h-4" />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {selectedNotification.createdByUser?.profilePicture ? (
                                <img
                                  src={selectedNotification.createdByUser.profilePicture}
                                  alt={getLocalizedCreatorDisplayName(selectedNotification)}
                                  className="h-5 w-5 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center">
                                  {getLocalizedCreatorDisplayName(selectedNotification).charAt(0).toUpperCase() || "S"}
                                </div>
                              )}
                              <span>{t("by")}</span>
                              <span className="font-medium text-slate-700">
                                {getLocalizedCreatorDisplayName(selectedNotification)}
                              </span>
                              {getCreatorRoleLabel(selectedNotification) && (
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                  {getCreatorRoleLabel(selectedNotification)}
                                </span>
                              )}
                            </div>
                          </>

                          {isAdmin && mode === "admin" && (
                            <>
                              <Separator orientation="vertical" className="h-4" />
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {selectedNotification.user?.profilePicture ? (
                                  <img
                                    src={selectedNotification.user.profilePicture}
                                    alt={getLocalizedUserDisplayName(selectedNotification.user, selectedNotification.userId)}
                                    className="h-5 w-5 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center">
                                    {getLocalizedUserDisplayName(selectedNotification.user, selectedNotification.userId).charAt(0).toUpperCase() || "U"}
                                  </div>
                                )}
                                <span>{t("to")}</span>
                                <span className="font-medium text-slate-700">
                                  {getLocalizedUserDisplayName(selectedNotification.user, selectedNotification.userId)}
                                </span>
                                {getUserRoleLabel(selectedNotification.user) && (
                                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                    {getUserRoleLabel(selectedNotification.user)}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {mode === "my" && !selectedNotification.isRead && (
                          <>
                            <DropdownMenuItem onClick={() => my.markAsRead(selectedNotification.id)}>
                              <CheckCheck className="h-4 w-4 mr-2" />
                              {t("markAsRead")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDeleteSelected(selectedNotification)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("delete")}
                        </DropdownMenuItem>
                        {isAdmin && mode === "admin" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>{t("adminActions")}</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                adminForceDelete.mutate(selectedNotification.id, {
                                  onSuccess: () => {
                                    setAdminItems((prev) => prev.filter((x) => x.id !== selectedNotification.id));
                                    setAdminSelectedId(null);
                                  },
                                });
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <DeleteIcon className="h-4 w-4 mr-2" />
                              {t("forceDelete")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="space-y-6">
                    {/* Message Content */}
                    <div className="rounded-lg border bg-muted/30 p-5">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedNotification.message}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    {selectedNotification.actionUrl && (
                      <div className="flex flex-wrap gap-3 pt-2">
                        <Button
                          onClick={() => handleViewAction(selectedNotification)}
                          className="gap-2 shadow-sm"
                        >
                          <Eye className="h-4 w-4" />
                          {t("viewDetails")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDeleteSelected(selectedNotification)}
                          className="gap-2"
                        >
                          <Archive className="h-4 w-4" />
                          {t("archive")}
                        </Button>
                      </div>
                    )}

                    {/* Additional Info */}
                    <div className="pt-4 border-t space-y-2">
                      <h3 className="text-sm font-semibold mb-3">{t("notificationDetails")}</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-xs">{t("created")}</p>
                          <p className="font-medium">
                            {new Date(selectedNotification.createdAt).toLocaleString(
                              locale === "kh" ? "km-KH" : "en-US"
                            )}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-xs">{t("status")}</p>
                          <p className="font-medium">
                            {selectedNotification.isRead ? t("read") : t("unread")}
                          </p>
                        </div>
                        {selectedNotification.entityType && (
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">{t("entityType")}</p>
                            <p className="font-medium font-mono text-xs">
                              {selectedNotification.entityType}
                            </p>
                          </div>
                        )}
                        {selectedNotification.entityId && (
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">{t("entityId")}</p>
                            <p className="font-medium">{selectedNotification.entityId}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="h-full flex items-center justify-center p-12">
                <div className="text-center max-w-md">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mx-auto mb-6">
                    <Bell className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{t("noNotificationSelected")}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("noNotificationSelectedDescription")}
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteNotificationsTitle", { count: selectedIds.size })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteNotificationsDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear User Inbox Dialog */}
      <AlertDialog open={clearUserDialogOpen} onOpenChange={setClearUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clearUserInboxTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("clearUserInboxDescription", { id: targetUserId ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetUserId(null)}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearUserInbox}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("clearInbox")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete By Type Dialog */}
      <AlertDialog open={deleteTypeDialogOpen} onOpenChange={setDeleteTypeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteByTypeTitle", { type: formatTypeLabel(targetType || "SYSTEM_ANNOUNCEMENT") })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteByTypeDescription", { type: formatTypeLabel(targetType || "SYSTEM_ANNOUNCEMENT") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetType("")}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteByType}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("deleteAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
