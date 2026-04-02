"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  DollarSign,
  MapPin,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProperiesStatistics } from "@/hooks/property/useProperty";
import { usePropertyValuationStatistics } from "@/hooks/propertyValuation/usePropertyValuation";
import { useUserStatistics } from "@/hooks/user/useUser";
import type { UserStatisticsResponse } from "@/hooks/user/user.api";

const CHART_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#6366f1",
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981",
  INACTIVE: "#f59e0b",
  SUSPENDED: "#ef4444",
  DRAFT: "#94a3b8",
  PENDING_REVIEW: "#f59e0b",
  IN_REVIEW: "#0ea5e9",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  ARCHIVED: "#6b7280",
  SOLD: "#8b5cf6",
  RENTED: "#06b6d4",
  RENTAL_SALE: "#a855f7",
  SUPERSEDED: "#eab308",
  EXPIRED: "#6b7280",
  CANCELLED: "#dc2626",
};

type ChartDatum = {
  name: string;
  value: number;
  fill?: string;
};

type ValuerDatum = {
  name: string;
  count: number;
  avgValue: number;
};

type MonthlyDatum = {
  month: string;
  count: number;
  avgValue?: number;
};

type TooltipEntry = {
  name?: string | number;
  value?: string | number;
  color?: string;
};

type PropertyStatsPayload = {
  overview?: {
    totalProperties?: number;
    propertiesWithValuations?: number;
  };
  workflow?: {
    pending?: number;
    property?: { pending?: number };
    valuation?: { pending?: number };
    indicativeValuation?: { pending?: number };
  };
  byType?: Array<{ propertyTypeName?: string; count?: number }>;
  byProvince?: Array<{ provinceName?: string; count?: number }>;
  byStatus?: Record<string, number>;
  trends?: {
    monthly?: Array<{ month?: string | number; count?: number }>;
  };
};

type ValuationStatsPayload = {
  data?: {
    overview?: {
      totalValuations?: number;
      totalMarketValue?: number;
      totalLandValue?: number;
      totalBuildingValue?: number;
      averageMarketValue?: number;
      averageLandValue?: number;
      averageBuildingValue?: number;
      minValue?: number;
      maxValue?: number;
    };
    workflow?: {
      draft?: number;
      pending?: number;
      approved?: number;
      rejected?: number;
      inReview?: number;
      avgApprovalDays?: number | null;
      approvalRate?: number;
    };
    byStatus?: Record<string, number>;
    byMethod?: Array<{ method?: string; count?: number }>;
    byPropertyType?: Array<{ propertyTypeName?: string; count?: number }>;
    byValuer?: Array<{
      valuerName?: string;
      count?: number;
      avgMarketValue?: number;
    }>;
    byProvince?: Array<{ provinceName?: string; count?: number }>;
    trends?: {
      monthly?: Array<{ month?: string | number; count?: number; avgValue?: number }>;
    };
  };
};

const toNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toText = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
};

const normalizeIntlLocale = (value: string) =>
  value === "kh" ? "km-KH" : "en-US";

const formatCurrency = (value: number, locale: string, compact = false): string => {
  if (compact) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale).format(value);

const formatMonth = (value: unknown, locale: string, unavailableLabel: string): string => {
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
    }
    return value;
  }
  if (typeof value === "number" && value >= 1 && value <= 12) {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(
      new Date(2026, value - 1, 1)
    );
  }
  return unavailableLabel;
};

