"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Smartphone,
  Loader2,
  Lock,
  RefreshCw,
  FileClock,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  useAuditLogs,
  useAuditSummary,
  useLogAuditAction,
  useLogLoginSession,
  useUserAuditLogs,
} from "@/hooks/audit/useAudit";
import type { AuditLog } from "@/hooks/audit/audit.types";
import { cn } from "@/lib/utils";
import { auditApi } from "@/hooks/audit/audit.api";
import { toast } from "sonner";

type SecurityEventStatus = "success" | "warning" | "info";

type SecurityEvent = {
  id: number;
  type: string;
  description: string;
  time: string;
  status: SecurityEventStatus;
  icon: LucideIcon;
};

type LoginSession = {
  id: string;
  userDisplayName: string;
  username?: string;
  email?: string;
  userId?: number;
  device: string;
  browser: string;
  ip: string;
  lastActive: string;
  lastAction: string;
  current: boolean;
};

type CleanupPeriod = "7d" | "15d" | "1m" | "3m" | "6m" | "1y";

const cleanupPeriodOptions: CleanupPeriod[] = ["7d", "15d", "1m", "3m", "6m", "1y"];

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseDetails = (details: unknown): Record<string, unknown> | null => {
  if (isObjectRecord(details)) return details;
  if (typeof details !== "string") return null;

  try {
    const parsed = JSON.parse(details);
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const formatRelativeTime = (
  dateValue: string | undefined,
  relativeTimeFormat: Intl.RelativeTimeFormat,
  unknownTimeLabel: string,
) => {
  if (!dateValue) return unknownTimeLabel;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return unknownTimeLabel;

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  if (absMs >= 86_400_000) {
    return relativeTimeFormat.format(Math.round(diffMs / 86_400_000), "day");
  }
  if (absMs >= 3_600_000) {
    return relativeTimeFormat.format(Math.round(diffMs / 3_600_000), "hour");
  }
  if (absMs >= 60_000) {
    return relativeTimeFormat.format(Math.round(diffMs / 60_000), "minute");
  }
  return relativeTimeFormat.format(Math.round(diffMs / 1_000), "second");
};

const humanizeAction = (action: string) =>
  action
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const actionToStatus = (action: string): SecurityEventStatus => {
  const normalized = action.toLowerCase();
  if (/(fail|denied|error|blocked|invalid|unauthor)/.test(normalized)) {
    return "warning";
  }
  if (/(login|logout|password|2fa|verify|create|update|change)/.test(normalized)) {
    return "success";
  }
  return "info";
};

const actionToIcon = (action: string, status: SecurityEventStatus): LucideIcon => {
  const normalized = action.toLowerCase();
  if (normalized.includes("password")) return Lock;
  if (normalized.includes("login")) {
    return status === "warning" ? AlertTriangle : CheckCircle;
  }
  return Shield;
};

const inferDeviceName = (
  userAgent: string | undefined,
  labels: {
    browserSession: string;
    iphone: string;
    ipad: string;
    androidDevice: string;
    windowsPc: string;
    macDevice: string;
    linuxDevice: string;
  },
) => {
  if (!userAgent) return labels.browserSession;
  const normalized = userAgent.toLowerCase();
  if (normalized.includes("iphone")) return labels.iphone;
  if (normalized.includes("ipad")) return labels.ipad;
  if (normalized.includes("android")) return labels.androidDevice;
  if (normalized.includes("windows")) return labels.windowsPc;
  if (normalized.includes("mac")) return labels.macDevice;
  if (normalized.includes("linux")) return labels.linuxDevice;
  return labels.browserSession;
};

const inferBrowserName = (
  userAgent: string | undefined,
  labels: {
    unknownBrowser: string;
    edge: string;
    opera: string;
    chrome: string;
    firefox: string;
    safari: string;
  },
) => {
  if (!userAgent) return labels.unknownBrowser;
  const normalized = userAgent.toLowerCase();
  if (normalized.includes("edg")) return labels.edge;
  if (normalized.includes("opera") || normalized.includes("opr/")) return labels.opera;
  if (normalized.includes("chrome")) return labels.chrome;
  if (normalized.includes("firefox")) return labels.firefox;
  if (normalized.includes("safari")) return labels.safari;
  return labels.unknownBrowser;
};

const buildEventDescription = (
  log: AuditLog,
  accountActivityLabel: string,
  activityFromIpLabel: (entity: string, ip: string) => string,
) => {
  const details = parseDetails(log.details);
  const message = typeof details?.message === "string" ? details.message : undefined;
  if (message) return message;

  const entity = log.entity
    ? `${log.entity}${log.entityId ? ` #${log.entityId}` : ""}`
    : accountActivityLabel;
  const ip = (typeof details?.ip === "string" ? details.ip : undefined) ?? log.ipAddress;

  return ip ? activityFromIpLabel(entity, ip) : entity;
};

const buildSessions = (
  logs: AuditLog[],
  relativeTimeFormat: Intl.RelativeTimeFormat,
  unknownTimeLabel: string,
  unknownIpLabel: string,
  userNumberLabel: (id: number) => string,
  unknownUserLabel: string,
  deviceLabels: Parameters<typeof inferDeviceName>[1],
  browserLabels: Parameters<typeof inferBrowserName>[1],
): LoginSession[] => {
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const sessionLogs = sortedLogs.filter((log) =>
    /(login|token[_-]?refresh|session)/i.test(log.action)
  );

  const sessions = new Map<string, LoginSession>();

  for (const log of sessionLogs) {
    const details = parseDetails(log.details);
    const ip =
      (typeof details?.ip === "string" ? details.ip : undefined) ??
      log.ipAddress ??
      unknownIpLabel;
    const userAgent =
      (typeof details?.userAgent === "string" ? details.userAgent : undefined) ??
      log.userAgent;
    const identifier =
      typeof details?.identifier === "string" ? details.identifier : undefined;
    const userId = log.user?.id ?? log.userId;
    const username = log.user?.username ?? identifier;
    const fullName = [log.user?.firstName, log.user?.lastName]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(" ");
    const userDisplayName = fullName || username || (userId ? userNumberLabel(userId) : unknownUserLabel);

    const key = `${userId ?? "unknown"}|${ip}|${userAgent ?? "unknown"}`;
    if (sessions.has(key)) continue;

    sessions.set(key, {
      id: `${key}-${log.id}`,
      userDisplayName,
      username,
      email: log.user?.email,
      userId,
      device: inferDeviceName(userAgent, deviceLabels),
      browser: inferBrowserName(userAgent, browserLabels),
      ip,
      lastActive: formatRelativeTime(log.createdAt, relativeTimeFormat, unknownTimeLabel),
      lastAction: humanizeAction(log.action),
      current: sessions.size === 0,
    });

    if (sessions.size >= 5) break;
  }

  return Array.from(sessions.values());
};

export default function SecurityPage() {
  const locale = useLocale();
  const t = useTranslations("securityPage");
  const {
    user,
    isLoading: isAuthLoading,
    hasHierarchyLevel,
    isSuperAdmin,
  } = useAuth();
  const userId = user?.id;
  const isAdmin = hasHierarchyLevel(2);
  const isStrictAdmin = isSuperAdmin();
  const canCleanupAudit = isStrictAdmin;
  const canManualAuditActions = isStrictAdmin;
  const [cleanupPeriod, setCleanupPeriod] = useState<CleanupPeriod>("3m");
  const relativeTimeFormat = useMemo(
    () =>
      new Intl.RelativeTimeFormat(locale === "kh" ? "km" : "en", {
        numeric: "auto",
      }),
    [locale]
  );
  const localizedCleanupPeriodOptions = useMemo(
    () =>
      cleanupPeriodOptions.map((option) => ({
        value: option,
        label: t(`cleanupPeriods.${option}`),
      })),
    [t]
  );
  const deviceLabels = useMemo(
    () => ({
      browserSession: t("devices.browserSession"),
      iphone: t("devices.iphone"),
      ipad: t("devices.ipad"),
      androidDevice: t("devices.androidDevice"),
      windowsPc: t("devices.windowsPc"),
      macDevice: t("devices.macDevice"),
      linuxDevice: t("devices.linuxDevice"),
    }),
    [t]
  );
  const browserLabels = useMemo(
    () => ({
      unknownBrowser: t("browsers.unknownBrowser"),
      edge: t("browsers.edge"),
      opera: t("browsers.opera"),
      chrome: t("browsers.chrome"),
      firefox: t("browsers.firefox"),
      safari: t("browsers.safari"),
    }),
    [t]
  );

  const allLogsQuery = useAuditLogs(
    {},
    {
      page: 1,
      limit: 25,
    },
    isAdmin
  );

  const userLogsQuery = useUserAuditLogs(
    userId,
    {
      page: 1,
      limit: 25,
    },
    !!userId
  );

  const summaryQuery = useAuditSummary(
    {
      days: 30,
    },
    isAdmin
  );

  const logAuditActionMutation = useLogAuditAction();
  const logLoginSessionMutation = useLogLoginSession();
  const cleanupMutation = useMutation({
    mutationFn: (period: CleanupPeriod) => auditApi.cleanupAuditLogs({ period }),
    onSuccess: (result) => {
      toast.success(result.message ?? t("cleanupSuccess"));
      void allLogsQuery.refetch();
      void userLogsQuery.refetch();
      if (isAdmin) {
        void summaryQuery.refetch();
      }
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("cleanupFailed");
      toast.error(message);
    },
  });

  const logsQuery = isAdmin ? allLogsQuery : userLogsQuery;
  const logs = useMemo(() => logsQuery.data?.logs ?? [], [logsQuery.data?.logs]);
  const summary = isAdmin ? summaryQuery.data?.summary : undefined;
  const isLoading =
    isAuthLoading ||
    logsQuery.isLoading ||
    (isAdmin && summaryQuery.isLoading) ||
    cleanupMutation.isPending;
  const hasError =
    logsQuery.isError ||
    (isAdmin && summaryQuery.isError);

  const securityEvents = useMemo<SecurityEvent[]>(() => {
    return logs.slice(0, 6).map((log) => {
      const status = actionToStatus(log.action);
      return {
        id: log.id,
        type: humanizeAction(log.action),
        description: buildEventDescription(
          log,
          t("accountActivity"),
          (entity, ip) => t("activityFromIp", { entity, ip })
        ),
        time: formatRelativeTime(log.createdAt, relativeTimeFormat, t("unknownTime")),
        status,
        icon: actionToIcon(log.action, status),
      };
    });
  }, [logs, relativeTimeFormat, t]);

  const loginSessions = useMemo(
    () =>
      buildSessions(
        logs,
        relativeTimeFormat,
        t("unknownTime"),
        t("unknownIp"),
        (id) => t("userNumber", { id }),
        t("unknownUser"),
        deviceLabels,
        browserLabels
      ),
    [browserLabels, deviceLabels, logs, relativeTimeFormat, t]
  );

  const failedActionCount = useMemo(() => {
    return (summary?.actionSummary ?? []).reduce((count, action) => {
      return /(fail|denied|blocked|invalid|unauthor)/i.test(action.action)
        ? count + action.count
        : count;
    }, 0);
  }, [summary?.actionSummary]);

  const loginActionCount = useMemo(() => {
    return (summary?.actionSummary ?? []).reduce((count, action) => {
      return /login/i.test(action.action) ? count + action.count : count;
    }, 0);
  }, [summary?.actionSummary]);

  const totalEvents = logsQuery.data?.pagination.total ?? logs.length;
  const lastActivity = logs[0];
  const topActions = (summary?.actionSummary ?? []).slice(0, 5);
  const topEntities = (summary?.entitySummary ?? []).slice(0, 5);

  return (
    <PermissionGuard hierarchyLevel={5} redirectTo="/dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">
            {isAdmin
              ? t("adminDescription")
              : t("description")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canManualAuditActions && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logAuditActionMutation.isPending}
                  onClick={() =>
                    logAuditActionMutation.mutate({
                      action: "SECURITY_DASHBOARD_VIEW",
                      entity: "security",
                      details: {
                        message: "Manual security dashboard audit ping",
                        scope: "global",
                      },
                    })
                  }
                >
                  <FileClock className="mr-2 h-4 w-4" />
                  {t("recordAuditAction")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logLoginSessionMutation.isPending}
                  onClick={() => logLoginSessionMutation.mutate()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("logLoginSession")}
                </Button>
              </>
            )}
            {canCleanupAudit && (
              <>
                <Select
                  value={cleanupPeriod}
                  onValueChange={(value) => setCleanupPeriod(value as CleanupPeriod)}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder={t("selectPeriod")} />
                  </SelectTrigger>
                  <SelectContent>
                    {localizedCleanupPeriodOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={cleanupMutation.isPending}
                  onClick={() => cleanupMutation.mutate(cleanupPeriod)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("cleanupLogs")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t("cleanupDescription")}
                </p>
              </>
            )}
          </div>
          {hasError && (
            <p className="text-sm text-destructive mt-2">
              {t("loadFailed")}
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("cards.totalEvents.title")}</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "--" : totalEvents}</div>
                <p className="text-xs text-muted-foreground">{t("cards.totalEvents.description")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("cards.loginEvents.title")}</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "--" : loginActionCount}</div>
                <p className="text-xs text-muted-foreground">{t("cards.loginEvents.description")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("cards.lastActivity.title")}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading
                    ? "--"
                    : lastActivity
                      ? formatRelativeTime(lastActivity.createdAt, relativeTimeFormat, t("unknownTime"))
                      : t("noData")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastActivity ? humanizeAction(lastActivity.action) : t("noActivityYet")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("cards.suspiciousEvents.title")}</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "--" : failedActionCount}</div>
                <p className="text-xs text-muted-foreground">{t("cards.suspiciousEvents.description")}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className={cn("grid gap-6", isAdmin ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>{t("auditSummaryTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("loadingSummary")}
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-medium mb-2">{t("topActionsTitle")}</h4>
                      {topActions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("noActionSummaryData")}</p>
                      ) : (
                        <div className="space-y-2">
                          {topActions.map((item) => (
                            <div
                              key={`${item.action}-${item.count}`}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{humanizeAction(item.action)}</span>
                              <Badge variant="outline">{item.count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">{t("topEntitiesTitle")}</h4>
                      {topEntities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("noEntitySummaryData")}</p>
                      ) : (
                        <div className="space-y-2">
                          {topEntities.map((item) => (
                            <div
                              key={`${item.entity}-${item.count}`}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{item.entity}</span>
                              <Badge variant="outline">{item.count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {isAdmin ? t("recentSecurityEvents") : t("recentSecurityEventsOwn")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loadingRecentSecurityEvents")}
                </div>
              ) : securityEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noRecentSecurityEvents")}</p>
              ) : (
                <div className="space-y-4">
                  {securityEvents.map((event) => {
                    const Icon = event.icon;
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            event.status === "success"
                              ? "text-green-600"
                              : event.status === "warning"
                                ? "text-yellow-600"
                                : "text-blue-600"
                          )}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{event.type}</h4>
                            <Badge variant={event.status} className="text-xs">
                              {t(`statusLabels.${event.status}`)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                          <p className="text-xs text-muted-foreground">{event.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? t("recentLoginSessions") : t("recentLoginSessionsOwn")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("loadingLoginSessions")}
              </div>
            ) : loginSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noLoginSessionData")}
              </p>
            ) : (
              <div className="space-y-4">
                {loginSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-3 p-4 border rounded-lg sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg dark:bg-muted">
                        <Smartphone className="h-5 w-5 text-gray-600 dark:text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium">{session.userDisplayName}</h4>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          {session.username && <span>@{session.username}</span>}
                          {session.email && <span>{session.email}</span>}
                          {typeof session.userId === "number" && (
                            <span>{t("userIdLabel", { id: session.userId })}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span>
                            {session.device} ({session.browser})
                          </span>
                          <span>{t("ipLabel", { ip: session.ip })}</span>
                          <span>{t("lastActiveLabel", { value: session.lastActive })}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("lastEventLabel", { value: session.lastAction })}
                        </p>
                      </div>
                    </div>
                    {session.current && (
                      <Badge variant="default" className="text-xs">
                        {t("current")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
