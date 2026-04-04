"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  BarChart3,
  Clock3,
  DollarSign,
  Home,
  MapPin,
  Plus,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProperiesStatistics } from "@/hooks/property/useProperty";
import { usePropertyValuationStatistics } from "@/hooks/propertyValuation/usePropertyValuation";

type TrendPoint = {
  month: string;
  label: string;
  propertyCount: number;
  valuationCount: number;
  indicativeCount: number;
  totalCount: number;
  propertyHeight: number;
  valuationHeight: number;
  indicativeHeight: number;
};

type MonthlyTrendSource = {
  month?: unknown;
  count?: unknown;
  propertyCount?: unknown;
  valuationCount?: unknown;
  indicativeCount?: unknown;
};

type ProvinceSource = {
  provinceName?: string;
  count?: unknown;
};

type ChartDatum = {
  name: string;
  value: number;
};

type TooltipEntry = {
  name?: string | number;
  value?: string | number;
  color?: string;
};

const CHART_COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b"];

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

const formatNumber = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale).format(value);

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

const toMonthKey = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}/.test(value)) return value.slice(0, 7);
    const dateFromString = new Date(value);
    if (!Number.isNaN(dateFromString.getTime())) {
      return `${dateFromString.getFullYear()}-${String(dateFromString.getMonth() + 1).padStart(2, "0")}`;
    }
  }
  if (typeof value === "number" && value >= 1 && value <= 12) {
    const year = new Date().getFullYear();
    return `${year}-${String(value).padStart(2, "0")}`;
  }
  return null;
};

const buildLastMonths = (total: number, locale: string) => {
  const now = new Date();
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "short" });
  return Array.from({ length: total }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (total - 1 - index), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: monthFormat.format(d),
    };
  });
};

