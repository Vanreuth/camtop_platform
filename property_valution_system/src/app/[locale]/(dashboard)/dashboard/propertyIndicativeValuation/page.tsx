"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import { DataTable } from "@/components/DataTable/DataTable";
import type { ApiParams, DataTableConfig, FilterConfig } from "@/components/DataTable/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  useCommunesByDistrictCode,
  useDistrictsByProvinceCode,
  useProvinces,
  useVillagesByCommuneCode,
} from "@/hooks/propertyAddress/usePropertyAddress";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { useUsers } from "@/hooks/user/useUser";
import { useAddressLocale } from "@/hooks/useAddressLocale";
import { PREPARED_FOR_OPTIONS } from "@/constants/preparedForOptions";
import {
  useArchiveIndicativeValuation,
  useApproveIndicativeValuation,
  useExportIndicativeValuationsExcel,
  useExportIndicativeValuationPdf,
  useIndicativeValuations,
  useReassignIndicativeValuation,
  useRejectIndicativeValuation,
  useSubmitIndicativeValuation,
} from "@/hooks/indicativeValuation/useIndicativeValuation";
import type { IndicativeValuation } from "@/hooks/indicativeValuation/indicativeValuation.types";
import { cn } from "@/lib/utils";
import {
  Archive,
  ArrowRightLeft,
  BadgeAlert,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  Eye,
  Factory,
  FileText,
  HelpCircle,
  Home,
  LandPlot,
  Leaf,
  Loader2,
  LucideIcon,
  MapPin,
  MoreHorizontal,
  Plus,
  Send,
  Store,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatMoney = (value?: number | string | null, currency = "USD") => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "-";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `$${numeric.toLocaleString()}`;
  }
};

const formatRange = (row: IndicativeValuation) => {
  const min = formatMoney(row.minMarketValue, row.currency ?? "USD");
  const max = formatMoney(row.maxMarketValue, row.currency ?? "USD");
  if (min === "-" && max === "-") return "-";
  return `${min} - ${max}`;
};

const getReferenceLabel = (row?: IndicativeValuation | null) => {
  if (!row) return "-";

  const ref = row.indicationNo || row.valuationNo || row.valuationId;

  return ref ? `#${ref}` : "-";
};
const buildUserLabel = (valuation: IndicativeValuation) => {
  const firstName = valuation.valuer?.firstName ?? "";
  const lastName = valuation.valuer?.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || valuation.valuer?.username || "N/A";
};

const UserAvatar = ({ valuation }: { valuation: IndicativeValuation }) => {
  const firstName = valuation.valuer?.firstName ?? "";
  const lastName = valuation.valuer?.lastName ?? "";
  const username = valuation.valuer?.username ?? "NA";
  const initials =
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : username.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-3 group min-w-[160px]">
      <Avatar className="h-9 w-9 border border-border bg-background transition-shadow group-hover:shadow-sm">
        <AvatarImage
          src={valuation.valuer?.profilePicture || valuation.valuer?.profileImage || undefined}
          alt={buildUserLabel(valuation)}
          className="object-cover"
        />
        <AvatarFallback className="text-[10px] font-bold text-muted-foreground bg-muted">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <span className="truncate text-sm font-medium text-foreground">
          {buildUserLabel(valuation)}
        </span>
        {valuation.valuer?.username ? (
          <span className="truncate text-[11px] text-muted-foreground">
            @{valuation.valuer.username}
          </span>
        ) : null}
      </div>
    </div>
  );
};

type BadgeVariant =
  | "default"
  | "secondary"
  | "info"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

type PropertyTypeConfig = {
  variant: BadgeVariant;
  icon: LucideIcon;
};

const PROPERTY_TYPE_CONFIG: Record<string, PropertyTypeConfig> = {
  "Vacant Land": { variant: "warning", icon: LandPlot },
  "Agricultural Land": { variant: "success", icon: Leaf },
  "Agricultural Property": { variant: "success", icon: Leaf },
  "Commercial Building": { variant: "info", icon: Store },
  "Commercial Property": { variant: "info", icon: Store },
  "Industrial Property": { variant: "warning", icon: Factory },
  "Residential Building": { variant: "secondary", icon: Building2 },
  "Residential Property": { variant: "secondary", icon: Home },
  "Specialized Property": { variant: "destructive", icon: BadgeAlert },
};

