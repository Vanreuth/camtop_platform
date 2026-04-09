"use client";

import { useState, useMemo, useCallback, useRef, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";

import { DataTable } from "@/components/DataTable/DataTable";
import type { ApiParams, DataTableConfig } from "@/components/DataTable/types";

import {
  useProperties,
  useDeleteProperty,
  useSubmitPropertyForReview,
  useApproveProperty,
  useRejectProperty,
  useArchiveProperty,
  useReassignProperty,
  useRestoreProperty,
  useExportPropertiesExcel,
  useImportPropertiesExcel,
} from "@/hooks/property/useProperty";

import {
  useProvinces,
  useDistrictsByProvinceCode,
  useCommunesByDistrictCode,
  useVillagesByCommuneCode,
} from "@/hooks/propertyAddress/usePropertyAddress";

import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { useAuth } from "@/hooks/auth/useAuth";
import { useUsers } from "@/hooks/user/useUser";
import { useAddressLocale } from "@/hooks/useAddressLocale";

import { PermissionGuard } from "@/components/guard/PermissionGuard";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

import {
  Building2,
  MapPin,
  DollarSign,
  Plus,
  Trash2,
  MoreHorizontal,
  Eye,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Archive,
  ArrowRightLeft,
  RotateCcw,
  Download,
  Upload,
  Loader2,
  HelpCircle,
  LandPlot,
  Leaf,
  Store,
  Factory,
  BadgeAlert,
  Home,
  Clock,
  LucideIcon,
} from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type { Property } from "@/types/property.types";
import { PropertyStatusBadge, WorkflowStatusBadge } from "@/components/property/PropertyStatusBadge";

// -----------------------------
// Helpers (same style as Valuation page)
// -----------------------------

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

const getPropertyTypeIconClasses = (variant: BadgeVariant) => {
  const iconStyles: Record<BadgeVariant, string> = {
    default: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-slate-100 text-slate-700 border-slate-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    destructive: "bg-red-50 text-red-700 border-red-200",
    outline: "bg-muted text-muted-foreground border-border",
  };

  return iconStyles[variant];
};

const ActionIconButton = ({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground/70 hover:text-primary hover:bg-primary/8 transition-all duration-200 hover:scale-105 active:scale-95"
      onClick={onClick}
      title={title}
    >
      {children}
      <span className="sr-only">{title}</span>
    </Button>
  );
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const buildPropertyExportParams = (params: ApiParams | null) => {
  if (!params) return undefined;

  return Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) =>
        key !== "page" &&
        key !== "limit" &&
        key !== "sortBy" &&
        key !== "sortOrder" &&
        key !== "valuerScope" &&
        value !== undefined &&
        value !== null &&
        value !== "",
    ),
  );
};

// -----------------------------
// Main Page
// -----------------------------