const CustomTooltip = ({
  active,
  payload,
  label,
  detailsLabel,
  locale,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  detailsLabel: string;
  locale: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label || detailsLabel}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || CHART_COLORS[index % CHART_COLORS.length] }}
              />
              {entry.name}
            </span>
            <span className="text-sm font-semibold">{formatNumber(toNumber(entry.value), locale)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AnalyticsPage() {
  const locale = useLocale();
  const intlLocale = normalizeIntlLocale(locale);
  const t = useTranslations("analytics");
  const tDashboard = useTranslations("dashboard");
  const { data: propertyStats, isLoading: isLoadingProperty } = useProperiesStatistics();
  const { data: valuationStats, isLoading: isLoadingValuation } =
    usePropertyValuationStatistics();
  const { data: userStats, isLoading: isLoadingUser } = useUserStatistics();

  const propertyPayload = propertyStats as PropertyStatsPayload | undefined;
  const valuationPayload = valuationStats as ValuationStatsPayload | undefined;
  const userPayload = userStats as UserStatisticsResponse | undefined;

  const overview = propertyPayload?.overview;
  const propertyWorkflow = propertyPayload?.workflow;
  const valuationOverview = valuationPayload?.data?.overview;
  const valuationWorkflow = valuationPayload?.data?.workflow;
  const userOverview = userPayload?.overview;

  const isLoading = isLoadingProperty || isLoadingValuation || isLoadingUser;
  const pendingReviewBreakdown = {
    property: toNumber(propertyWorkflow?.property?.pending),
    valuation: toNumber(propertyWorkflow?.valuation?.pending),
    indicative: toNumber(propertyWorkflow?.indicativeValuation?.pending),
  };
  const totalPendingReview = toNumber(propertyWorkflow?.pending);
  const totalMarketValue = toNumber(valuationOverview?.totalMarketValue);

  const translateStatus = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return tDashboard("statuses.active");
      case "INACTIVE":
        return tDashboard("statuses.inactive");
      case "SUSPENDED":
        return t("statuses.suspended");
      case "DRAFT":
        return tDashboard("statuses.draft");
      case "PENDING_REVIEW":
        return tDashboard("statuses.pendingReview");
      case "IN_REVIEW":
        return t("statuses.inReview");
      case "APPROVED":
        return tDashboard("statuses.approved");
      case "REJECTED":
        return tDashboard("statuses.rejected");
      case "ARCHIVED":
        return tDashboard("statuses.archived");
      case "SOLD":
        return tDashboard("statuses.sold");
      case "RENTED":
        return tDashboard("statuses.rented");
      case "RENTAL_SALE":
        return tDashboard("statuses.rentalSale");
      case "SUPERSEDED":
        return tDashboard("statuses.superseded");
      case "EXPIRED":
        return tDashboard("statuses.expired");
      case "CANCELLED":
        return tDashboard("statuses.cancelled");
      default:
        return status ? status.replace(/_/g, " ") : tDashboard("notAvailable");
    }
  };

  const translateMethod = (method?: string) => {
    switch (method) {
      case "SALES_COMPARISON_APPROACH":
        return tDashboard("valuationMethods.salesComparisonApproach");
      case "INCOME_APPROACH":
        return tDashboard("valuationMethods.incomeApproach");
      case "COST_APPROACH":
        return tDashboard("valuationMethods.costApproach");
      case "SALES_AND_COST_APPROACH":
        return tDashboard("valuationMethods.salesAndCostApproach");
      default:
        return method ? method.replace(/_/g, " ") : tDashboard("notAvailable");
    }
  };

  const byPropertyType = useMemo<ChartDatum[]>(
    () =>
      (propertyPayload?.byType || []).map((item) => ({
        name: toText(item.propertyTypeName, tDashboard("unknown")),
        value: toNumber(item.count),
      })),
    [propertyPayload?.byType, tDashboard]
  );

  const byProvinceProperty = useMemo<ChartDatum[]>(
    () =>
      (propertyPayload?.byProvince || []).map((item) => ({
        name: toText(item.provinceName, tDashboard("unknown")),
        value: toNumber(item.count),
      })),
    [propertyPayload?.byProvince, tDashboard]
  );

  const byStatus = useMemo<ChartDatum[]>(
    () =>
      Object.entries(propertyPayload?.byStatus || {}).map(([status, count]) => ({
        name: translateStatus(status),
        value: toNumber(count),
        fill: STATUS_COLORS[status] || CHART_COLORS[0],
      })),
    [propertyPayload?.byStatus, t, tDashboard]
  );

  const propertyMonthlyTrend = useMemo<MonthlyDatum[]>(
    () =>
      (propertyPayload?.trends?.monthly || []).map((item) => ({
        month: formatMonth(item.month, intlLocale, tDashboard("notAvailable")),
        count: toNumber(item.count),
      })),
    [intlLocale, propertyPayload?.trends?.monthly, tDashboard]
  );

  const valuationByStatus = useMemo<ChartDatum[]>(
    () =>
      Object.entries(valuationPayload?.data?.byStatus || {}).map(([status, count]) => ({
        name: translateStatus(status),
        value: toNumber(count),
        fill: STATUS_COLORS[status] || CHART_COLORS[0],
      })),
    [t, tDashboard, valuationPayload?.data?.byStatus]
  );

  const workflowStatusData = useMemo<ChartDatum[]>(
    () =>
      [
        { name: translateStatus("DRAFT"), value: toNumber(valuationWorkflow?.draft), fill: STATUS_COLORS.DRAFT },
        { name: translateStatus("PENDING_REVIEW"), value: toNumber(valuationWorkflow?.pending), fill: STATUS_COLORS.PENDING_REVIEW },
        { name: translateStatus("APPROVED"), value: toNumber(valuationWorkflow?.approved), fill: STATUS_COLORS.APPROVED },
        { name: translateStatus("REJECTED"), value: toNumber(valuationWorkflow?.rejected), fill: STATUS_COLORS.REJECTED },
      ].filter((item) => item.value > 0),
    [t, tDashboard, valuationWorkflow?.draft, valuationWorkflow?.pending, valuationWorkflow?.approved, valuationWorkflow?.rejected]
  );

  const valuationByMethod = useMemo<ChartDatum[]>(
    () =>
      (valuationPayload?.data?.byMethod || []).map((item) => ({
        name: translateMethod(toText(item.method, tDashboard("unknown"))),
        value: toNumber(item.count),
      })),
    [tDashboard, valuationPayload?.data?.byMethod]
  );

  const valuationByValuer = useMemo<ValuerDatum[]>(
    () =>
      (valuationPayload?.data?.byValuer || []).map((item) => ({
        name: toText(item.valuerName, tDashboard("unknown")),
        count: toNumber(item.count),
        avgValue: toNumber(item.avgMarketValue),
      })),
    [tDashboard, valuationPayload?.data?.byValuer]
  );

  const valuationByProvince = useMemo<ChartDatum[]>(
    () =>
      (valuationPayload?.data?.byProvince || []).map((item) => ({
        name: toText(item.provinceName, tDashboard("unknown")),
        value: toNumber(item.count),
      })),
    [tDashboard, valuationPayload?.data?.byProvince]
  );

  const valuationMonthlyTrend = useMemo<MonthlyDatum[]>(
    () =>
      (valuationPayload?.data?.trends?.monthly || []).map((item) => ({
        month: formatMonth(item.month, intlLocale, tDashboard("notAvailable")),
        count: toNumber(item.count),
        avgValue: toNumber(item.avgValue),
      })),
    [intlLocale, tDashboard, valuationPayload?.data?.trends?.monthly]
  );

  const userByRole = useMemo<ChartDatum[]>(
    () =>
      (userPayload?.byRole || []).map((role) => ({
        name: toText(role.roleName, tDashboard("unknown")),
        value: toNumber(role.count),
      })),
    [tDashboard, userPayload?.byRole]
  );

  const userStatusDistribution = useMemo<ChartDatum[]>(
    () => [
      { name: translateStatus("ACTIVE"), value: toNumber(userOverview?.activeUsers), fill: STATUS_COLORS.ACTIVE },
      { name: translateStatus("INACTIVE"), value: toNumber(userOverview?.inactiveUsers), fill: STATUS_COLORS.INACTIVE },
      { name: translateStatus("SUSPENDED"), value: toNumber(userOverview?.suspendedUsers), fill: STATUS_COLORS.SUSPENDED },
    ],
    [t, tDashboard, userOverview?.activeUsers, userOverview?.inactiveUsers, userOverview?.suspendedUsers]
  );

  const registrationTrend = useMemo<MonthlyDatum[]>(
    () =>
      (userPayload?.trends?.monthly || []).map((item) => ({
        month: formatMonth(item.month, intlLocale, tDashboard("notAvailable")),
        count: toNumber(item.count),
      })),
    [intlLocale, tDashboard, userPayload?.trends?.monthly]
  );

  const topValuers = useMemo<ValuerDatum[]>(
    () =>
      (userPayload?.topValuers || []).map((valuer) => ({
        name: toText(valuer.valuerName, tDashboard("unknown")),
        count: toNumber(valuer.valuationCount),
        avgValue: toNumber(valuer.avgMarketValue),
      })),
    [tDashboard, userPayload?.topValuers]
  );

  const totalProperties = toNumber(overview?.totalProperties);
  const activeUserRate =
    toNumber(userOverview?.totalUsers) > 0
      ? Math.round((toNumber(userOverview?.activeUsers) / toNumber(userOverview?.totalUsers)) * 100)
      : 0;
  const isLoadingWorkflow = isLoadingValuation;
  const summaryCards = [
    {
      title: tDashboard("totalProperties"),
      value: formatNumber(totalProperties, intlLocale),
      detail: tDashboard("summaryCards.totalPropertiesDetail", {
        count: formatNumber(toNumber(overview?.propertiesWithValuations), intlLocale),
      }),
      icon: Building2,
      chip: tDashboard("chips.inventory"),
      className:
        "from-sky-500/10 via-sky-500/5 to-transparent border-sky-200/80 dark:border-sky-700/50",
      iconClass: "bg-sky-500 text-white",
    },
    {
      title: t("activeUserRatioTitle"),
      value: `${formatNumber(activeUserRate, intlLocale)}%`,
      detail: t("activeUserRatioDescription"),
      icon: Users,
      chip: t("users"),
      className:
        "from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200/80 dark:border-emerald-700/50",
      iconClass: "bg-emerald-500 text-white",
    },
    {
      title: tDashboard("totalMarketValue"),
      value: formatCurrency(totalMarketValue, intlLocale, true),
      detail: `${tDashboard("totalLandValue")}: ${formatCurrency(toNumber(valuationOverview?.totalLandValue), intlLocale, true)} | ${tDashboard("totalBuildingValue")}: ${formatCurrency(toNumber(valuationOverview?.totalBuildingValue), intlLocale, true)}`,
      icon: DollarSign,
      chip: tDashboard("chips.finance"),
      className:
        "from-violet-500/10 via-violet-500/5 to-transparent border-violet-200/80 dark:border-violet-700/50",
      iconClass: "bg-violet-500 text-white",
    },
    {
      title: tDashboard("summaryCards.pendingReview"),
      value: formatNumber(totalPendingReview, intlLocale),
      detail: tDashboard("summaryCards.pendingReviewDetailBreakdown", {
        property: formatNumber(pendingReviewBreakdown.property, intlLocale),
        valuation: formatNumber(pendingReviewBreakdown.valuation, intlLocale),
        indicative: formatNumber(pendingReviewBreakdown.indicative, intlLocale),
      }),
      icon: Clock3,
      chip: tDashboard("chips.action"),
      className:
        "from-amber-500/10 via-amber-500/5 to-transparent border-amber-200/80 dark:border-amber-700/50",
      iconClass: "bg-amber-500 text-white",
    },
  ];

  return (
    <PermissionGuard hierarchyLevel={3} redirectTo="/dashboard">
      <div className="space-y-5 sm:space-y-6">
       <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-36 rounded-2xl" />
              ))
            : summaryCards.map((card) => (
                <Card
                  key={card.title}
                  className={`border bg-gradient-to-br ${card.className} shadow-sm`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardDescription>{card.title}</CardDescription>
                      <Badge
                        variant="secondary"
                        className="border border-border/60 bg-background/80"
                      >
                        {card.chip}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
                      </div>
                      <span
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClass}`}
                      >
                        <card.icon className="h-5 w-5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </section>

        <Tabs defaultValue="properties" className="space-y-6">
          <TabsList className="sticky top-2 z-10 grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-background/90 p-1 backdrop-blur md:top-0 sm:grid-cols-4">
            <TabsTrigger value="properties" className="gap-2 rounded-xl py-2.5 text-xs sm:text-sm">
              <Building2 className="h-4 w-4" />
              {t("properties")}
            </TabsTrigger>
            <TabsTrigger value="valuations" className="gap-2 rounded-xl py-2.5 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              {t("PropertyValuations")}
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-2 rounded-xl py-2.5 text-xs sm:text-sm">
              <MapPin className="h-4 w-4" />
              {t("locations")}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 rounded-xl py-2.5 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              {t("users")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="space-y-4 rounded-2xl border border-border/50 bg-background/60 p-3 sm:p-4 md:p-5">
            <div className="grid gap-4 xl:grid-cols-12">
              <Card className="xl:col-span-6 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("propertyTypeMixTitle")}</CardTitle>
                  <CardDescription>{t("propertyTypeMixDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingProperty ? (
                    <Skeleton className="h-[320px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={byPropertyType}
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {byPropertyType.map((entry, index) => (
                              <Cell
                                key={`${entry.name}-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                                className="stroke-background"
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Legend verticalAlign="middle" align="right" layout="vertical" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="xl:col-span-6 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("propertyStatusTitle")}</CardTitle>
                  <CardDescription>{t("propertyStatusDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingProperty ? (
                    <Skeleton className="h-[320px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byStatus} layout="vertical" margin={{ left: 10, right: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis type="number" axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                            {byStatus.map((entry, index) => (
                              <Cell
                                key={`${entry.name}-${index}`}
                                fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t("propertyGrowthTrendTitle")}
                </CardTitle>
                <CardDescription>{t("propertyGrowthTrendDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingProperty ? (
                  <Skeleton className="h-[300px] w-full rounded-xl" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={propertyMonthlyTrend}>
                        <defs>
                          <linearGradient id="propertyCountGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                        <Area
                          type="monotone"
                          dataKey="count"
                          name={tDashboard("totalProperties")}
                          stroke="#0ea5e9"
                          strokeWidth={3}
                          fill="url(#propertyCountGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="valuations" className="space-y-4 rounded-2xl border border-border/50 bg-background/60 p-3 sm:p-4 md:p-5">
            <div className="grid gap-4 xl:grid-cols-12">
              <Card className="xl:col-span-6 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("workflowStatusTitle")}</CardTitle>
                  <CardDescription>{t("workflowStatusDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingWorkflow ? (
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={workflowStatusData} dataKey="value" innerRadius={65} outerRadius={105}>
                            {workflowStatusData.map((entry, index) => (
                              <Cell
                                key={`${entry.name}-${index}`}
                                fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Legend verticalAlign="bottom" />
                        </PieChart>
                      </ResponsiveContainer>

                    </div>

                  )}
                </CardContent>

              </Card>

              <Card className="xl:col-span-6 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("propertyValuationStatusTitle")}</CardTitle>
                  <CardDescription>{t("propertyValuationStatusDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingValuation ? (
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={valuationByStatus} dataKey="value" innerRadius={65} outerRadius={105}>
                            {valuationByStatus.map((entry, index) => (
                              <Cell
                                key={`${entry.name}-${index}`}
                                fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Legend verticalAlign="bottom" />
                        </PieChart>
                      </ResponsiveContainer>

                    </div>

                  )}
                </CardContent>
                
              </Card>

              <Card className="xl:col-span-12 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("valuationMethodsTitle")}</CardTitle>
                  <CardDescription>{t("valuationMethodsDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingValuation ? (
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={valuationByMethod} margin={{ left: 10, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={60}>
                            {valuationByMethod.map((entry, index) => (
                              <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t("monthlyValuationTrendTitle")}
                </CardTitle>
                <CardDescription>{t("monthlyValuationTrendDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingValuation ? (
                  <Skeleton className="h-[320px] w-full rounded-xl" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={valuationMonthlyTrend}>
                        <defs>
                          <linearGradient id="valuationCountGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="count"
                          name={tDashboard("valuation")}
                          stroke="#6366f1"
                          fill="url(#valuationCountGradient)"
                          strokeWidth={2.5}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="avgValue"
                          name={t("avgValue")}
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("topValuersTitle")}</CardTitle>
                  <CardDescription>{t("topValuersDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingValuation ? (
                    <Skeleton className="h-[260px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={valuationByValuer} layout="vertical" margin={{ left: 25, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis type="number" axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("valuationsByProvinceTitle")}</CardTitle>
                  <CardDescription>{t("valuationsByProvinceDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingValuation ? (
                    <Skeleton className="h-[260px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={valuationByProvince} layout="vertical" margin={{ left: 25, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis type="number" axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#14b8a6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="locations" className="space-y-4 rounded-2xl border border-border/50 bg-background/60 p-3 sm:p-4 md:p-5">
            <div className="grid gap-4 xl:grid-cols-12 ">
              <Card className="xl:col-span-8 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {t("propertyDistributionByProvinceTitle")}
                  </CardTitle>
                  <CardDescription>{t("propertyDistributionByProvinceDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingProperty ? (
                    <Skeleton className="h-[360px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[360px] overflow-x-auto">
                      <div className="h-full min-w-[560px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={byProvinceProperty} margin={{ bottom: 20 }}>
                          <defs>
                            <linearGradient id="provinceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.5} />
                              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} angle={-25} textAnchor="end" height={70} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Area type="monotone" dataKey="value" stroke="#0ea5e9" fill="url(#provinceAreaGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="xl:col-span-4 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("topRegionsTitle")}</CardTitle>
                  <CardDescription>{t("topRegionsDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(isLoading ? [] : [...byProvinceProperty].sort((a, b) => b.value - a.value).slice(0, 8)).map(
                    (row, index) => (
                      <div
                        key={`${row.name}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-3 py-2"
                      >
                        <span className="inline-flex items-center gap-2 text-sm">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {index + 1}
                          </span>
                          {row.name}
                        </span>
                        <span className="text-sm font-semibold">{formatNumber(row.value, intlLocale)}</span>
                      </div>
                    )
                  )}
                  {isLoading && (
                    <div className="space-y-2">
                      <Skeleton className="h-9 w-full rounded-lg" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 rounded-2xl border border-border/50 bg-background/60 p-3 sm:p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title={t("totalUsersCardTitle")}
                icon={Users}
                value={formatNumber(toNumber(userOverview?.totalUsers), intlLocale)}
                subtext={t("totalUsersCardSubtext", {
                  count: formatNumber(toNumber(userOverview?.usersThisMonth), intlLocale),
                })}
                isLoading={isLoadingUser}
                iconBg="bg-blue-500"
              />
              <KpiCard
                title={t("activeUsersCardTitle")}
                icon={UserCheck}
                value={formatNumber(toNumber(userOverview?.activeUsers), intlLocale)}
                subtext={t("activeUsersCardSubtext", {
                  percent: formatNumber(
                    toNumber(userOverview?.totalUsers) > 0
                      ? Math.round((toNumber(userOverview?.activeUsers) / toNumber(userOverview?.totalUsers)) * 100)
                      : 0,
                    intlLocale,
                  ),
                })}
                isLoading={isLoadingUser}
                iconBg="bg-emerald-500"
              />
              <KpiCard
                title={t("inactiveUsersCardTitle")}
                icon={UserX}
                value={formatNumber(toNumber(userOverview?.inactiveUsers), intlLocale)}
                subtext={t("inactiveUsersCardSubtext", {
                  count: formatNumber(toNumber(userOverview?.suspendedUsers), intlLocale),
                })}
                isLoading={isLoadingUser}
                iconBg="bg-amber-500"
              />
              <KpiCard
                title={t("usersWithValuationsCardTitle")}
                icon={TrendingUp}
                value={formatNumber(toNumber(userOverview?.usersWithValuations), intlLocale)}
                subtext={t("usersWithValuationsCardSubtext")}
                isLoading={isLoadingUser}
                iconBg="bg-violet-500"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-12">
              <Card className="xl:col-span-5 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("userStatusDistributionTitle")}</CardTitle>
                  <CardDescription>{t("userStatusDistributionDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingUser ? (
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={userStatusDistribution} dataKey="value" innerRadius={70} outerRadius={105}>
                            {userStatusDistribution.map((entry, index) => (
                              <Cell
                                key={`${entry.name}-${index}`}
                                fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Legend verticalAlign="bottom" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="xl:col-span-7 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("usersByRoleTitle")}</CardTitle>
                  <CardDescription>{t("usersByRoleDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingUser ? (
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={userByRole} margin={{ bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={8} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={55}>
                            {userByRole.map((entry, index) => (
                              <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {t("registrationTrendTitle")}
                  </CardTitle>
                  <CardDescription>{t("registrationTrendDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingUser ? (
                    <Skeleton className="h-[250px] w-full rounded-xl" />
                  ) : (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={registrationTrend}>
                          <defs>
                            <linearGradient id="registrationAreaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip detailsLabel={t("details")} locale={intlLocale} />} />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#8b5cf6"
                            strokeWidth={2.5}
                            fill="url(#registrationAreaGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    {t("topValuersByUserTitle")}
                  </CardTitle>
                  <CardDescription>{t("topValuersByUserDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(isLoadingUser ? [] : topValuers.slice(0, 6)).map((valuer, index) => (
                    <div
                      key={`${valuer.name}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-3 py-2"
                      >
                        <span className="inline-flex items-center gap-2 text-sm">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {index + 1}
                        </span>
                        {valuer.name}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatNumber(valuer.count, intlLocale)} ({formatCurrency(valuer.avgValue, intlLocale, true)})
                      </span>
                    </div>
                  ))}
                  {isLoadingUser && (
                    <div className="space-y-2">
                      <Skeleton className="h-9 w-full rounded-lg" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}

function KpiCard({
  title,
  icon: Icon,
  value,
  subtext,
  isLoading,
  iconBg,
}: {
  title: string;
  icon: LucideIcon;
  value: string;
  subtext: string;
  isLoading: boolean;
  iconBg: string;
}) {
  return (
    <Card className="border-border/60 bg-gradient-to-br from-background to-muted/30 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} text-white`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
          </div>
        ) : (
          <>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
