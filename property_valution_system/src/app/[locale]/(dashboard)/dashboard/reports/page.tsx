"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/auth/useAuth";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BadgeDollarSign,
  Building2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDownloadReport, useGenerateReport, useReports } from "@/hooks/report/useReport";
import type {
  GeneratedReport,
  ReportFormat,
  ReportTarget,
  SupportedReportTarget,
} from "@/hooks/report/report.types";
import { cn } from "@/lib/utils";

type GeneratorState = {
  reportTarget: SupportedReportTarget;
  format: ReportFormat;
  reportName: string;
  description: string;
  search: string;
  status: string;
  workflowStatus: string;
  role: string;
};

type TargetOption = {
  value: SupportedReportTarget;
  icon: LucideIcon;
  title: string;
  description: string;
  hint: string;
};

const triggerBrowserDownload = (url: string) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const buildInitialGeneratorState = (
  target: SupportedReportTarget,
): GeneratorState => ({
  reportTarget: target,
  format: "XLSX",
  reportName: "",
  description: "",
  search: "",
  status: "All",
  workflowStatus: "All",
  role: "",
});

export default function ReportsPage() {
  const t = useTranslations("reportsPage");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const {
    hasHierarchyLevel,
    hasAnyPermission,
  } = useAuth();

  const canAccessPropertyReports =
    hasHierarchyLevel(3) || hasAnyPermission(["property:read", "dashboard:read"]);
  const canAccessUserReports =
    hasHierarchyLevel(2) || hasAnyPermission(["user:read", "user:manage"]);
  const canViewAllReports = hasHierarchyLevel(2);

  const availableTargets = useMemo<SupportedReportTarget[]>(() => {
    const targets: SupportedReportTarget[] = [];

    if (canAccessUserReports) {
      targets.push("USER");
    }

    if (canAccessPropertyReports) {
      targets.push("PROPERTY", "PROPERTY_VALUATION", "INDICATIVE_VALUATION");
    }

    return targets;
  }, [canAccessPropertyReports, canAccessUserReports]);

  const [generator, setGenerator] = useState<GeneratorState>(() =>
    buildInitialGeneratorState("PROPERTY"),
  );
  const [listSearch, setListSearch] = useState("");
  const [listTarget, setListTarget] = useState<ReportTarget | "All">("All");
  const [listFormat, setListFormat] = useState<ReportFormat | "All">("All");
  const [listScope, setListScope] = useState<"All" | "Mine">("All");
  const [downloadingReportId, setDownloadingReportId] = useState<number | null>(null);

  useEffect(() => {
    if (!availableTargets.length) {
      return;
    }

    if (!availableTargets.includes(generator.reportTarget)) {
      setGenerator(buildInitialGeneratorState(availableTargets[0]));
    }
  }, [availableTargets, generator.reportTarget]);

  const deferredListSearch = useDeferredValue(listSearch);

  const reportsQuery = useReports({
    page: 1,
    limit: 12,
    search: deferredListSearch || undefined,
    reportTarget: listTarget !== "All" ? listTarget : undefined,
    format: listFormat !== "All" ? listFormat : undefined,
    generatedByMe: !canViewAllReports || listScope === "Mine",
  });
  const generateReportMutation = useGenerateReport();
  const downloadReportMutation = useDownloadReport();

  const targetOptions = useMemo<TargetOption[]>(
    () => [
      {
        value: "USER",
        icon: Users,
        title: t("targets.USER.title"),
        description: t("targets.USER.description"),
        hint: t("targets.USER.hint"),
      },
      {
        value: "PROPERTY",
        icon: Building2,
        title: t("targets.PROPERTY.title"),
        description: t("targets.PROPERTY.description"),
        hint: t("targets.PROPERTY.hint"),
      },
      {
        value: "PROPERTY_VALUATION",
        icon: BadgeDollarSign,
        title: t("targets.PROPERTY_VALUATION.title"),
        description: t("targets.PROPERTY_VALUATION.description"),
        hint: t("targets.PROPERTY_VALUATION.hint"),
      },
      {
        value: "INDICATIVE_VALUATION",
        icon: Sparkles,
        title: t("targets.INDICATIVE_VALUATION.title"),
        description: t("targets.INDICATIVE_VALUATION.description"),
        hint: t("targets.INDICATIVE_VALUATION.hint"),
      },
    ],
    [t],
  );

  const visibleTargetOptions = targetOptions.filter((option) =>
    availableTargets.includes(option.value),
  );

  const selectedTarget = targetOptions.find(
    (option) => option.value === generator.reportTarget,
  );

  const statusOptions = useMemo(() => {
    switch (generator.reportTarget) {
      case "USER":
        return [
          { value: "All", label: tCommon("all") },
          { value: "PENDING", label: t("statuses.pending") },
          { value: "ACTIVE", label: t("statuses.active") },
          { value: "SUSPENDED", label: t("statuses.suspended") },
          { value: "DISABLED", label: t("statuses.disabled") },
        ];
      case "PROPERTY":
        return [
          { value: "All", label: tCommon("all") },
          { value: "ACTIVE", label: t("statuses.active") },
          { value: "INACTIVE", label: t("statuses.inactive") },
          { value: "SOLD", label: t("statuses.sold") },
          { value: "RENTED", label: t("statuses.rented") },
          { value: "RENTAL_SALE", label: t("statuses.rentalSale") },
        ];
      default:
        return [
          { value: "All", label: tCommon("all") },
          { value: "ACTIVE", label: t("statuses.active") },
          { value: "SUPERSEDED", label: t("statuses.superseded") },
          { value: "EXPIRED", label: t("statuses.expired") },
          { value: "CANCELLED", label: t("statuses.cancelled") },
        ];
    }
  }, [generator.reportTarget, t, tCommon]);

  const workflowStatusOptions = useMemo(
    () => [
      { value: "All", label: tCommon("all") },
      { value: "DRAFT", label: t("workflow.draft") },
      { value: "PENDING_REVIEW", label: t("workflow.pendingReview") },
      { value: "APPROVED", label: t("workflow.approved") },
      { value: "REJECTED", label: t("workflow.rejected") },
      { value: "ARCHIVED", label: t("workflow.archived") },
    ],
    [t, tCommon],
  );

  const formatOptions = useMemo(
    () => [
      { value: "XLSX" as const, label: t("formats.XLSX") },
      { value: "PDF" as const, label: t("formats.PDF") },
    ],
    [t],
  );

  const reports = reportsQuery.data?.reports ?? [];
  const summary = reportsQuery.data?.summary;

  const overviewCards = useMemo(
    () => [
      {
        title: t("overview.totalReports"),
        value: String(summary?.totalReports ?? 0),
        description: t("overview.totalReportsHint"),
      },
      {
        title: t("overview.myReports"),
        value: String(summary?.myReports ?? 0),
        description: t("overview.myReportsHint"),
      },
      {
        title: t("overview.latestGenerated"),
        value: summary?.latestGeneratedAt
          ? formatDateTime(summary.latestGeneratedAt)
          : t("overview.noReports"),
        description: t("overview.latestGeneratedHint"),
      },
    ],
    [summary, t],
  );

  const handleGenerate = async () => {
    const filters: Record<string, unknown> = {
      search: generator.search.trim() || undefined,
      status: generator.status !== "All" ? generator.status : undefined,
    };

    if (generator.reportTarget === "USER") {
      filters.role = generator.role.trim() || undefined;
    } else {
      filters.workflowStatus =
        generator.workflowStatus !== "All" ? generator.workflowStatus : undefined;
    }

    try {
      const response = await generateReportMutation.mutateAsync({
        reportTarget: generator.reportTarget,
        format: generator.format,
        reportName: generator.reportName.trim() || undefined,
        description: generator.description.trim() || undefined,
        filters,
      });

      startTransition(() => {
        setListTarget(generator.reportTarget);
        setListFormat(generator.format);
        setListScope("Mine");
      });

      triggerBrowserDownload(response.downloadUrl);
    } catch {
      // Mutation toast already surfaces the API error.
    }
  };

  const handleDownload = async (report: GeneratedReport) => {
    setDownloadingReportId(report.reportId);
    try {
      const response = await downloadReportMutation.mutateAsync(report.reportId);
      triggerBrowserDownload(response.downloadUrl);
    } catch {
      // Mutation toast already surfaces the API error.
    } finally {
      setDownloadingReportId(null);
    }
  };

  return (
    <PermissionGuard
      maxHierarchyLevel={3}
      requiredPermissions={["property:read", "dashboard:read", "user:read", "user:manage"]}
      requireAllPermissions={false}
      redirectTo="/dashboard"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{tNav("reports")}</h1>
            <p className="text-muted-foreground">{t("description")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => reportsQuery.refetch()}
            disabled={reportsQuery.isFetching}
          >
            {reportsQuery.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {tCommon("refresh")}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {overviewCards.map((card) => (
            <Card key={card.title} className="border-border/60">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

           <Card>
            <CardHeader>
              <CardTitle>{t("recentTitle")}</CardTitle>
              <CardDescription>{t("recentDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_180px_160px_160px]">
                <div className="relative">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    className="pl-9"
                    value={listSearch}
                    placeholder={t("listSearchPlaceholder")}
                    onChange={(event) => setListSearch(event.target.value)}
                  />
                </div>

                <Select
                  value={listTarget}
                  onValueChange={(value) => setListTarget(value as ReportTarget | "All")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">{tCommon("all")}</SelectItem>
                    {visibleTargetOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={listFormat}
                  onValueChange={(value) => setListFormat(value as ReportFormat | "All")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">{tCommon("all")}</SelectItem>
                    {formatOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={canViewAllReports ? listScope : "Mine"}
                  onValueChange={(value) => setListScope(value as "All" | "Mine")}
                  disabled={!canViewAllReports}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canViewAllReports && (
                      <SelectItem value="All">{t("scope.all")}</SelectItem>
                    )}
                    <SelectItem value="Mine">{t("scope.mine")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.reportName")}</TableHead>
                      <TableHead>{t("table.reportTarget")}</TableHead>
                      <TableHead>{t("table.reportFormat")}</TableHead>
                      <TableHead>{t("table.generatedBy")}</TableHead>
                      <TableHead>{t("table.generatedAt")}</TableHead>
                      <TableHead>{t("table.description")}</TableHead>
                      <TableHead className="text-right">{tCommon("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportsQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          {tCommon("loading")}
                        </TableCell>
                      </TableRow>
                    ) : reports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center">
                          <div className="space-y-1">
                            <p className="font-medium">{t("emptyTitle")}</p>
                            <p className="text-sm text-muted-foreground">
                              {t("emptyDescription")}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reports.map((report) => (
                        <TableRow key={report.reportId}>
                          <TableCell className="max-w-[240px]">
                            <div className="space-y-1">
                              <p className="truncate font-medium" title={report.reportName}>
                                {report.reportName}
                              </p>
                              <p
                                className="truncate text-xs text-muted-foreground"
                                title={report.summary ?? ""}
                              >
                                {report.summary || t("noSummary")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {t(`targets.${report.reportTarget}.title`)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{t(`formats.${report.format}`)}</Badge>
                          </TableCell>
                          <TableCell>
                            {report.generatedByUser?.username ?? t("unknownUser")}
                          </TableCell>
                          <TableCell>{formatDateTime(report.generatedAt)}</TableCell>
                          <TableCell className="max-w-[220px]">
                            <span
                              className={cn(
                                "block truncate text-sm text-muted-foreground",
                                !report.description && "italic",
                              )}
                              title={report.description ?? ""}
                            >
                              {report.description || t("noDescription")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(report)}
                              disabled={downloadingReportId === report.reportId}
                            >
                              {downloadingReportId === report.reportId ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="mr-2 h-4 w-4" />
                              )}
                              {tCommon("download")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        <div className="grid gap-6 xl:grid-cols">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("generateTitle")}
              </CardTitle>
              <CardDescription>{t("generateDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <Label>{t("reportTarget")}</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {visibleTargetOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = generator.reportTarget === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setGenerator((prev) => ({
                            ...buildInitialGeneratorState(option.value),
                            reportName: prev.reportName,
                            description: prev.description,
                          }))
                        }
                        className={cn(
                          "rounded-xl border p-4 text-left transition-all",
                          "hover:border-primary/60 hover:bg-primary/5",
                          isSelected && "border-primary bg-primary/10 shadow-sm",
                        )}
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg border",
                              isSelected
                                ? "border-primary/30 bg-background text-primary"
                                : "border-border/60 bg-muted/40 text-muted-foreground",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{option.title}</p>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{option.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reportFormat">{t("reportFormat")}</Label>
                  <Select
                    value={generator.format}
                    onValueChange={(value) =>
                      setGenerator((prev) => ({
                        ...prev,
                        format: value as ReportFormat,
                      }))
                    }
                  >
                    <SelectTrigger id="reportFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formatOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reportName">{t("reportName")}</Label>
                  <Input
                    id="reportName"
                    value={generator.reportName}
                    placeholder={t("reportNamePlaceholder")}
                    onChange={(event) =>
                      setGenerator((prev) => ({
                        ...prev,
                        reportName: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportDescription">{t("reportDescription")}</Label>
                <Textarea
                  id="reportDescription"
                  value={generator.description}
                  placeholder={t("reportDescriptionPlaceholder")}
                  onChange={(event) =>
                    setGenerator((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="searchFilter">{t("searchLabel")}</Label>
                <div className="relative">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="searchFilter"
                    className="pl-9"
                    value={generator.search}
                    placeholder={t("searchPlaceholder")}
                    onChange={(event) =>
                      setGenerator((prev) => ({
                        ...prev,
                        search: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="statusFilter">{t("statusLabel")}</Label>
                  <Select
                    value={generator.status}
                    onValueChange={(value) =>
                      setGenerator((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger id="statusFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {generator.reportTarget === "USER" ? (
                  <div className="space-y-2">
                    <Label htmlFor="roleFilter">{t("roleLabel")}</Label>
                    <Input
                      id="roleFilter"
                      value={generator.role}
                      placeholder={t("rolePlaceholder")}
                      onChange={(event) =>
                        setGenerator((prev) => ({
                          ...prev,
                          role: event.target.value,
                        }))
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="workflowStatus">{t("workflowStatus")}</Label>
                    <Select
                      value={generator.workflowStatus}
                      onValueChange={(value) =>
                        setGenerator((prev) => ({
                          ...prev,
                          workflowStatus: value,
                        }))
                      }
                    >
                      <SelectTrigger id="workflowStatus">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {workflowStatusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-dashed bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border bg-background p-2">
                    {generator.format === "PDF" ? (
                      <FileText className="h-4 w-4 text-primary" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {selectedTarget?.title ?? t("generateTitle")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTarget?.hint ?? t("supportedHint")}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={handleGenerate}
                disabled={generateReportMutation.isPending}
              >
                {generateReportMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : generator.format === "PDF" ? (
                  <FileText className="mr-2 h-4 w-4" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                {generateReportMutation.isPending ? t("generating") : t("generateButton")}
              </Button>
            </CardContent>
          </Card>

       
        </div>
      </div>
    </PermissionGuard>
  );
}
