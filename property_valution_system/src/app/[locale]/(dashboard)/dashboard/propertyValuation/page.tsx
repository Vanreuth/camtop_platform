"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import { DataTable } from "@/components/DataTable/DataTable";
import type {
  ApiParams,
  DataTableConfig,
  FilterConfig,
} from "@/components/DataTable/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  useApprovePropertyValuation,
  useDeletePropertyValuation,
  useDownloadValuationDocument,
  usePropertyValuations,
  useRejectPropertyValuation,
  useSubmitPropertyValuation,
  useReassignPropertyValuation,
  useExportPropertyValuationsExcel,
  useImportPropertyValuationsExcel,
} from "@/hooks/propertyValuation/usePropertyValuation";
import type {
  PropertyValuation,
  ValuationStatus,
  WorkflowStatus,
} from "@/hooks/propertyValuation/propertyValuation.types";
import {
  Archive,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Download,
  Upload,
  Edit,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  Send,
  XCircle,
  Building2,
  MapPin,
  LucideIcon,
  LandPlot,
  Leaf,
  Store,
  Factory,
  BadgeAlert,
  Home,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useProvinces,
  useDistrictsByProvinceCode,
  useCommunesByDistrictCode,
  useVillagesByCommuneCode,
} from "@/hooks/propertyAddress/usePropertyAddress";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { useUsers } from "@/hooks/user/useUser";
import { useAddressLocale } from "@/hooks/useAddressLocale";
import { PREPARED_FOR_OPTIONS } from "@/constants/preparedForOptions";

// --- Helper Components ---

// Valuation Status Badge (business state: ACTIVE, SUPERSEDED, EXPIRED, CANCELLED)
const ValuationStatusBadge = ({
  status,
}: {
  status?: ValuationStatus | null;
}) => {
  const config: Record<
    string,
    { className: string; icon: any; label: string }
  > = {
    ACTIVE: {
      className: "bg-green-50 text-green-700 border-green-200",
      icon: CheckCircle2,
      label: "Active",
    },
    SUPERSEDED: {
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Archive,
      label: "Superseded",
    },
    EXPIRED: {
      className: "bg-gray-50 text-gray-600 border-gray-200",
      icon: Clock,
      label: "Expired",
    },
    CANCELLED: {
      className: "bg-red-50 text-red-700 border-red-200",
      icon: XCircle,
      label: "Cancelled",
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
        "gap-1.5 pl-1.5 pr-2.5 py-0.5 font-medium border rounded-full transition-colors",
        current.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {current.label}
    </Badge>
  );
};

// Workflow Status Badge (workflow state: DRAFT, PENDING_REVIEW, APPROVED, REJECTED, ARCHIVED)
const WorkflowStatusBadge = ({
  status,
}: {
  status?: WorkflowStatus | null;
}) => {
  const t = useTranslations("propertyValuation.statusLabels");

  const config: Record<
    string,
    { className: string; icon: any; label: string }
  > = {
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
        "gap-1.5 pl-1.5 pr-2.5 py-0.5 font-medium border rounded-full transition-colors",
        current.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {current.label}
    </Badge>
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
  return (
    PROPERTY_TYPE_CONFIG[typeName] ?? { variant: "outline", icon: HelpCircle }
  );
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
        "text-[10px] h-5 px-2 font-medium rounded-md border shadow-sm inline-flex items-center gap-1",
        styles[variant],
      )}
      title={typeName}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="leading-none">{typeName}</span>
    </Badge>
  );
};

const UserAvatar = ({ user }: { user?: PropertyValuation["valuer"] }) => {
  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const username = user?.username ?? "Unknown";
  const fullName =
    firstName || lastName ? `${firstName} ${lastName}`.trim() : username;
  const initials =
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : username.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-3 group">
      <Avatar className="h-9 w-9 border border-border bg-background transition-shadow group-hover:shadow-sm">
        <AvatarImage
          src={user?.profilePicture || undefined}
          alt={fullName}
          className="object-cover"
        />
        <AvatarFallback className="text-[10px] font-bold text-muted-foreground bg-muted">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col max-w-[140px]">
        <span
          className="text-sm font-medium leading-none truncate text-foreground"
          title={fullName}
        >
          {fullName}
        </span>
        {user?.username && (
          <span className="text-[11px] text-muted-foreground truncate">
            @{user.username}
          </span>
        )}
      </div>
    </div>
  );
};