export default function PropertiesPage() {
  const router = useRouter();
  const t = useTranslations("properties");
  const tc = useTranslations("common");

  const propertyTypes = usePropertyTypes();
  const { hasHierarchyLevel, user, highestRole } = useAuth();

  const isAdminOrManager = hasHierarchyLevel(2);
  const isDataEntry =
    highestRole?.hierarchyLevel === 4 ||
    (highestRole?.roleCode ?? "").toUpperCase() === "DATA_ENTRY";
  const isHighLevel = isAdminOrManager;
  const isMidLevel = !isHighLevel && !isDataEntry && hasHierarchyLevel(3);
  const defaultValuerScope: "OWN" | "ALL" = isHighLevel ? "ALL" : "OWN";
  const [valuerScope, setValuerScope] =
    useState<"OWN" | "ALL">(defaultValuerScope);

  // filters cascade
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedCommuneId, setSelectedCommuneId] = useState<string | null>(null);

  // dialogs
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);

  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [newCreatorId, setNewCreatorId] = useState("");

  // API
  const { data: provinces } = useProvinces();
  const { data: districts } = useDistrictsByProvinceCode(selectedProvinceId);
  const { data: communes } = useCommunesByDistrictCode(selectedDistrictId);
  const { data: villages } = useVillagesByCommuneCode(selectedCommuneId);

  const deleteMutation = useDeleteProperty();
  const submitMutation = useSubmitPropertyForReview();
  const approveMutation = useApproveProperty();
  const rejectMutation = useRejectProperty();
  const archiveMutation = useArchiveProperty();
  const reassignMutation = useReassignProperty();
  const restoreMutation = useRestoreProperty();
  const exportExcelMutation = useExportPropertiesExcel();
  const importExcelMutation = useImportPropertiesExcel();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const latestTableParamsRef = useRef<ApiParams | null>(null);

  const { data: userListResult } = useUsers(
    { page: 1, limit: 100 },
    { enabled: isHighLevel },
  );

  const creatorOptions = useMemo(() => {
    const users = userListResult?.users ?? [];
    return users
      .filter((u) =>
        u.roles?.some((userRole) => {
          const roleCode = userRole.role?.roleCode?.toUpperCase?.() ?? "";
          const roleName = userRole.role?.roleName?.toUpperCase?.() ?? "";
          return (
            roleCode === "VALUER" ||
            roleCode === "DATA_ENTRY" ||
            roleName.includes("VALUER") ||
            roleName.includes("DATA ENTRY")
          );
        }),
      )
      .map((u) => ({
      label: `${u.firstName} ${u.lastName} (${u.username})`,
      value: String(u.id),
      }));
  }, [userListResult]);

  const canSeeImportExport = hasHierarchyLevel(3);
  const canExportExcel = canSeeImportExport;
  const canImportExcel = canSeeImportExport;

  // options
  const addressLocale = useAddressLocale();

  const propertyTypeOptions = useMemo(() => {
    return [...propertyTypes]
      .sort((a, b) => a.propertyTypeId - b.propertyTypeId)
      .map((type) => ({ label: type.propertyName, value: type.propertyTypeId.toString() }));
  }, [propertyTypes]);

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

  // handlers
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
      setSelectedDistrictId(null);
      setSelectedCommuneId(null);
    } else if (key === "districtId") {
      setSelectedDistrictId(val);
      setSelectedCommuneId(null);
    } else if (key === "communeId") {
      setSelectedCommuneId(val);
    }
  }, [defaultValuerScope]);

  const handleView = useCallback(
    (property: Property) => router.push(`/dashboard/property/${property.propertyId}`),
    [router],
  );

  const handleEdit = useCallback(
    (property: Property) => router.push(`/dashboard/property/${property.propertyId}/edit`),
    [router],
  );

  const openDeleteModal = useCallback((property: Property) => {
    setSelectedProperty(property);
    setIsDeleteModalOpen(true);
  }, []);

  const openApproveModal = useCallback((property: Property) => {
    setSelectedProperty(property);
    setApprovalNotes("");
    setIsApproveModalOpen(true);
  }, []);

  const openRejectModal = useCallback((property: Property) => {
    setSelectedProperty(property);
    setRejectionReason("");
    setIsRejectModalOpen(true);
  }, []);

  const openReassignModal = useCallback((property: Property) => {
    setSelectedProperty(property);
    setNewCreatorId("");
    setIsReassignModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!selectedProperty) return;

    deleteMutation.mutate(selectedProperty.propertyId, {
      onSuccess: () => {
        toast.success(t("deleteSuccess"));
        setIsDeleteModalOpen(false);
        setSelectedProperty(null);
      },
      onError: (error: any) => toast.error(error?.message || t("deleteFailed")),
    });
  }, [deleteMutation, selectedProperty, t]);

  const handleSubmitForReview = useCallback(
    (property: Property) => {
      submitMutation.mutate(property.propertyId, {
        onSuccess: () => toast.success("Property submitted for review"),
        onError: (error: any) => toast.error(error?.message || "Failed to submit"),
      });
    },
    [submitMutation],
  );

  const handleConfirmApprove = useCallback(() => {
    if (!selectedProperty) return;

    approveMutation.mutate(
      { id: selectedProperty.propertyId, data: { notes: approvalNotes?.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success("Property approved successfully");
          setIsApproveModalOpen(false);
          setSelectedProperty(null);
          setApprovalNotes("");
        },
        onError: (error: any) => toast.error(error?.message || "Failed to approve"),
      },
    );
  }, [approveMutation, selectedProperty, approvalNotes]);

  const handleConfirmReject = useCallback(() => {
    if (!selectedProperty || !rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    rejectMutation.mutate(
      { id: selectedProperty.propertyId, data: { reason: rejectionReason.trim() } },
      {
        onSuccess: () => {
          toast.success("Property rejected");
          setIsRejectModalOpen(false);
          setSelectedProperty(null);
          setRejectionReason("");
        },
        onError: (error: any) => toast.error(error?.message || "Failed to reject"),
      },
    );
  }, [rejectMutation, selectedProperty, rejectionReason]);

  const handleArchive = useCallback(
    (property: Property) => {
      archiveMutation.mutate(property.propertyId, {
        onSuccess: () => toast.success("Property archived"),
        onError: (error: any) => toast.error(error?.message || "Failed to archive"),
      });
    },
    [archiveMutation],
  );

  const handleRestore = useCallback(
    (property: Property) => {
      restoreMutation.mutate(property.propertyId, {
        onSuccess: () => toast.success("Property restored"),
        onError: (error: any) => toast.error(error?.message || "Failed to restore"),
      });
    },
    [restoreMutation],
  );

  const handleConfirmReassign = useCallback(() => {
    if (!selectedProperty || !newCreatorId) {
      toast.error("Please select a valuer");
      return;
    }

    reassignMutation.mutate(
      { id: selectedProperty.propertyId, newCreatorId: Number(newCreatorId) },
      {
        onSuccess: () => {
          toast.success("Property reassigned successfully");
          setIsReassignModalOpen(false);
          setSelectedProperty(null);
          setNewCreatorId("");
        },
        onError: (error: any) => toast.error(error?.message || "Failed to reassign"),
      },
    );
  }, [newCreatorId, reassignMutation, selectedProperty]);

  const handleExportExcel = useCallback(async () => {
    if (!canSeeImportExport) {
      toast.error(tc("noAccess"));
      return;
    }

    const exportParams = buildPropertyExportParams(latestTableParamsRef.current);

    try {
      const { blob, fileName } = await exportExcelMutation.mutateAsync(exportParams);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName || "properties-export.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Property Excel exported successfully");
    } catch {
      // handled in the mutation hook
    }
  }, [canSeeImportExport, exportExcelMutation, tc]);

  const handleTableParamsChange = useCallback((params: ApiParams) => {
    latestTableParamsRef.current = params;
  }, []);

  const handleImportExcelTrigger = useCallback(() => {
    if (!canSeeImportExport) {
      toast.error(tc("noAccess"));
      return;
    }
    importInputRef.current?.click();
  }, [canSeeImportExport, tc]);

  const handleImportExcelChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!canSeeImportExport) {
        toast.error(tc("noAccess"));
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
    [canSeeImportExport, importExcelMutation, tc],
  );

  // ✅ improved row actions (valuation-style)
  const renderActions = useCallback(
    (property: Property) => {
      // Use workflowStatus for workflow-related logic
      const workflowStatus = property.workflowStatus || "DRAFT";
      const isDraft = workflowStatus === "DRAFT";
      const isRejected = workflowStatus === "REJECTED";
      const isPendingReview = workflowStatus === "PENDING_REVIEW";
      const isArchived = workflowStatus === "ARCHIVED";
      const isApproved = workflowStatus === "APPROVED";

      const isOwner = property.createdByUser?.id === user?.id;
      const isAdminOrManager = hasHierarchyLevel(2);

      const canEdit =
        isAdminOrManager || (isOwner && (isDataEntry || isDraft || isRejected));
      const canDelete = (isOwner && isDraft) || (isAdminOrManager && isDraft);

      const canSubmit = (isDraft || isRejected) && (isAdminOrManager || isOwner);
      const canApprove = isPendingReview && isAdminOrManager;
      const canReject = isPendingReview && isAdminOrManager;

      const canArchive = !isArchived && !isApproved && isAdminOrManager;
      const canRestore = isArchived && isAdminOrManager;
      const canReassign = isAdminOrManager && !isArchived && !isApproved;

      const showReviewGroup = canSubmit || canApprove || canReject;
      const showManageGroup = canArchive || canRestore || canDelete || canReassign;

      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {/* View */}
          <Button
            title={t("view")}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleView(property);
            }}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">View</span>
          </Button>

          {/* More */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 data-[state=open]:bg-muted/80 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-all duration-200 hover:scale-105 active:scale-95"
                onClick={(e) => e.stopPropagation()}
                title="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent 
              align="end" 
              className="w-[220px] shadow-lg border-muted/50" 
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50" />

              {canEdit && !isArchived && (
                <DropdownMenuItem 
                  onClick={() => handleEdit(property)}
                  className="cursor-pointer transition-colors duration-150"
                >
                  <Edit className="mr-2 h-4 w-4 text-blue-600/80" />
                  <span className="font-medium">{t("edit")}</span>
                </DropdownMenuItem>
              )}

              {canDelete && (
                <DropdownMenuItem
                  onClick={() => openDeleteModal(property)}
                  className="text-red-600/80 focus:text-red-700 focus:bg-red-50/50 dark:focus:bg-red-950/20 cursor-pointer transition-all duration-150"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span className="font-medium">{t("deleteProperty")}</span>
                </DropdownMenuItem>
              )}

              {showReviewGroup && <DropdownMenuSeparator />}

              {canSubmit && (
                <DropdownMenuItem 
                  onClick={() => handleSubmitForReview(property)}
                  className="cursor-pointer transition-colors duration-150"
                >
                  <Send className="mr-2 h-4 w-4 text-blue-600/80" />
                  <span className="font-medium">Submit for Review</span>
                </DropdownMenuItem>
              )}

              {canApprove && (
                <DropdownMenuItem 
                  onClick={() => openApproveModal(property)}
                  className="cursor-pointer focus:bg-emerald-50/50 dark:focus:bg-emerald-950/20 transition-all duration-150"
                >
                  <CheckCircle className="mr-2 h-4 w-4 text-emerald-600/90" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-600">Approve</span>
                </DropdownMenuItem>
              )}

              {canReject && (
                <DropdownMenuItem 
                  onClick={() => openRejectModal(property)}
                  className="cursor-pointer focus:bg-red-50/50 dark:focus:bg-red-950/20 transition-all duration-150"
                >
                  <XCircle className="mr-2 h-4 w-4 text-red-600/90" />
                  <span className="font-medium text-red-700 dark:text-red-600">Reject</span>
                </DropdownMenuItem>
              )}

              {showManageGroup && <DropdownMenuSeparator />}

              {canArchive && (
                <DropdownMenuItem 
                  onClick={() => handleArchive(property)}
                  className="cursor-pointer transition-colors duration-150"
                >
                  <Archive className="mr-2 h-4 w-4 text-amber-600/80" />
                  <span className="font-medium">Archive</span>
                </DropdownMenuItem>
              )}

              {canReassign && (
                <DropdownMenuItem
                  onClick={() => openReassignModal(property)}
                  className="cursor-pointer transition-colors duration-150"
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4 text-cyan-600/80" />
                  <span className="font-medium">Reassign</span>
                </DropdownMenuItem>
              )}

              {canRestore && (
                <DropdownMenuItem 
                  onClick={() => handleRestore(property)}
                  className="cursor-pointer transition-colors duration-150"
                >
                  <RotateCcw className="mr-2 h-4 w-4 text-green-600/80" />
                  <span className="font-medium">Restore</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    [
      t,
      user?.id,
      hasHierarchyLevel,
      isDataEntry,
      handleView,
      handleEdit,
      handleSubmitForReview,
      openApproveModal,
      openRejectModal,
      openDeleteModal,
      handleArchive,
      openReassignModal,
      handleRestore,
    ],
  );

  // table config
  const propertyTableConfig = useMemo<DataTableConfig<Property>>(
    () => ({
      title: t("title"),
      description: t("description"),
      searchPlaceholder: t("searchPlaceholder"),
      defaultPageSize: 10,
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
      forcedParams: (() => {
        if (isDataEntry && user?.id) return { createdById: String(user.id) };
        if ((isHighLevel || isMidLevel) && valuerScope === "OWN" && user?.id) {
          return { createdById: String(user.id) };
        }
        return undefined;
      })(),
      columns: [
        {
          key: "propertyCode",
          label: t("propertyNo"),
          sortable: true,
          render: (value) => (
            <div className="flex flex-col gap-1 min-w-[130px]">
              <div className="flex gap-2">
                <span className="font-semibold text-sm tabular-nums text-foreground">
                  No: {value ? `#${value}` : "-"}
                </span>
              </div>
            </div>
          ),
        },
        {
          key: "property",
          label: t("propertyColumn"),
          sortable: true,
          render: (_, row) => (
            <div className="flex flex-col gap-2 max-w-[300px]">
              <div className="flex items-start gap-2 overflow-hidden">
                <div className="flex flex-col min-w-0">
                  <span
                    className="font-semibold text-sm truncate text-foreground"
                    title={row.propertyName || "N/A"}
                  >
                    {row.propertyName || "N/A"}
                  </span>
                  {row.propertyType?.propertyName && (
                    <div className="mt-1">
                      <PropertyTypeBadge
                        typeName={row.propertyType.propertyName}
                      />
                    </div>
                  )}
                </div>
              </div>
              {row.propertyAddress?.province && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1 truncate">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    {addressLocale.province(row.propertyAddress.province)}
                    {row.propertyAddress.district &&
                      `, ${addressLocale.district(row.propertyAddress.district)}`}
                  </span>
                </div>
              )}
            </div>
          ),
        },
        {
          key: "transaction",
          label: t("transactions"),
          sortable: false,
          render: (value) => {
            if (!value || value.length === 0) return <span className="text-muted-foreground">-</span>;
            const tx = value[0];
            return (
              <div className="flex flex-col">
                <div className="flex items-center gap-1 font-medium text-sm tabular-nums">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  {tx.totalPrice?.toLocaleString() ?? "0"}
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : "-"}
                </span>
              </div>
            );
          },
        },
        {
          key: "status",
          label: t("status"),
          sortable: true,
          render: (value, row) => (
            <div className="flex flex-col gap-1">
              <PropertyStatusBadge status={value} showIcon />
              {row.workflowStatus && (
                <WorkflowStatusBadge status={row.workflowStatus} showIcon />
              )}
            </div>
          ),
        },
        {
          key: "createdByUser",
          label: t("valuer"),
          sortable: false,
          render: (u) => {
            if (!u) return <span className="text-muted-foreground">-</span>;

            const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || "User";
            const initials = fullName.slice(0, 2).toUpperCase();

            return (
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={u.profilePicture || undefined} alt={fullName} />
                  <AvatarFallback className="text-[10px] bg-muted font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col max-w-[140px] min-w-0">
                  <span className="text-sm font-medium truncate" title={fullName}>
                    {fullName}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">{u.username}</span>
                </div>
              </div>
            );
          },
        },
        {
          key: "createdAt",
          label: t("createdDate"),
          sortable: true,
          render: (v) => (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDate(v as any)}
            </div>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          sortable: false,
          render: (_, row) => renderActions(row),
        },
      ],
      filters: [
        ...((isHighLevel || isMidLevel) && !isDataEntry
          ? [
              {
                key: "valuerScope",
                label: "Valuer Filter",
                type: "select" as const,
                options: [
                  { label: "Own Properties", value: "OWN" },
                  { label: "All Valuers", value: "ALL" },
                ],
                defaultValue: defaultValuerScope,
              },
            ]
          : []),
        ...(isHighLevel
          ? [
              {
                key: "createdById",
                label: "Specific Valuer",
                type: "select" as const,
                options: creatorOptions,
              },
            ]
          : []),
        {
          key: "status",
          label: t("status"),
          type: "select",
          options: [
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
            { label: t("sold"), value: "SOLD" },
            { label: t("rented"), value: "RENTED" },
            { label: "Rental/Sale", value: "RENTAL_SALE" },
          ],
        },
        {
          key: "workflowStatus",
          label: "Workflow",
          type: "select",
          options: [
            { label: "Draft", value: "DRAFT" },
            { label: "Pending Review", value: "PENDING_REVIEW" },
            { label: "Approved", value: "APPROVED" },
            { label: "Rejected", value: "REJECTED" },
            { label: "Archived", value: "ARCHIVED" },
          ],
        },
        { key: "propertyTypeId", label: t("propertyType"), type: "select", options: propertyTypeOptions },
        { key: "provinceId", label: t("filters.province"), type: "select", options: provinceOptions },
        { key: "districtId", label: t("filters.district"), type: "select", options: districtOptions, dependsOn: "provinceId" },
        { key: "communeId", label: t("filters.commune"), type: "select", options: communeOptions, dependsOn: "districtId" },
        { key: "villageId", label: t("filters.village"), type: "select", options: villageOptions, dependsOn: "communeId" },
        { key: "minPrice", label: t("minPrice"), type: "number", min: 0 },
        { key: "maxPrice", label: t("maxPrice"), type: "number", min: 0 },
        { key: "dateRange", label: t("createdDate"), type: "daterange" },
      ],
    }),
    [
      t,
      isHighLevel,
      isMidLevel,
      isDataEntry,
      defaultValuerScope,
      valuerScope,
      user?.id,
      creatorOptions,
      propertyTypeOptions,
      provinceOptions,
      districtOptions,
      communeOptions,
      villageOptions,
      renderActions,
      addressLocale,
    ],
  );

  return (
    <PermissionGuard
      maxHierarchyLevel={4}
      requiredPermissions={["property:read"]}
      requireAllPermissions={false}
      redirectTo="/dashboard"
      errorMessage="You need Property permissions to view listings."
    >
      <div className="space-y-4 p-2">
        <DataTable<Property>
          key={user?.id ? `user-${user.id}` : "guest"}
          config={propertyTableConfig}
          useDataHook={useProperties}
          onFilterChange={handleFilterChange}
          onParamsChange={handleTableParamsChange}
          onRowClick={handleView}
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
                  {tc("export")}
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
                    {tc("import")}
                  </Button>
                </>
              )}

              <Button
                onClick={() => router.push("/dashboard/property/add")}
                size="sm"
                className="shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("addProperty")}
              </Button>
            </div>
          }
        />

        {/* Delete Modal */}
        <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                {t("deleteProperty")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("confirmDelete")}{" "}
                <span className="font-semibold text-foreground">
                  {selectedProperty?.propertyName || "this item"}
                </span>
                ?
                <br />
                <span className="text-xs mt-2 block opacity-90">
                  {t("irreversibleWarning", { default: "This action cannot be undone." })}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedProperty(null);
                }}
              >
                {tc("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmDelete();
                }}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("deleting")}
                  </>
                ) : (
                  t("deleteProperty")
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Approve Modal */}
        <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
                Approve Property
              </DialogTitle>
              <DialogDescription>
                You are about to approve{" "}
                <span className="font-semibold text-foreground">{selectedProperty?.propertyName}</span>.
                Add optional notes below.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 py-2">
              <Label htmlFor="approval-notes" className="text-sm font-medium">
                Approval Notes (Optional)
              </Label>
              <Textarea
                id="approval-notes"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any comments or notes about the approval..."
                className="min-h-[100px] resize-none"
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsApproveModalOpen(false);
                  setSelectedProperty(null);
                  setApprovalNotes("");
                }}
                disabled={approveMutation.isPending}
              >
                {tc("cancel")}
              </Button>
              <Button
                onClick={handleConfirmApprove}
                disabled={approveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Reject Property
              </DialogTitle>
              <DialogDescription>
                You are about to reject{" "}
                <span className="font-semibold text-foreground">{selectedProperty?.propertyName}</span>.
                Please provide a reason.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 py-2">
              <Label htmlFor="rejection-reason" className="text-sm font-medium text-destructive">
                Rejection Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this property is being rejected..."
                className={cn(
                  "min-h-[100px] resize-none",
                  !rejectionReason.trim() && "border-destructive/20 focus-visible:ring-destructive/30",
                )}
                rows={4}
                required
              />
              {!rejectionReason.trim() && (
                <p className="text-xs text-muted-foreground">Rejection reason is required to proceed</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setSelectedProperty(null);
                  setRejectionReason("");
                }}
                disabled={rejectMutation.isPending}
              >
                {tc("cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isReassignModalOpen} onOpenChange={setIsReassignModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-cyan-600">
                <ArrowRightLeft className="h-5 w-5" />
                Reassign Property
              </DialogTitle>
              <DialogDescription>
                Transfer{" "}
                <span className="font-semibold text-foreground">{selectedProperty?.propertyName}</span>{" "}
                to another valuer.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 py-2">
              <Label htmlFor="new-creator-id" className="text-sm font-medium">
                New Valuer
              </Label>
              <Select value={newCreatorId} onValueChange={setNewCreatorId}>
                <SelectTrigger id="new-creator-id" className="h-11">
                  <SelectValue placeholder="Select a valuer" />
                </SelectTrigger>
                <SelectContent>
                  {creatorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsReassignModalOpen(false);
                  setSelectedProperty(null);
                  setNewCreatorId("");
                }}
                disabled={reassignMutation.isPending}
              >
                {tc("cancel")}
              </Button>
              <Button onClick={handleConfirmReassign} disabled={reassignMutation.isPending}>
                {reassignMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reassigning...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Reassign
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