const getPropertyTypeBadgeConfig = (typeName: string): PropertyTypeConfig => {
  return PROPERTY_TYPE_CONFIG[typeName] ?? { variant: "outline", icon: HelpCircle };
};

const PropertyTypeBadge = ({ typeName }: { typeName: string }) => {
  const { variant, icon: Icon } = getPropertyTypeBadgeConfig(typeName);

  const styles: Record<BadgeVariant, string> = {
    default: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-slate-100 text-slate-700 border-slate-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    destructive: "bg-red-50 text-red-700 border-red-200",
    outline: "bg-background text-foreground border-border",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md border px-2 text-[10px] font-medium shadow-sm",
        styles[variant],
      )}
      title={typeName}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="leading-none">{typeName}</span>
    </Badge>
  );
};

const WorkflowStatusBadge = ({ status }: { status?: string | null }) => {
  const t = useTranslations("indicativeValuation.statusLabels");
  const config: Record<string, { className: string; icon: LucideIcon; label: string }> = {
    DRAFT: {
      className: "bg-slate-100 text-slate-600 border-slate-200",
      icon: FileText,
      label: t("DRAFT"),
    },
    PENDING_REVIEW: {
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
      label: t("PENDING_REVIEW"),
    },
    APPROVED: {
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
      label: t("APPROVED"),
    },
    REJECTED: {
      className: "bg-red-50 text-red-700 border-red-200",
      icon: XCircle,
      label: t("REJECTED"),
    },
    ARCHIVED: {
      className: "bg-zinc-50 text-zinc-500 border-zinc-200",
      icon: Archive,
      label: t("ARCHIVED"),
    },
  };

  const current = status ? config[status] : null;

  if (!current) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        N/A
      </Badge>
    );
  }

  const Icon = current.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border py-0.5 pl-1.5 pr-2.5 font-medium transition-colors",
        current.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {current.label}
    </Badge>
  );
};

const BusinessStatusBadge = ({ status }: { status?: string | null }) => {
  const t = useTranslations("indicativeValuation.businessStatus");
  const config: Record<string, { className: string; icon: LucideIcon; label: string }> = {
    ACTIVE: {
      className: "bg-green-50 text-green-700 border-green-200",
      icon: CheckCircle2,
      label: t("ACTIVE"),
    },
    SUPERSEDED: {
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Archive,
      label: t("SUPERSEDED"),
    },
    EXPIRED: {
      className: "bg-gray-50 text-gray-600 border-gray-200",
      icon: Clock,
      label: t("EXPIRED"),
    },
    CANCELLED: {
      className: "bg-red-50 text-red-700 border-red-200",
      icon: XCircle,
      label: t("CANCELLED"),
    },
  };

  const current = status ? config[status] : null;

  if (!current) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        N/A
      </Badge>
    );
  }

  const Icon = current.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border py-0.5 pl-1.5 pr-2.5 font-medium transition-colors",
        current.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {current.label}
    </Badge>
  );
};