const getBarHeight = (value: number, max: number) => {
  if (max <= 0) return 10;
  return Math.max(10, Math.round((value / max) * 128));
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

export default function DashboardPage() {
  const locale = useLocale();
  const intlLocale = normalizeIntlLocale(locale);
  const tDashboard = useTranslations("dashboard");
  const tAnalytics = useTranslations("analytics");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const { data: propertyStats, isLoading: isLoadingProperty } =
    useProperiesStatistics();
  const { data: valuationStats, isLoading: isLoadingValuation } =
    usePropertyValuationStatistics();

  const overview = propertyStats?.overview;
  const valuationOverview = valuationStats?.data?.overview;
  const propertyWorkflow = propertyStats?.workflow as
    | {
        pending?: unknown;
        property?: { pending?: unknown };
        valuation?: { pending?: unknown };
        indicativeValuation?: { pending?: unknown };
      }
    | undefined;

  const isLoading = isLoadingProperty || isLoadingValuation;
  const pendingReviewBreakdown = {
    property: toNumber(propertyWorkflow?.property?.pending),
    valuation: toNumber(propertyWorkflow?.valuation?.pending),
    indicative: toNumber(propertyWorkflow?.indicativeValuation?.pending),
  };
  const totalPendingReview = toNumber(propertyWorkflow?.pending);
  const totalMarketValue = toNumber(valuationOverview?.totalMarketValue);

  const monthlyTrend = useMemo<TrendPoint[]>(() => {
    const axis = buildLastMonths(7, intlLocale);
    const activityTrend = new Map<
      string,
      { propertyCount: number; valuationCount: number; indicativeCount: number }
    >();
    const activityMonthly =
      (propertyStats?.trends?.monthly as MonthlyTrendSource[] | undefined) || [];
    for (const point of activityMonthly) {
      const key = toMonthKey(point.month);
      if (!key) continue;
      activityTrend.set(key, {
        propertyCount: toNumber(point.propertyCount ?? point.count),
        valuationCount: toNumber(point.valuationCount),
        indicativeCount: toNumber(point.indicativeCount),
      });
    }

    const rows = axis.map(({ key, label }) => {
      const point = activityTrend.get(key);
      const propertyCount = point?.propertyCount || 0;
      const valuationCount = point?.valuationCount || 0;
      const indicativeCount = point?.indicativeCount || 0;

      return {
        month: key,
        label,
        propertyCount,
        valuationCount,
        indicativeCount,
        totalCount: propertyCount + valuationCount + indicativeCount,
        propertyHeight: 0,
        valuationHeight: 0,
        indicativeHeight: 0,
      };
    });

    const maxProperty = Math.max(...rows.map((row) => row.propertyCount), 0);
    const maxValuation = Math.max(...rows.map((row) => row.valuationCount), 0);
    const maxIndicative = Math.max(...rows.map((row) => row.indicativeCount), 0);

    return rows.map((row) => ({
      ...row,
      propertyHeight: getBarHeight(row.propertyCount, maxProperty),
      valuationHeight: getBarHeight(row.valuationCount, maxValuation),
      indicativeHeight: getBarHeight(row.indicativeCount, maxIndicative),
    }));
  }, [intlLocale, propertyStats?.trends?.monthly]);

  const overviewActivity = useMemo(() => {
    const totals = monthlyTrend.reduce(
      (acc, row) => {
        acc.properties += row.propertyCount;
        acc.valuations += row.valuationCount;
        acc.indicatives += row.indicativeCount;
        acc.total += row.totalCount;
        return acc;
      },
      { properties: 0, valuations: 0, indicatives: 0, total: 0 }
    );

    const peakActivityMonth = monthlyTrend.reduce((peak, row) =>
      row.totalCount > peak.totalCount ? row : peak
    , monthlyTrend[0] || {
      month: "n/a",
      label: "n/a",
      propertyCount: 0,
      valuationCount: 0,
      indicativeCount: 0,
      totalCount: 0,
      propertyHeight: 10,
      valuationHeight: 10,
      indicativeHeight: 10,
    });

    return {
      totalProperties: totals.properties,
      totalValuations: totals.valuations,
      totalIndicativeValuations: totals.indicatives,
      totalActivity: totals.total,
      peakActivityMonth,
    };
  }, [monthlyTrend]);

  const byProvinceProperty = useMemo<ChartDatum[]>(
    () =>
      ((propertyStats?.byProvince as ProvinceSource[] | undefined) || []).map((item) => ({
        name: toText(item.provinceName, tDashboard("unknown")),
        value: toNumber(item.count),
      })),
    [propertyStats?.byProvince, tDashboard]
  );

  const topRegionRows = useMemo(
    () => [...byProvinceProperty].sort((a, b) => b.value - a.value).slice(0, 8),
    [byProvinceProperty]
  );

  const summaryCards = [
    {
      title: tDashboard("totalProperties"),
      value: formatNumber(toNumber(overview?.totalProperties), intlLocale),
      detail: tDashboard("summaryCards.totalPropertiesDetail", {
        count: formatNumber(toNumber(overview?.propertiesWithValuations), intlLocale),
      }),
      icon: Home,
      chip: tDashboard("chips.inventory"),
      className:
        "from-sky-500/10 via-sky-500/5 to-transparent border-sky-200/80 dark:border-sky-700/50",
      iconClass: "bg-sky-500 text-white",
    },
    {
      title: tDashboard("summaryCards.totalValuations"),
      value: formatNumber(toNumber(valuationOverview?.totalValuations), intlLocale),
      detail: tDashboard("summaryCards.totalValuationsDetail", {
        value: formatCurrency(totalMarketValue, intlLocale, true),
      }),
      icon: DollarSign,
      chip: tDashboard("chips.finance"),
      className:
        "from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200/80 dark:border-emerald-700/50",
      iconClass: "bg-emerald-500 text-white",
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
    {
      title: tDashboard("summaryCards.totalMarketValue"),
      value: formatCurrency(totalMarketValue, intlLocale, true),
      detail: tDashboard("summaryCards.totalMarketValueDetail", {
        value: formatCurrency(toNumber(valuationOverview?.averageMarketValue), intlLocale, true),
      }),
      icon: TrendingUp,
      chip: tDashboard("chips.insights"),
      className:
        "from-violet-500/10 via-violet-500/5 to-transparent border-violet-200/80 dark:border-violet-700/50",
      iconClass: "bg-violet-500 text-white",
    },
  ];

  return (
    <PermissionGuard hierarchyLevel={3} redirectTo="/dashboard">
      <div className="w-full space-y-5 sm:space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{tNav("dashboard")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tDashboard("welcomeSummary", { welcome: tCommon("welcome") })} Camtop
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Link href="/dashboard/analytics">
              <Button variant="outline" className="w-full gap-2 sm:w-auto">
                <BarChart3 className="h-4 w-4" />
                {tNav("analytics")}
              </Button>
            </Link>
            <Link href="/dashboard/property/add">
              <Button className="w-full gap-2 sm:w-auto">
                <Plus className="h-4 w-4" />
                {tDashboard("addProperty")}
              </Button>
            </Link>
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

        <section className="grid gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-8 border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3">
                <div>
                  <CardTitle className="text-lg">{tDashboard("overviewActivityTitle")}</CardTitle>
                  <CardDescription>{tDashboard("overviewActivityDescription")}</CardDescription>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{tDashboard("sevenMonthProperties")}</p>
                    <p className="text-sm font-semibold">
                      {formatNumber(overviewActivity.totalProperties, intlLocale)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{tDashboard("sevenMonthValuations")}</p>
                    <p className="text-sm font-semibold">
                      {formatNumber(overviewActivity.totalValuations, intlLocale)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{tDashboard("sevenMonthIndicativeValuations")}</p>
                    <p className="text-sm font-semibold">
                      {formatNumber(overviewActivity.totalIndicativeValuations, intlLocale)}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[260px] w-full rounded-xl" />
              ) : (
                <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-4">
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      {tNav("properties")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-700 dark:bg-slate-300" />
                      {tDashboard("valuation")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-teal-400" />
                      {tDashboard("indicativeValuation")}
                    </span>
                  </div>
                  <div className="overflow-x-auto pb-1">
                    <div className="flex min-w-[520px] items-end justify-between gap-3 rounded-2xl border border-border/50 bg-background/75 px-4 py-5 sm:gap-5">
                      {monthlyTrend.map((row) => (
                        <div key={row.month} className="flex flex-1 flex-col items-center gap-3">
                          <div className="flex h-36 items-end gap-2">
                            <div
                              className="w-4 rounded-t-md bg-amber-400 shadow-sm"
                              style={{ height: `${row.propertyHeight}px` }}
                              title={`${tNav("properties")}: ${formatNumber(row.propertyCount, intlLocale)}`}
                            />
                            <div
                              className="w-4 rounded-t-md bg-slate-700 shadow-sm dark:bg-slate-300"
                              style={{ height: `${row.valuationHeight}px` }}
                              title={`${tDashboard("valuation")}: ${formatNumber(row.valuationCount, intlLocale)}`}
                            />
                            <div
                              className="w-4 rounded-t-md bg-teal-400 shadow-sm"
                              style={{ height: `${row.indicativeHeight}px` }}
                              title={`${tDashboard("indicativeValuation")}: ${formatNumber(row.indicativeCount, intlLocale)}`}
                            />
                          </div>
                          <div className="text-center">
                            <span className="block text-xs font-medium text-foreground">{row.label}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatNumber(row.totalCount, intlLocale)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{tDashboard("valuationSnapshotTitle")}</CardTitle>
              <CardDescription>{tDashboard("valuationSnapshotDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                <p className="text-xs text-muted-foreground">{tDashboard("totalMarketValue")}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {formatCurrency(totalMarketValue, intlLocale)}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">{tDashboard("totalLandValue")}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatCurrency(toNumber(valuationOverview?.totalLandValue), intlLocale, true)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">{tDashboard("totalBuildingValue")}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatCurrency(toNumber(valuationOverview?.totalBuildingValue), intlLocale, true)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-4 xl:grid-cols-12 ">
              <Card className="xl:col-span-8 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {tAnalytics("propertyDistributionByProvinceTitle")}
                  </CardTitle>
                  <CardDescription>{tAnalytics("propertyDistributionByProvinceDescription")}</CardDescription>
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
                          <Tooltip content={<CustomTooltip detailsLabel={tCommon("details")} locale={intlLocale} />} />
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
                  <CardTitle>{tAnalytics("topRegionsTitle")}</CardTitle>
                  <CardDescription>{tAnalytics("topRegionsDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(isLoadingProperty ? [] : topRegionRows).map(
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
                  {isLoadingProperty && (
                    <div className="space-y-2">
                      <Skeleton className="h-9 w-full rounded-lg" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

        
      </div>
    </PermissionGuard>
  );
}