// --- Formatters ---

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatMoney = (
  value?: number | string | null,
  currency?: string | null,
) => {
  if (value === null || value === undefined) return "-";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "-";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `$${numeric.toLocaleString()}`;
  }
};

// --- Main Component ---

export default function PropertyValuationPage() {
  const t = useTranslations("propertyValuation");
  const router = useRouter();
  const { hasHierarchyLevel, hasPermission, user } = useAuth();
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(
    null,
  );
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(
    null,
  );
  const [selectedCommuneId, setSelectedCommuneId] = useState<string | null>(
    null,
  );

  // Mutations
  const submitMutation = useSubmitPropertyValuation();
  const approveMutation = useApprovePropertyValuation();
  const rejectMutation = useRejectPropertyValuation();
  const archiveMutation = useDeletePropertyValuation();
  const downloadMutation = useDownloadValuationDocument();
  const reassignMutation = useReassignPropertyValuation();
  const exportExcelMutation = useExportPropertyValuationsExcel();
  const importExcelMutation = useImportPropertyValuationsExcel();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const latestTableParamsRef = useRef<ApiParams | null>(null);

  // Dialog States
  const [selectedValuation, setSelectedValuation] =
    useState<PropertyValuation | null>(null);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);

  // Form States
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [newValuerId, setNewValuerId] = useState("");

  // Permissions & Hierarchy
  const canDownload = hasHierarchyLevel(2);
  const canManage = hasHierarchyLevel(3) || hasPermission("property:create");
  const canSeeImportExport = hasHierarchyLevel(3);
  const canExportExcel = canSeeImportExport;
  const canImportExcel = canSeeImportExport;

  // --- Hierarchy Level Logic ---
  const isHighLevel = hasHierarchyLevel(2); // Level 1 (Admin) & 2 (Manager)
  const isMidLevel = hasHierarchyLevel(3) && !hasHierarchyLevel(2); // Level 3 (Valuer)
  const defaultValuerScope: "OWN" | "ALL" = isHighLevel ? "ALL" : "OWN";
  const [valuerScope, setValuerScope] =
    useState<"OWN" | "ALL">(defaultValuerScope);

  // --- 1. Load Filter Data ---
  const propertyTypes = usePropertyTypes();
  const { data: provinces } = useProvinces();
  const { data: districts } = useDistrictsByProvinceCode(selectedProvinceId);
  const { data: communes } = useCommunesByDistrictCode(selectedDistrictId);
  const { data: villages } = useVillagesByCommuneCode(selectedCommuneId);
  const addressLocale = useAddressLocale();

  // Memoize Options
  const propertyTypeOptions = useMemo(
    () =>
      propertyTypes.map((pt: any) => ({
        label: pt.propertyName,
        value: String(pt.propertyTypeId), // Ensure value is string
      })),
    [propertyTypes],
  );

  const provinceOptions = useMemo(
    () =>
      provinces?.map((p: any) => ({
        label: addressLocale.province(p),
        value: String(p.code),
      })) || [],
    [provinces, addressLocale],
  );

  const districtOptions = useMemo(
    () =>
      districts?.map((d: any) => ({
        label: addressLocale.district(d),
        value: String(d.code),
      })) || [],
    [districts, addressLocale],
  );

  const communeOptions = useMemo(
    () =>
      communes?.map((c: any) => ({
        label: addressLocale.commune(c),
        value: String(c.code),
      })) || [],
    [communes, addressLocale],
  );

  const villageOptions = useMemo(
    () =>
      villages?.map((v: any) => ({
        label: addressLocale.village(v),
        value: String(v.code),
      })) || [],
    [villages, addressLocale],
  );

  const preparedForFilterOptions = useMemo(
    () => PREPARED_FOR_OPTIONS.map((option) => ({ label: option, value: option })),
    [],
  );

  const purposeOfValuationFilterOptions = useMemo(
    () => [
      { value: "MORTGAGE_LOAN", label: t("purposeOfValuationOptions.MORTGAGE_LOAN") },
      { value: "SALE_PURCHASE", label: t("purposeOfValuationOptions.SALE_PURCHASE") },
      { value: "INSURANCE", label: t("purposeOfValuationOptions.INSURANCE") },
      { value: "FINANCIAL_REPORTING", label: t("purposeOfValuationOptions.FINANCIAL_REPORTING") },
      { value: "INVESTMENT_ANALYSIS", label: t("purposeOfValuationOptions.INVESTMENT_ANALYSIS") },
      { value: "TAXATION", label: t("purposeOfValuationOptions.TAXATION") },
      { value: "COURT_DISPUTE", label: t("purposeOfValuationOptions.COURT_DISPUTE") },
      { value: "OTHER", label: t("purposeOfValuationOptions.OTHER") },
    ],
    [t],
  );

  const { data: userListResult } = useUsers(
    { page: 1, limit: 100, role: "VALUER" },
    { enabled: isHighLevel },
  );

  const valuerOptions = useMemo(() => {
    const users = userListResult?.users ?? [];
    return users
      .filter((u) =>
        u.roles?.some((userRole) => {
          const roleCode = userRole.role?.roleCode?.toUpperCase?.() ?? "";
          const roleName = userRole.role?.roleName?.toUpperCase?.() ?? "";
          return roleCode === "VALUER" || roleName.includes("VALUER");
        }),
      )
      .map((u) => ({
        label: `${u.firstName} ${u.lastName} (${u.username})`,
        value: String(u.id),
      }));
  }, [userListResult]);

  const handleFilterChange = useCallback((key: string, value: string) => {
    const val = value === "All" || value === "" ? null : value;

    if (key === "valuerScope") {
      if (value === "ALL" || value === "OWN") {
        setValuerScope(value);
      } else {
        setValuerScope(defaultValuerScope);
      }
      return;
    }

    if (key === "provinceId") {
      setSelectedProvinceId(val);
      setSelectedDistrictId(null); // Reset child
    } else if (key === "districtId") {
      setSelectedDistrictId(val);
      setSelectedCommuneId(null); // Reset child
    } else if (key === "communeId") {
      setSelectedCommuneId(val);
    }
  }, [defaultValuerScope]);

  // --- Handlers ---
  const handleView = useCallback(
    (valuation: PropertyValuation) => {
      router.push(`/dashboard/propertyValuation/${valuation.valuationId}`);
    },
    [router],
  );

  const handleEdit = useCallback(
    (valuation: PropertyValuation) => {
      router.push(`/dashboard/propertyValuation/${valuation.valuationId}/edit`);
    },
    [router],
  );

  const handleDownloadDocument = useCallback(
    async (valuation: PropertyValuation) => {
      if (!canDownload) {
        toast.error(t("errors.downloadNotAllowed"));
        return;
      }
      setDownloadingId(valuation.valuationId);
      try {
        const { downloadUrl } = await downloadMutation.mutateAsync(
          valuation.valuationId,
        );
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
        toast.success(t("messages.downloadReady"));
      } catch {
        // Error handled in hook
      } finally {
        setDownloadingId(null);
      }
    },
    [canDownload, downloadMutation, t],
  );

  const openDialog = (
    type: "submit" | "archive" | "approve" | "reject" | "reassign",
    valuation: PropertyValuation,
  ) => {
    setSelectedValuation(valuation);
    if (type === "submit") setIsSubmitDialogOpen(true);
    if (type === "archive") setIsArchiveDialogOpen(true);
    if (type === "approve") {
      setApprovalNotes("");
      setIsApproveDialogOpen(true);
    }
    if (type === "reject") {
      setRejectionReason("");
      setIsRejectDialogOpen(true);
    }
    if (type === "reassign") {
      setNewValuerId("");
      setIsReassignDialogOpen(true);
    }
  };

  const handleSubmitConfirm = () => {
    if (!selectedValuation) return;
    submitMutation.mutate(selectedValuation.valuationId, {
      onSuccess: () => {
        setIsSubmitDialogOpen(false);
        setSelectedValuation(null);
      },
    });
  };

  const handleArchiveConfirm = () => {
    if (!selectedValuation) return;
    archiveMutation.mutate(selectedValuation.valuationId, {
      onSuccess: () => {
        setIsArchiveDialogOpen(false);
        setSelectedValuation(null);
      },
    });
  };

  const handleApproveConfirm = () => {
    if (!selectedValuation) return;
    approveMutation.mutate(
      {
        id: selectedValuation.valuationId,
        data: { notes: approvalNotes.trim() || undefined },
      },
      {
        onSuccess: () => {
          setIsApproveDialogOpen(false);
          setSelectedValuation(null);
        },
      },
    );
  };

  const handleRejectConfirm = () => {
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
          setIsRejectDialogOpen(false);
          setSelectedValuation(null);
        },
      },
    );
  };

  const handleReassignConfirm = () => {
    if (!selectedValuation || !newValuerId) {
      toast.error(t("errors.valuerRequired"));
      return;
    }
    reassignMutation.mutate(
      {
        id: selectedValuation.valuationId,
        data: { newValuerId: parseInt(newValuerId) },
      },
      {
        onSuccess: () => {
          setIsReassignDialogOpen(false);
          setSelectedValuation(null);
        },
      },
    );
  };

  const handleExportExcel = useCallback(async () => {
    if (!canSeeImportExport) {
      toast.error("You do not have access to export.");
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

    const { blob, fileName } = await exportExcelMutation.mutateAsync(exportParams);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName || "property-valuations-export.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Property valuation Excel exported successfully");
  }, [canSeeImportExport, exportExcelMutation]);

  const handleTableParamsChange = useCallback((params: ApiParams) => {
    latestTableParamsRef.current = params;
  }, []);

  const handleImportExcelTrigger = useCallback(() => {
    if (!canSeeImportExport) {
      toast.error("You do not have access to import.");
      return;
    }
    importInputRef.current?.click();
  }, [canSeeImportExport]);

  const handleImportExcelChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!canSeeImportExport) {
        toast.error("You do not have access to import.");
        event.target.value = "";
        return;
      }
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await importExcelMutation.mutateAsync(file);
      } finally {
        event.target.value = "";
      }
    },
    [canSeeImportExport, importExcelMutation],
  );

  // --- Row Actions (Memoized) ---
  const renderActions = useCallback(
    (valuation: PropertyValuation) => {
      // Use workflowStatus for workflow-related logic
      const workflowStatus = valuation.workflowStatus || "DRAFT";
      const isDraft = workflowStatus === "DRAFT";
      const isRejected = workflowStatus === "REJECTED";
      const isReviewable = workflowStatus === "PENDING_REVIEW";
      const isArchived = workflowStatus === "ARCHIVED";
      const isApproved = workflowStatus === "APPROVED";
      const isDownloading = downloadingId === valuation.valuationId;

      const isOwner = Number(valuation.valuerId) === Number(user?.id);
      const canEdit = (isOwner && (isDraft || isRejected)) || isHighLevel;

      const hasDoc = Boolean(
        valuation.lastestDocument || valuation.documents?.length,
      );

      return (
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
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
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[200px] shadow-lg border-muted/50"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
               <DropdownMenuSeparator className="bg-border/50" />

              {canEdit && !isArchived && (
                <DropdownMenuItem onClick={() => handleEdit(valuation)}
                className="cursor-pointer transition-colors duration-150">
                  <Edit className="mr-2 h-4 w-4 text-indigo-600/80" />
                  <span className="font-medium ">{t("actions.edit")}</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={() => handleDownloadDocument(valuation)}
                disabled={!hasDoc || isDownloading || !canDownload}
                className="text-green-600/80 focus:text-green-600/80 focus:text-green-700/90 hover:bg-green-50/80 transition-colors duration-150 cursor-pointer"
              >
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4 text-green-400/80" />
                )}
                <span className="font-medium">{t("actions.download")}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {(isOwner || isHighLevel) && (isDraft || isRejected) && (
                <DropdownMenuItem
                  onClick={() => openDialog("submit", valuation)}
                  className="cursor-pointer transition-colors duration-150 "
                >
                  <Send className="mr-2 h-4 w-4 text-blue-600/80" />
                  <span className="font-medium text-blue-600">{t("actions.submit")}</span>
                </DropdownMenuItem>
              )}

              {isHighLevel && isReviewable && (
                <>
                  <DropdownMenuItem
                    onClick={() => openDialog("approve", valuation)}
                     className="cursor-pointer focus:bg-indigo-50/50 dark:focus:bg-indigo-950/20 transition-all duration-150"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4 text-indigo-600" />
                    <span className="font-medium ">{t("actions.approve")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openDialog("reject", valuation)}
                    className="cursor-pointer focus:bg-red-50/50 dark:focus:bg-red-950/20 transition-all duration-150"
                  >
                    <XCircle className="mr-2 h-4 w-4 text-red-600/90" />
                    <span className="font-medium">{t("actions.reject")}</span>
                  </DropdownMenuItem>
                </>
              )}

              {isHighLevel && !isArchived && !isApproved && (
                <DropdownMenuItem
                  onClick={() => openDialog("reassign", valuation)}
                  className="cursor-pointer focus:bg-info-50/50 dark:focus:bg-info-950/20 transition-all duration-150"
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4 text-cyan-600/80" />
                  <span className="font-medium text-cyan-600">{t("actions.reassign")}</span>
                </DropdownMenuItem>
              )}

              {isHighLevel && !isArchived && (
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
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    [
      user?.id,
      isHighLevel,
      downloadingId,
      canDownload,
      handleDownloadDocument,
      handleEdit,
      handleView,
      t,
    ],
  );

  // --- Table Config ---
  const valuationTableConfig = useMemo<
    DataTableConfig<PropertyValuation>
  >(() => {
    // ✅ FIX: Explicitly Type Filters as FilterConfig[]
    const filters: FilterConfig[] = [
      {
        key: "workflowStatus",
        label: "Workflow",
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
          { value: "ACTIVE", label: "Active" },
          { value: "SUPERSEDED", label: "Superseded" },
          { value: "EXPIRED", label: "Expired" },
          { value: "CANCELLED", label: "Cancelled" },
        ],
      },
      {
        key: "valuationMethod",
        label: t("valuationMethod"),
        type: "select",
        options: [
          {
            value: "SALES_COMPARISON_APPROACH",
            label: t("methodLabels.SALES_COMPARISON"),
          },
          {
            value: "INCOME_APPROACH",
            label: t("methodLabels.INCOME_APPROACH"),
          },
          { value: "COST_APPROACH", label: t("methodLabels.COST_APPROACH") 

          },
          {
           value: "SALES_AND_COST_APPROACH", label: t("methodLabels.SALES_AND_COST")
          },
        ],
      },
      {
        key: "preparedFor",
        label: t("prepareFor"),
        type: "select",
        options: preparedForFilterOptions,
      },
      {
        key: "purposeOfValuation",
        label: t("purposeOfValuation"),
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
        options: villageOptions, // value "03030403" ...
        dependsOn: "communeId",
      },

      { key: "dateRange", label: t("valuationDate"), type: "daterange" },
      {
        key: "minPrice",
        label: t("minPrice"),
        type: "number",
        placeholder: "Min",
        min: 0,
      },
      {
        key: "maxPrice",
        label: t("maxPrice"),
        type: "number",
        placeholder: "Max",
        min: 0,
      },
    ];

    const roleFilters: FilterConfig[] = [];

    if (isHighLevel || isMidLevel) {
      roleFilters.push({
        key: "valuerScope",
        label: "Valuer Filter",
        type: "select",
        options: [
          { label: "Own Properties", value: "OWN" },
          { label: "All Valuers", value: "ALL" },
        ],
        defaultValue: defaultValuerScope,
      });
    }

    if (isHighLevel) {
      roleFilters.push({
        key: "valuerId",
        label: "Specific Valuer",
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
          label: t("columns.valuationNo"),
          sortable: true,
          render: (v, r) => (
            <div className="flex flex-col gap-1 min-w-[130px]">
              <div className="flex  gap-2">
                <span className="font-semibold text-sm tabular-nums text-foreground">
                  Ref No: {v || r.valuationId ? `#${v || r.valuationId}` : "-"}
                </span>
              </div>
            </div>
          ),
        },
        {
          key: "property",
          label: t("columns.property"),
          render: (_, r) => (
            <div className="flex flex-col gap-2 max-w-[300px]">
              <div className="flex items-start gap-2 overflow-hidden">
                <div className="flex flex-col min-w-0">
                  <span
                    className="font-semibold text-sm truncate text-foreground"
                    title={r.property?.propertyName}
                  >
                    {r.property?.propertyName ||
                      r.property?.propertyCode ||
                      "N/A"}
                  </span>
                  {r.property?.propertyType?.propertyName && (
                    <div className="mt-1">
                      <PropertyTypeBadge
                        typeName={r.property.propertyType.propertyName}
                      />
                    </div>
                  )}
                </div>
              </div>
              {r.property?.propertyAddress?.province && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1 truncate">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    {addressLocale.province(r.property.propertyAddress.province)}
                    {r.property.propertyAddress.district &&
                      `, ${addressLocale.district(r.property.propertyAddress.district)}`}
                  </span>
                </div>
              )}
            </div>
          ),
        },
        {
          key: "marketValue",
          label: t("columns.marketValue"),
          sortable: true,
          render: (v, r) => (
            <div className="font-medium tracking-tight text-sm text-foreground">
              {formatMoney(v, r.currency)}
            </div>
          ),
        },
        {
          key: "valuer",
          label: t("columns.valuer"),
          render: (_, r) => <UserAvatar user={r.valuer} />,
        },
        {
          key: "status",
          label: t("columns.status"),
          sortable: true,
          render: (v, r) => (
            <div className="flex flex-col gap-1">
              {r.workflowStatus && (
                <WorkflowStatusBadge status={r.workflowStatus as WorkflowStatus} />
              )}
              <ValuationStatusBadge status={v as ValuationStatus} />
            </div>
          ),
        },
        {
          key: "createdAt",
          label: t("createdDate"),
          sortable: true,
          render: (v) => (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDateTime(v as string)}
            </div>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          sortable: false,
          render: (_, r) => renderActions(r),
        },
      ],
      filters: filters,
    };
  }, [
    t,
    isHighLevel,
    isMidLevel,
    defaultValuerScope,
    valuerScope,
    user?.id,
      valuerOptions,
      preparedForFilterOptions,
      purposeOfValuationFilterOptions,
      propertyTypeOptions,
      provinceOptions,
      districtOptions,
    communeOptions,
    villageOptions,
    renderActions,
    addressLocale,
  ]);

  return (
    <PermissionGuard
      maxHierarchyLevel={3}
      requiredPermissions={["property:read"]}
      requireAllPermissions
      redirectTo="/dashboard"
    >
      <div className="space-y-4 p-2">
        <DataTable<PropertyValuation>
          key={user?.id ? `user-${user.id}` : "guest"}
          config={valuationTableConfig}
          useDataHook={usePropertyValuations}
          onRowClick={handleView}
          onFilterChange={handleFilterChange}
          onParamsChange={handleTableParamsChange}
          headerActions={
            <div className="flex flex-wrap items-center gap-2">
              {canExportExcel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shadow-sm"
                  onClick={() => void handleExportExcel()}
                  disabled={exportExcelMutation.isPending}
                >
                  {exportExcelMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export
                </Button>
              )}

              {canImportExcel && (
                <>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(event) => void handleImportExcelChange(event)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shadow-sm"
                    onClick={handleImportExcelTrigger}
                    disabled={importExcelMutation.isPending}
                  >
                    {importExcelMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Import
                  </Button>
                </>
              )}

              {canManage && (
                <Button
                  onClick={() => router.push("/dashboard/propertyValuation/add")}
                  className="shadow-sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addValuation")}
                </Button>
              )}
            </div>
          }
        />

        {/* Submit Dialog */}
        <AlertDialog
          open={isSubmitDialogOpen}
          onOpenChange={setIsSubmitDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("dialogs.submitTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("dialogs.submitDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmitConfirm();
                }}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {t("actions.submit")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Archive Dialog */}
        <AlertDialog
          open={isArchiveDialogOpen}
          onOpenChange={setIsArchiveDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("dialogs.archiveTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("dialogs.archiveDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleArchiveConfirm();
                }}
                disabled={archiveMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
              >
                {t("actions.archive")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reassign Dialog */}
        <Dialog
          open={isReassignDialogOpen}
          onOpenChange={setIsReassignDialogOpen}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("dialogs.reassignTitle")}</DialogTitle>
              <DialogDescription>{t("dialogs.reassignDesc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-valuer-id">{t("fields.newUser")}</Label>
                <Select value={newValuerId} onValueChange={setNewValuerId}>
                  <SelectTrigger id="new-valuer-id" className="col-span-3">
                    <SelectValue placeholder="Select a valuer" />
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
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsReassignDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleReassignConfirm}
                disabled={reassignMutation.isPending}
              >
                {reassignMutation.isPending
                  ? t("common.saving")
                  : t("actions.reassign")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve Dialog */}
        <Dialog
          open={isApproveDialogOpen}
          onOpenChange={setIsApproveDialogOpen}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("actions.approve")}</DialogTitle>
            </DialogHeader>
            <Textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder={t("placeholders.notes")}
              className="min-h-[100px]"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsApproveDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleApproveConfirm}
                disabled={approveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {t("actions.approve")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("actions.reject")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="reason" className="text-destructive font-medium">
                Reason for Rejection *
              </Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t("placeholders.reason")}
                className="min-h-[100px] border-destructive/20 focus-visible:ring-destructive/30"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsRejectDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectConfirm}
                disabled={rejectMutation.isPending}
              >
                {t("actions.reject")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