export default function PropertyIndicativeValuationPage() {
  const t = useTranslations("indicativeValuation");
  const tp = useTranslations("properties");
  const router = useRouter();
  const { user, hasHierarchyLevel, hasPermission } = useAuth();

  const submitMutation = useSubmitIndicativeValuation();
  const approveMutation = useApproveIndicativeValuation();
  const rejectMutation = useRejectIndicativeValuation();
  const archiveMutation = useArchiveIndicativeValuation();
  const reassignMutation = useReassignIndicativeValuation();
  const exportExcelMutation = useExportIndicativeValuationsExcel();
  const exportPdfMutation = useExportIndicativeValuationPdf();

  const canManage = hasHierarchyLevel(3) || hasPermission("property:create");
  const canDownload = hasHierarchyLevel(2);
  const isHighLevel = hasHierarchyLevel(2);
  const isMidLevel = hasHierarchyLevel(3) && !hasHierarchyLevel(2);
  const defaultValuerScope: "OWN" | "ALL" = isHighLevel ? "ALL" : "OWN";
  const addressLocale = useAddressLocale();
  const propertyTypes = usePropertyTypes();

  const [selectedValuation, setSelectedValuation] = useState<IndicativeValuation | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [newValuerId, setNewValuerId] = useState("");
  const [valuerScope, setValuerScope] = useState<"OWN" | "ALL">(defaultValuerScope);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedCommuneId, setSelectedCommuneId] = useState<string | null>(null);
  const latestTableParamsRef = useRef<ApiParams | null>(null);

  const { data: provinces } = useProvinces();
  const { data: districts } = useDistrictsByProvinceCode(selectedProvinceId);
  const { data: communes } = useCommunesByDistrictCode(selectedDistrictId);
  const { data: villages } = useVillagesByCommuneCode(selectedCommuneId);

  const { data: userListResult } = useUsers(
    { page: 1, limit: 100, role: "VALUER" },
    { enabled: isHighLevel },
  );

  const propertyTypeOptions = useMemo(
    () =>
      [...propertyTypes]
        .sort((a, b) => (a.propertyTypeId ?? 0) - (b.propertyTypeId ?? 0))
        .map((type) => ({
          label: type.propertyName,
          value: String(type.propertyTypeId),
        })),
    [propertyTypes],
  );

  const provinceOptions = useMemo(
    () =>
      provinces?.map((province: any) => ({
        label: addressLocale.province(province),
        value: String(province.code),
      })) || [],
    [addressLocale, provinces],
  );

  const districtOptions = useMemo(
    () =>
      districts?.map((district: any) => ({
        label: addressLocale.district(district),
        value: String(district.code),
      })) || [],
    [addressLocale, districts],
  );

  const communeOptions = useMemo(
    () =>
      communes?.map((commune: any) => ({
        label: addressLocale.commune(commune),
        value: String(commune.code),
      })) || [],
    [addressLocale, communes],
  );

  const villageOptions = useMemo(
    () =>
      villages?.map((village: any) => ({
        label: addressLocale.village(village),
        value: String(village.code),
      })) || [],
    [addressLocale, villages],
  );

  const preparedForFilterOptions = useMemo(
    () => PREPARED_FOR_OPTIONS.map((option) => ({ label: option, value: option })),
    [],
  );

  const purposeOfValuationFilterOptions = useMemo(
    () => [
      { value: "MORTGAGE_LOAN", label: t("intendedUseOptions.MORTGAGE_LOAN") },
      { value: "SALE_PURCHASE", label: t("intendedUseOptions.SALE_PURCHASE") },
      { value: "INSURANCE", label: t("intendedUseOptions.INSURANCE") },
      { value: "FINANCIAL_REPORTING", label: t("intendedUseOptions.FINANCIAL_REPORTING") },
      { value: "INVESTMENT_ANALYSIS", label: t("intendedUseOptions.INVESTMENT_ANALYSIS") },
      { value: "TAXATION", label: t("intendedUseOptions.TAXATION") },
      { value: "COURT_DISPUTE", label: t("intendedUseOptions.COURT_DISPUTE") },
      { value: "OTHER", label: t("intendedUseOptions.OTHER") },
    ],
    [t],
  );

  const valuerOptions = useMemo(
    () =>
      (userListResult?.users ?? [])
        .filter((item) =>
          item.roles?.some((userRole) => {
            const roleCode = userRole.role?.roleCode?.toUpperCase?.() ?? "";
            const roleName = userRole.role?.roleName?.toUpperCase?.() ?? "";
            return roleCode === "VALUER" || roleName.includes("VALUER");
          }),
        )
        .map((item) => ({
          label: `${item.firstName} ${item.lastName} (${item.username})`,
          value: String(item.id),
        })),
    [userListResult],
  );

  const openDialog = useCallback(
    (
      type: "submit" | "approve" | "reject" | "archive" | "reassign",
      valuation: IndicativeValuation,
    ) => {
      setSelectedValuation(valuation);
      if (type === "submit") {
        setSubmitDialogOpen(true);
      }
      if (type === "archive") {
        setArchiveDialogOpen(true);
      }
      if (type === "approve") {
        setApprovalNotes("");
        setApproveDialogOpen(true);
      }
      if (type === "reject") {
        setRejectionReason("");
        setRejectDialogOpen(true);
      }
      if (type === "reassign") {
        setNewValuerId("");
        setReassignDialogOpen(true);
      }
    },
    [],
  );

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      const normalizedValue = value === "All" || value === "" ? null : value;

      if (key === "valuerScope") {
        if (value === "ALL" || value === "OWN") {
          setValuerScope(value);
        } else {
          setValuerScope(defaultValuerScope);
        }
        return;
      }

      if (key === "provinceId") {
        setSelectedProvinceId(normalizedValue);
        setSelectedDistrictId(null);
        setSelectedCommuneId(null);
        return;
      }

      if (key === "districtId") {
        setSelectedDistrictId(normalizedValue);
        setSelectedCommuneId(null);
        return;
      }

      if (key === "communeId") {
        setSelectedCommuneId(normalizedValue);
      }
    },
    [defaultValuerScope],
  );

  const handleView = useCallback(
    (valuation: IndicativeValuation) => {
      router.push(`/dashboard/propertyIndicativeValuation/${valuation.valuationId}`);
    },
    [router],
  );

  const handleEdit = useCallback(
    (valuation: IndicativeValuation) => {
      router.push(`/dashboard/propertyIndicativeValuation/${valuation.valuationId}/edit`);
    },
    [router],
  );

  const handleGetPdf = useCallback(
    async (valuation: IndicativeValuation) => {
      if (!canDownload) {
        toast.error(t("errors.downloadNotAllowed"));
        return;
      }

      setPdfLoadingId(valuation.valuationId);
      try {
        const document = await exportPdfMutation.mutateAsync({
          id: valuation.valuationId,
          refresh: false,
        });
        window.open(document.viewUrl ?? document.publicUrl, "_blank", "noopener,noreferrer");
        toast.success(t("messages.pdfReady"));
      } catch {
        // handled in hook
      } finally {
        setPdfLoadingId(null);
      }
    },
    [canDownload, exportPdfMutation, t],
  );

  const handleExportExcel = useCallback(async () => {
    if (!canDownload) {
      toast.error(t("errors.downloadNotAllowed"));
      return;
    }

    const exportParams = latestTableParamsRef.current
      ? Object.fromEntries(
          Object.entries(latestTableParamsRef.current).filter(
            ([key]) =>
              key !== "page" &&
              key !== "limit" &&
              key !== "sortBy" &&
              key !== "sortOrder",
          ),
        )
      : undefined;

    try {
      const { blob, fileName } = await exportExcelMutation.mutateAsync(exportParams);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName || "indicative-valuations-export.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t("messages.downloadReady"));
    } catch {
      // handled in hook
    }
  }, [canDownload, exportExcelMutation, t]);

  const handleTableParamsChange = useCallback((params: ApiParams) => {
    latestTableParamsRef.current = params;
  }, []);

  const handleSubmitConfirm = useCallback(() => {
    if (!selectedValuation) return;
    submitMutation.mutate(selectedValuation.valuationId, {
      onSuccess: () => {
        setSubmitDialogOpen(false);
        setSelectedValuation(null);
      },
    });
  }, [selectedValuation, submitMutation]);

  const handleApproveConfirm = useCallback(() => {
    if (!selectedValuation) return;
    approveMutation.mutate(
      {
        id: selectedValuation.valuationId,
        data: { notes: approvalNotes.trim() || undefined },
      },
      {
        onSuccess: () => {
          setApproveDialogOpen(false);
          setSelectedValuation(null);
        },
      },
    );
  }, [approvalNotes, approveMutation, selectedValuation]);

  const handleRejectConfirm = useCallback(() => {
    if (!selectedValuation || !rejectionReason.trim()) {
      toast.error(t("errors.rejectionReasonRequired"));
      return;
    }
    rejectMutation.mutate(
      {
        id: selectedValuation.valuationId,
        data: { rejectionReason: rejectionReason.trim() },
      },
      {
        onSuccess: () => {
          setRejectDialogOpen(false);
          setSelectedValuation(null);
        },
      },
    );
  }, [rejectMutation, rejectionReason, selectedValuation, t]);

  const handleArchiveConfirm = useCallback(() => {
    if (!selectedValuation) return;

    archiveMutation.mutate(selectedValuation.valuationId, {
      onSuccess: () => {
        setArchiveDialogOpen(false);
        setSelectedValuation(null);
      },
    });
  }, [archiveMutation, selectedValuation]);

  const handleReassignConfirm = useCallback(() => {
    if (!selectedValuation || !newValuerId) {
      toast.error(t("errors.valuerRequired"));
      return;
    }

    reassignMutation.mutate(
      {
        id: selectedValuation.valuationId,
        data: { newValuerId: Number(newValuerId) },
      },
      {
        onSuccess: () => {
          setReassignDialogOpen(false);
          setSelectedValuation(null);
        },
      },
    );
  }, [newValuerId, reassignMutation, selectedValuation, t]);

  const renderActions = useCallback(
    (valuation: IndicativeValuation) => {
      const workflowStatus = valuation.workflowStatus || "DRAFT";
      const isDraft = workflowStatus === "DRAFT";
      const isRejected = workflowStatus === "REJECTED";
      const isPendingReview = workflowStatus === "PENDING_REVIEW";
      const isApproved = workflowStatus === "APPROVED";
      const isArchived = workflowStatus === "ARCHIVED";
      const isActive = valuation.status === "ACTIVE";
      const isOwner = Number(valuation.valuerId) === Number(user?.id);
      const canSubmit = isDraft && (isOwner || isHighLevel);
      const canReview = isPendingReview && isHighLevel;
      const canEdit =
        (isDraft || isRejected || (isApproved && isActive)) && (isOwner || isHighLevel);
      const isLoadingPdf = pdfLoadingId === valuation.valuationId;

      return (
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              handleView(valuation);
            }}
            title={t("actions.view")}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">View</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 data-[state=open]:bg-muted/80 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-all duration-200 hover:scale-105 active:scale-95"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[200px] shadow-lg border-muted/50"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50" />
              {canEdit ? (
                <DropdownMenuItem
                  onClick={() => handleEdit(valuation)}
                  className="cursor-pointer transition-colors duration-150"
                >
                  <Edit className="mr-2 h-4 w-4 text-indigo-600/80" />
                  <span className="font-medium">{t("actions.edit")}</span>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => handleGetPdf(valuation)}
                disabled={!canDownload || isLoadingPdf}
                className="text-green-600/80 focus:text-green-600/80 focus:text-green-700/90 hover:bg-green-50/80 transition-colors duration-150 cursor-pointer"
              >
                {isLoadingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4 text-green-400/80" />
                )}
                <span className="font-medium">{t("actions.download")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canSubmit ? (
                <DropdownMenuItem
                  onClick={() => openDialog("submit", valuation)}
                  className="cursor-pointer transition-colors duration-150"
                >
                  <Send className="mr-2 h-4 w-4 text-blue-600/80" />
                  <span className="font-medium text-blue-600">{t("actions.submit")}</span>
                </DropdownMenuItem>
              ) : null}
              {canReview ? (
                <DropdownMenuItem
                  onClick={() => openDialog("approve", valuation)}
                  className="cursor-pointer focus:bg-indigo-50/50 dark:focus:bg-indigo-950/20 transition-all duration-150"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4 text-indigo-600" />
                  <span className="font-medium">{t("actions.approve")}</span>
                </DropdownMenuItem>
              ) : null}
              {canReview ? (
                <DropdownMenuItem
                  onClick={() => openDialog("reject", valuation)}
                  className="cursor-pointer focus:bg-red-50/50 dark:focus:bg-red-950/20 transition-all duration-150"
                >
                  <XCircle className="mr-2 h-4 w-4 text-red-600/90" />
                  <span className="font-medium">{t("actions.reject")}</span>
                </DropdownMenuItem>
              ) : null}
              {isHighLevel && !isArchived && !isApproved ? (
                <DropdownMenuItem
                  onClick={() => openDialog("reassign", valuation)}
                  className="cursor-pointer focus:bg-info-50/50 dark:focus:bg-info-950/20 transition-all duration-150"
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4 text-cyan-600/80" />
                  <span className="font-medium text-cyan-600">{t("actions.reassign")}</span>
                </DropdownMenuItem>
              ) : null}
              {isHighLevel && !isArchived ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => openDialog("archive", valuation)}
                    className="cursor-pointer transition-colors duration-150"
                  >
                    <Archive className="mr-2 h-4 w-4 text-amber-600/80" />
                    <span className="font-medium">{t("actions.archive")}</span>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    [
      canDownload,
      handleEdit,
      handleGetPdf,
      handleView,
      isHighLevel,
      openDialog,
      pdfLoadingId,
      t,
      user?.id,
    ],
  );

  const tableConfig = useMemo<DataTableConfig<IndicativeValuation>>(() => {
    const filters: FilterConfig[] = [
      {
        key: "workflowStatus",
        label: t("filters.workflowStatus"),
        type: "select",
        options: [
          { value: "DRAFT", label: t("statusLabels.DRAFT") },
          { value: "PENDING_REVIEW", label: t("statusLabels.PENDING_REVIEW") },
          { value: "APPROVED", label: t("statusLabels.APPROVED") },
          { value: "REJECTED", label: t("statusLabels.REJECTED") },
          { value: "ARCHIVED", label: t("statusLabels.ARCHIVED") },
        ],
      },
      {
        key: "status",
        label: t("filters.status"),
        type: "select",
        options: [
          { value: "ACTIVE", label: t("businessStatus.ACTIVE") },
          { value: "SUPERSEDED", label: t("businessStatus.SUPERSEDED") },
          { value: "EXPIRED", label: t("businessStatus.EXPIRED") },
          { value: "CANCELLED", label: t("businessStatus.CANCELLED") },
        ],
      },
      {
        key: "preparedFor",
        label: t("fields.preparedFor"),
        type: "select",
        options: preparedForFilterOptions,
      },
      {
        key: "purposeOfValuation",
        label: t("fields.purposeOfValuation"),
        type: "select",
        options: purposeOfValuationFilterOptions,
      },
      {
        key: "propertyTypeId",
        label: t("filters.propertyType"),
        type: "select",
        options: propertyTypeOptions,
      },
      {
        key: "minMarketValue",
        label: t("filters.minValuationRange"),
        type: "number",
        placeholder: t("filters.minValuationRangePlaceholder"),
      },
      {
        key: "maxMarketValue",
        label: t("filters.maxValuationRange"),
        type: "number",
        placeholder: t("filters.maxValuationRangePlaceholder"),
      },
      {
        key: "provinceId",
        label: t("filters.province"),
        type: "select",
        options: provinceOptions,
      },
      {
        key: "districtId",
        label: t("filters.district"),
        type: "select",
        options: districtOptions,
        dependsOn: "provinceId",
      },
      {
        key: "communeId",
        label: t("filters.commune"),
        type: "select",
        options: communeOptions,
        dependsOn: "districtId",
      },
      {
        key: "villageId",
        label: t("filters.village"),
        type: "select",
        options: villageOptions,
        dependsOn: "communeId",
      },
      {
        key: "dateRange",
        label: t("filters.createdDate"),
        type: "daterange",
      },
    ];

    const roleFilters: FilterConfig[] = [];

    if (isHighLevel || isMidLevel) {
      roleFilters.push({
        key: "valuerScope",
        label: t("filters.valuerScope"),
        type: "select",
        options: [
          { label: t("filters.scopeOwn"), value: "OWN" },
          { label: t("filters.scopeAll"), value: "ALL" },
        ],
        defaultValue: defaultValuerScope,
      });
    }

    if (isHighLevel) {
      roleFilters.push({
        key: "valuerId",
        label: t("filters.valuer"),
        type: "select",
        options: valuerOptions,
      });
    }

    if (roleFilters.length > 0) {
      filters.unshift(...roleFilters);
    }

    return {
      title: t("title"),
      description: t("description"),
      searchPlaceholder: t("searchPlaceholder"),
      defaultPageSize: 10,
      forcedParams:
        valuerScope === "OWN" && user?.id
          ? { valuerId: String(user.id) }
          : undefined,
      columns: [
        {
          key: "valuationNo",
          label: t("fields.indicationNo"),
          sortable: true,
          render: (_, row) => (
            <div className="flex flex-col gap-1 min-w-[130px]">
              <div className="flex gap-2">
                <span className="font-semibold text-sm tabular-nums text-foreground">
                  No: {getReferenceLabel(row)}
                </span>
              </div>
            </div>
          ),
        },
        {
          key: "property",
          label: t("columns.property"),
          render: (_, row) => (
            <div className="flex flex-col gap-2 max-w-[300px]">
              <div className="flex items-start gap-2 overflow-hidden">
                <div className="flex flex-col min-w-0">
                  <span
                    className="font-semibold text-sm truncate text-foreground"
                    title={row.property?.propertyName || "N/A"}
                  >
                    {row.property?.propertyName || "N/A"}
                  </span>
                  {row.property?.propertyType?.propertyName && (
                    <div className="mt-1">
                      <PropertyTypeBadge
                        typeName={row.property.propertyType.propertyName}
                      />
                    </div>
                  )}
                </div>
              </div>
              {row.property?.propertyAddress?.province && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1 truncate">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    {addressLocale.province(row.property.propertyAddress.province)}
                    {row.property.propertyAddress.district &&
                      `, ${addressLocale.district(row.property.propertyAddress.district)}`}
                  </span>
                </div>
              )}
            </div>
          ),
        },
        {
          key: "range",
          label: t("columns.range"),
          render: (_, row) => (
            <div className="min-w-[170px]">
              <div className="font-medium tracking-tight text-sm text-foreground">{formatRange(row)}</div>
            </div>
          ),
        },
        {
          key: "valuer",
          label: t("columns.valuer"),
          render: (_, row) => <UserAvatar valuation={row} />,
        },
        {
          key: "status",
          label: t("columns.status"),
          sortable: true,
          render: (_, row) => (
            <div className="flex min-w-[160px] flex-col gap-1">
              {row.workflowStatus ? <WorkflowStatusBadge status={row.workflowStatus} /> : null}
              <BusinessStatusBadge status={row.status} />
            </div>
          ),
        },
        {
          key: "createdAt",
          label: t("columns.createdAt"),
          sortable: true,
          render: (value) => (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDate(value as string)}
            </div>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (_, row) => renderActions(row),
        },
      ],
      filters,
    };
  }, [
    communeOptions,
    defaultValuerScope,
    districtOptions,
    isHighLevel,
    preparedForFilterOptions,
    purposeOfValuationFilterOptions,
    isMidLevel,
    propertyTypeOptions,
    provinceOptions,
    renderActions,
    t,
    tp,
    user?.id,
    valuerOptions,
    valuerScope,
    villageOptions,
  ]);

  return (
    <PermissionGuard
      maxHierarchyLevel={3}
      requiredPermissions={["property:read"]}
      requireAllPermissions
      redirectTo="/dashboard"
    >
      <div className="space-y-4 p-2">
        <DataTable<IndicativeValuation>
          key={user?.id ? `user-${user.id}` : "guest"}
          config={tableConfig}
          useDataHook={useIndicativeValuations}
          onRowClick={handleView}
          onFilterChange={handleFilterChange}
          onParamsChange={handleTableParamsChange}
          headerActions={
            <div className="flex flex-wrap items-center gap-2">
              {canDownload ? (
                <Button
                  variant="outline"
                  className="shadow-sm"
                  onClick={() => void handleExportExcel()}
                  disabled={exportExcelMutation.isPending}
                >
                  {exportExcelMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {t("actions.exportExcel")}
                </Button>
              ) : null}
              {canManage ? (
                <Button
                  className="shadow-sm"
                  onClick={() => router.push("/dashboard/propertyIndicativeValuation/add")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addValuation")}
                </Button>
              ) : null}
            </div>
          }
        />

        <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("dialogs.submitTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("dialogs.submitDescription", {
                  reference: getReferenceLabel(selectedValuation),
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmitConfirm}>
                {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("actions.submit")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("dialogs.archiveTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("dialogs.archiveDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchiveConfirm}>
                {archiveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("actions.archive")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialogs.approveTitle")}</DialogTitle>
              <DialogDescription>
                {t("dialogs.approveDescription", {
                  reference: getReferenceLabel(selectedValuation),
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="approvalNotes">{t("approvalNotes")}</Label>
              <Input
                id="approvalNotes"
                value={approvalNotes}
                onChange={(event) => setApprovalNotes(event.target.value)}
                placeholder={t("approvalNotesPlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleApproveConfirm} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("actions.approve")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialogs.rejectTitle")}</DialogTitle>
              <DialogDescription>
                {t("dialogs.rejectDescription", {
                  reference: getReferenceLabel(selectedValuation),
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">{t("rejectionReason")}</Label>
              <Input
                id="rejectionReason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder={t("rejectionReasonPlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleRejectConfirm} disabled={rejectMutation.isPending}>
                {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("actions.reject")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialogs.reassignTitle")}</DialogTitle>
              <DialogDescription>{t("dialogs.reassignDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="newValuerId">{t("fields.newValuer")}</Label>
              <Select
                value={newValuerId}
                onValueChange={setNewValuerId}
              >
                <SelectTrigger id="newValuerId" className="h-11">
                  <SelectValue placeholder={t("placeholders.selectValuer")} />
                </SelectTrigger>
                <SelectContent>
                  {valuerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleReassignConfirm} disabled={reassignMutation.isPending}>
                {reassignMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("actions.reassign")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
