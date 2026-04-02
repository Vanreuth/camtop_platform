"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/lib/navigation";
import {
  ArrowLeft,
  Calendar,
  Download,
  Edit,
  FileText,
  Loader2,
  MapPin,
  ExternalLink,
  Building2,
  User,
  Clock,
  BadgeCheck,
  XCircle,
  FileArchive,
  DollarSign,
  TrendingUp,
  Hash,
  Ruler,
  Navigation,
  Star,
  GraduationCap,
  Stethoscope,
  UtensilsCrossed,
  Landmark,
  ShoppingCart,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GoogleMapPolygon } from "@/components/googleMap/GoogleMapPolygon";
import { toast } from "sonner";

import type {
  PropertyValuation,
  ValuationStatus,
  WorkflowStatus,
} from "@/hooks/propertyValuation/propertyValuation.types";

import {
  useDownloadValuationDocument,
  usePropertyValuation,
  useApprovePropertyValuation,
  useRejectPropertyValuation,
} from "@/hooks/propertyValuation/usePropertyValuation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { usePropertyLocationAnalysis } from "@/hooks/property/useProperty";
import { useAuth } from "@/hooks/auth/useAuth";
import type { PropertyAnalysis } from "@/types/property.types";

// ----------------------------------
// Helpers
// ----------------------------------
const getWorkflowStatusBadgeVariant = (status?: WorkflowStatus | null) => {
  const variants: Record<
    WorkflowStatus,
    "success" | "warning" | "info" | "destructive" | "secondary" | "outline"
  > = {
    DRAFT: "secondary",
    PENDING_REVIEW: "warning",
    APPROVED: "success",
    REJECTED: "destructive",
    ARCHIVED: "outline",
  };
  if (!status) return "outline";
  return variants[status] ?? "outline";
};

const getValuationStatusBadgeVariant = (status?: ValuationStatus | null) => {
  const variants: Record<
    ValuationStatus,
    "success" | "warning" | "info" | "destructive" | "secondary" | "outline"
  > = {
    ACTIVE: "success",
    SUPERSEDED: "warning",
    EXPIRED: "secondary",
    CANCELLED: "destructive",
  };
  if (!status) return "outline";
  return variants[status] ?? "outline";
};

const formatMoney = (
  value?: number | string | null,
  currency?: string | null,
) => {
  if (value === null || value === undefined) return "N/A";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "N/A";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(numeric);
  } catch {
    return `$${numeric.toLocaleString()}`;
  }
};

const formatNumber = (value?: number | string | null, digits = 0) => {
  if (value === null || value === undefined) return "N/A";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(numeric);
};

const formatDate = (value?: string | null) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const bytesToSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return "N/A";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const buildUserName = (user?: PropertyValuation["valuer"] | null) => {
  if (!user) return "N/A";
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return fullName || user.username || "N/A";
};

const getUserInitials = (user?: PropertyValuation["valuer"] | null) => {
  if (!user) return "?";
  const firstName = user.firstName ?? "";
  const lastName = user.lastName ?? "";
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (firstName) return firstName.charAt(0).toUpperCase();
  if (lastName) return lastName.charAt(0).toUpperCase();
  if (user.username) return user.username.charAt(0).toUpperCase();
  return "?";
};

const getUserAvatar = (user?: PropertyValuation["valuer"] | null) => {
  return user?.profilePicture || user?.profileImage || undefined;
};

const buildActorLabel = (
  user: PropertyValuation["valuer"] | null | undefined,
  fallbackId?: number | null,
  emptyLabel = "N/A",
) => {
  const name = buildUserName(user);
  if (name !== "N/A") return name;
  if (typeof fallbackId === "number") return `User #${fallbackId}`;
  return emptyLabel;
};

const getPropertyLabel = (valuation: PropertyValuation) => {
  return (
    valuation.property?.propertyName ||
    valuation.property?.propertyCode ||
    `#${valuation.propertyId}`
  );
};

const getAddressLine = (valuation: PropertyValuation) => {
  const addr: any = valuation.property?.propertyAddress;
  if (!addr) return "";

  const houseNo = addr.houseNo;
  const street = addr.street;
  const province =
    addr.province?.nameEn ||
    addr.province?.provinceName ||
    addr.province?.nameKh ||
    addr.province?.code ||
    addr.provinceId;
  const district =
    addr.district?.nameEn ||
    addr.district?.districtName ||
    addr.district?.nameKh ||
    addr.district?.code ||
    addr.districtId;
  const commune =
    addr.commune?.nameEn ||
    addr.commune?.communeName ||
    addr.commune?.nameKh ||
    addr.commune?.code ||
    addr.communeId;
  const village =
    addr.village?.nameEn ||
    addr.village?.villageName ||
    addr.village?.nameKh ||
    addr.village?.code ||
    addr.villageId;

  return [houseNo, street, village, commune, district, province]
    .filter(Boolean)
    .join(", ");
};

const getFormattedAddress = (valuation: PropertyValuation) => {
  const loc: any = valuation.property?.propertyLocation;
  return loc?.formattedAddress || "";
};

const getLatLng = (valuation: PropertyValuation) => {
  const loc: any = valuation.property?.propertyLocation;
  const lat = loc?.latitude ? Number(loc.latitude) : null;
  const lng = loc?.longitude ? Number(loc.longitude) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat as number, lng: lng as number };
};

// ----------------------------------
// Extra response shapes
// ----------------------------------
type ValuationComparableItem = {
  comparable?: {
    property?: {
      propertyId?: number;
      propertyName?: string;
      propertyCode?: string;
    };
  };
};

type ValuationTransaction = {
  id?: number;
  transactionId?: number;
  amount?: number;
  price?: number;
  transactionDate?: string;
  createdAt?: string;
  type?: string;
};

type ValuationDocument = {
  fileId: number;
  valuationId: number;
  version: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  uploadedById?: number | null;
  uploadedAt?: string | null;
};

type WrappedValuationResponse = {
  valuation?: PropertyValuation & {
    ValuationComparable?: ValuationComparableItem[];
    transactions?: ValuationTransaction[];
    documents?: ValuationDocument[];
    lastestDocument?: ValuationDocument | null; // typo in API
    latestDocument?: ValuationDocument | null;
  };
};

// ----------------------------------
// Page
// ----------------------------------
export default function PropertyValuationDetailPage() {
  const params = useParams() as { id?: string };
  const id = Number(params?.id || 0);
  const router = useRouter();

  const downloadMutation = useDownloadValuationDocument();
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, isError } = usePropertyValuation(id, !!id);
  const [openingPdf, setOpeningPdf] = useState(false);
  
  // Approve/Reject mutations
  const approveMutation = useApprovePropertyValuation();
  const rejectMutation = useRejectPropertyValuation();
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  
  const { hasHierarchyLevel, hasPermission, user } = useAuth();
  
  const isOwner = Number(data?.valuerId) === Number(user?.id);
  const canDownloadPdf = hasHierarchyLevel(2) || isOwner;
  const canViewPdf = hasHierarchyLevel(2) || isOwner ;
  const canEdit = hasHierarchyLevel(2) || isOwner;
  const canApprove = hasHierarchyLevel(2) 
  const canReject = hasHierarchyLevel(2)

  const valuation = useMemo(() => {
    const wrapped = data as unknown as
      | { data?: WrappedValuationResponse }
      | WrappedValuationResponse;
    // support both: { valuation } or { data: { valuation } }
    return ((wrapped as any)?.data?.valuation ??
      (wrapped as any)?.valuation ??
      (data as any)) as PropertyValuation | null;
  }, [data]);

  // Get property ID and check for location data
  const propertyId = valuation?.propertyId || valuation?.property?.propertyId;
  const hasLocation = Boolean(valuation?.property?.propertyLocation);
  
  // Fetch location analysis (nearby places) for the property
  const {
    data: locationAnalysis,
    isLoading: isLoadingLocation,
    isError: isLocationAnalysisError,
    refetch: refetchLocationAnalysis,
  } = usePropertyLocationAnalysis(propertyId ?? 0, !!propertyId && hasLocation);

  const locationAnalysisSummary = locationAnalysis as
    | PropertyAnalysis
    | undefined;
  const totalNearbyAmenities =
    (locationAnalysisSummary?.summary?.totalNearbySchools ?? 0) +
    (locationAnalysisSummary?.summary?.totalNearbyHospitals ?? 0) +
    (locationAnalysisSummary?.summary?.totalNearbyRestaurants ?? 0) +
    (locationAnalysisSummary?.summary?.totalNearbyBanks ?? 0) +
    (locationAnalysisSummary?.summary?.totalNearbySupermarkets ?? 0);


  const valuationAny = valuation as
    | (PropertyValuation & {
        ValuationComparable?: ValuationComparableItem[];
        transactions?: ValuationTransaction[];
        documents?: ValuationDocument[];
        lastestDocument?: ValuationDocument | null;
        latestDocument?: ValuationDocument | null;
      })
    | null;

  const documents = valuationAny?.documents ?? [];
  const latestDoc =
    valuationAny?.latestDocument ?? valuationAny?.lastestDocument ?? null;
  const hasDocument = Boolean(latestDoc || documents.length > 0);

  const handleDownloadLatest = useCallback(async () => {
    if (!valuation) return;
    if (!hasDocument) {
      toast.info("No document uploaded yet.");
      return;
    }

    setDownloading(true);
    try {
      const { downloadUrl } = await downloadMutation.mutateAsync(
        valuation.valuationId,
      );
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
      toast.success("Download is ready.");
    } catch {
      toast.error("Failed to download document.");
    } finally {
      setDownloading(false);
    }
  }, [downloadMutation, hasDocument, valuation]);

  const handleViewLatest = useCallback(async () => {
    if (!valuation) return;
    if (!hasDocument) {
      toast.info("No document uploaded yet.");
      return;
    }

    setOpeningPdf(true);
    try {
      // API should return both now
      const { viewUrl } = await downloadMutation.mutateAsync(
        valuation.valuationId,
      );

      // Option 1: open new tab
      window.open(viewUrl, "_blank", "noopener,noreferrer");

      // Option 2: embed preview in page (enable this if you want inline)
      // setPdfUrl(viewUrl);

      toast.success("PDF is ready.");
    } catch {
      toast.error("Failed to open document.");
    } finally {
      setOpeningPdf(false);
    }
  }, [downloadMutation, hasDocument, valuation]);

  const handleApprove = useCallback(async () => {
    if (!valuation) return;
    try {
      await approveMutation.mutateAsync({
        id: valuation.valuationId,
        data: {},
      });
    } catch {
      // Error handled in mutation
    }
  }, [approveMutation, valuation]);

  const handleReject = useCallback(async () => {
    if (!valuation || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        id: valuation.valuationId,
        data: { rejectionReason: rejectionReason.trim() },
      });
      setShowRejectDialog(false);
      setRejectionReason("");
    } catch {
      // Error handled in mutation
    }
  }, [rejectMutation, valuation, rejectionReason]);

  if (!id) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Invalid valuation ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            Loading valuation details...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !valuation) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium text-destructive">
            Failed to load valuation
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const title = valuation.valuationNo || `#${valuation.valuationId}`;
  const addressLine = getAddressLine(valuation);
  const formattedAddress = getFormattedAddress(valuation);
  const locationText = addressLine || formattedAddress;
  const latLng = getLatLng(valuation);
  const mapsUrl =
    ((valuation.property?.propertyLocation as any)?.geolocationLink as string | undefined) ||
    (latLng
      ? `https://www.google.com/maps?q=${latLng.lat},${latLng.lng}&z=18`
      : null);

  const propertyTypeName = valuation.property?.propertyType?.propertyName;
  const subtypeName = valuation.property?.propertySubtype?.subtypeName;

  const titleDoc: any = (valuation.property as any)?.titleDocument;
  const dataSource: any = (valuation.property as any)?.dataSource;

  const valuerUser = valuation.valuer ?? null;
  const approverUser = valuation.approver ?? valuation.approved ?? null;
  const rejecterUser = valuation.rejecter ?? valuation.rejected ?? null;
  const submittedByUser = valuation.submittedBy ?? valuerUser;
  const submittedAt = valuation.submittedAt ?? valuation.createdAt ?? null;
  const submittedByName = buildActorLabel(
    submittedByUser,
    valuation.submittedById ?? valuation.valuerId,
  );
  const approverName = buildActorLabel(approverUser, valuation.approvedById);
  const rejecterName = buildActorLabel(rejecterUser, valuation.rejectedById);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-muted/30 to-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="max-w-8xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                router.push(
                  `/dashboard/propertyValuation${window.location.search}`,
                )
              }
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{title}</h1>
                <Badge variant={getValuationStatusBadgeVariant(valuation.status)}>
                  {valuation.status ?? "N/A"}
                </Badge>
                {valuation.workflowStatus && (
                  <Badge variant={getWorkflowStatusBadgeVariant(valuation.workflowStatus)}>
                    {valuation.workflowStatus}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {getPropertyLabel(valuation)}{" "}
                {propertyTypeName ? `• ${propertyTypeName}` : ""}{" "}
                {subtypeName ? `• ${subtypeName}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canViewPdf && (
                <Button
                  variant="outline"
                  onClick={handleViewLatest}
                  disabled={!hasDocument || openingPdf}
                >
                  {openingPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  View Report
                </Button>
              )}

              {canReject && valuation?.workflowStatus === "PENDING_REVIEW" && (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Reject
                </Button>
              )}

              {canApprove && valuation?.workflowStatus === "PENDING_REVIEW" && (
                <Button
                  variant="outline"
                  className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
              )}

              {canDownloadPdf && (
                <Button
                  variant="outline"
                  onClick={handleDownloadLatest}
                  disabled={!hasDocument || downloading}
                >
                  {downloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download Report
                </Button>
              )}

              {canEdit && (
                <Button
                  onClick={() =>
                    router.push(`/dashboard/propertyValuation/${id}/edit`)
                  }
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-8xl mx-auto px-2 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Valuation Summary */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Valuation Summary
                    </p>
                    <div className="flex items-baseline gap-2">
                      <DollarSign className="h-6 w-6 text-muted-foreground" />
                      <span className="text-4xl font-bold">
                        {formatNumber(valuation.marketValue, 0)}
                      </span>
                      <span className="text-lg text-muted-foreground">
                        {valuation.currency || "USD"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Market Value (primary)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full md:w-auto">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Land</p>
                      <p className="font-bold">
                        {formatMoney(valuation.landValue, valuation.currency)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">
                        Building
                      </p>
                      <p className="font-bold">
                        {formatMoney(
                          valuation.buildingValue,
                          valuation.currency,
                        )}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg col-span-2 md:col-span-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        Forced Sale
                      </p>
                      <p className="font-bold">
                        {formatMoney(
                          valuation.forcedSaleValue,
                          valuation.currency,
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator className="my-5" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="p-3 bg-muted/20 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">
                      Prepared For
                    </p>
                    <p className="font-semibold">
                      {(valuation as any).preparedFor || "N/A"}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">
                      Inspector
                    </p>
                    <p className="font-semibold">
                      {(valuation as any).inspectorName || "N/A"}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">
                      Price / m²
                    </p>
                    <p className="font-semibold">
                      {formatMoney(
                        (valuation as any).pricePerSqm,
                        valuation.currency,
                      )}{" "}
                      <span className="text-muted-foreground">/ m²</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Valuation No
                    </p>
                    <p className="font-semibold text-lg">{title}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Method
                    </p>
                    <Badge variant="outline" className="justify-center">
                      {valuation.valuationMethod || "N/A"}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Date of Inspection
                    </p>
                    <p className="font-semibold">
                      {formatDate(valuation.dateOfInspection)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Date of Report
                    </p>
                    <p className="font-semibold">
                      {formatDate(valuation.dateOfReport)}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Purpose</p>
                    <p className="font-medium">
                      {valuation.purposeOfValuation || "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Note</p>
                    <p className="font-medium">{valuation.note || "N/A"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Internal Notes
                    </p>
                    <p className="font-medium">
                      {valuation.internalNotes || "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {locationText ? (
                  <p className="text-sm text-muted-foreground">{locationText}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No address available.
                  </p>
                )}

                <Separator />

                <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      Latitude
                    </p>
                    <p className="font-bold">
                      {latLng ? formatNumber(latLng.lat, 6) : "N/A"}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      Longitude
                    </p>
                    <p className="font-bold">
                      {latLng ? formatNumber(latLng.lng, 6) : "N/A"}
                    </p>
                  </div>
                </div>

                {mapsUrl && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      window.open(mapsUrl, "_blank", "noopener,noreferrer")
                    }
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on Google Maps
                  </Button>
                )}

                {valuation.property?.propertyLocation && (
                  <>
                    <Separator />
                    <GoogleMapPolygon property={valuation.property} />
                  </>
                )}

                {hasLocation && isLoadingLocation && (
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading property location analysis...
                  </div>
                )}

                {locationAnalysisSummary && !isLoadingLocation && (
                  <div className="space-y-5 rounded-xl border border-primary/20 bg-gradient-to-br from-blue-50/50 to-transparent p-4 dark:from-blue-950/20">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-primary" />
                        Location Analysis
                      </h4>
                      <Badge variant="default" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        {locationAnalysisSummary.summary.locationRating || "N/A"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div className="rounded-lg border bg-muted/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Location Score</p>
                        <p className="text-lg font-bold">
                          {locationAnalysisSummary.summary.locationScore}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Rating</p>
                        <p className="text-lg font-bold">
                          {locationAnalysisSummary.summary.locationRating || "N/A"}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Amenities</p>
                        <p className="text-lg font-bold">{totalNearbyAmenities}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Nearby Properties</p>
                        <p className="text-lg font-bold">
                          {locationAnalysisSummary.summary.totalNearbyProperties}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {locationAnalysisSummary.nearbyAmenities.schools.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-blue-600" />
                              Schools Nearby
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysisSummary.summary.totalNearbySchools}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {locationAnalysisSummary.nearbyAmenities.schools.map((school, idx) => (
                              <div
                                key={`${school.name}-${idx}`}
                                className="flex items-start justify-between rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{school.name}</p>
                                  <p className="text-xs text-muted-foreground">{school.address || "N/A"}</p>
                                  {school.rating !== undefined && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                      <span className="text-xs font-medium">
                                        {formatNumber(school.rating, 1)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {school.distance !== undefined
                                    ? `${formatNumber(school.distance, 0)}m`
                                    : "N/A"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {locationAnalysisSummary.nearbyAmenities.hospitals.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Stethoscope className="h-4 w-4 text-red-600" />
                              Healthcare Facilities
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysisSummary.summary.totalNearbyHospitals}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {locationAnalysisSummary.nearbyAmenities.hospitals.map((hospital, idx) => (
                              <div
                                key={`${hospital.name}-${idx}`}
                                className="flex items-start justify-between rounded-lg border border-red-100 bg-red-50/50 p-3 dark:border-red-900 dark:bg-red-950/20"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{hospital.name}</p>
                                  <p className="text-xs text-muted-foreground">{hospital.address || "N/A"}</p>
                                  {hospital.rating !== undefined && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                      <span className="text-xs font-medium">
                                        {formatNumber(hospital.rating, 1)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {hospital.distance !== undefined
                                    ? `${formatNumber(hospital.distance, 0)}m`
                                    : "N/A"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {locationAnalysisSummary.nearbyAmenities.restaurants.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <UtensilsCrossed className="h-4 w-4 text-orange-600" />
                              Restaurants & Dining
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysisSummary.summary.totalNearbyRestaurants}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {locationAnalysisSummary.nearbyAmenities.restaurants.map((restaurant, idx) => (
                              <div
                                key={`${restaurant.name}-${idx}`}
                                className="flex items-start justify-between rounded-lg border border-orange-100 bg-orange-50/50 p-3 dark:border-orange-900 dark:bg-orange-950/20"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{restaurant.name}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    {restaurant.rating !== undefined && (
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-medium">
                                          {formatNumber(restaurant.rating, 1)}
                                        </span>
                                      </div>
                                    )}
                                    {restaurant.priceLevel !== undefined && (
                                      <span className="text-xs text-muted-foreground">
                                        {"$".repeat(restaurant.priceLevel)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-xs ml-2">
                                  {restaurant.distance !== undefined
                                    ? `${formatNumber(restaurant.distance, 0)}m`
                                    : "N/A"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {locationAnalysisSummary.nearbyAmenities.banks.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Landmark className="h-4 w-4 text-green-600" />
                              Banks & ATMs
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysisSummary.summary.totalNearbyBanks}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {locationAnalysisSummary.nearbyAmenities.banks.map((bank, idx) => (
                              <div
                                key={`${bank.name}-${idx}`}
                                className="flex items-start justify-between rounded-lg border border-green-100 bg-green-50/50 p-3 dark:border-green-900 dark:bg-green-950/20"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{bank.name}</p>
                                  <p className="text-xs text-muted-foreground">{bank.address || "N/A"}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {bank.distance !== undefined
                                    ? `${formatNumber(bank.distance, 0)}m`
                                    : "N/A"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {locationAnalysisSummary.nearbyAmenities.supermarkets.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <ShoppingCart className="h-4 w-4 text-purple-600" />
                              Supermarkets
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysisSummary.summary.totalNearbySupermarkets}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {locationAnalysisSummary.nearbyAmenities.supermarkets.map((market, idx) => (
                              <div
                                key={`${market.name}-${idx}`}
                                className="flex items-start justify-between rounded-lg border border-purple-100 bg-purple-50/50 p-3 dark:border-purple-900 dark:bg-purple-950/20"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{market.name}</p>
                                  {market.rating !== undefined && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                      <span className="text-xs font-medium">
                                        {formatNumber(market.rating, 1)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {market.distance !== undefined
                                    ? `${formatNumber(market.distance, 0)}m`
                                    : "N/A"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {locationAnalysisSummary.nearbyProperties.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              Nearby Properties
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysisSummary.nearbyProperties.length}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {locationAnalysisSummary.nearbyProperties.map((prop) => (
                              <Card
                                key={prop.id}
                                className="border-2 hover:border-primary/50 transition-colors cursor-pointer"
                                onClick={() => router.push(`/dashboard/property/${prop.id}`)}
                              >
                                <CardContent className="pt-4">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-sm truncate">
                                        {prop.name || "N/A"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {prop.code || "N/A"}
                                      </p>
                                    </div>
                                    <Badge
                                      variant={prop.status === "ACTIVE" ? "default" : "secondary"}
                                      className="text-xs ml-2"
                                    >
                                      {prop.status || "N/A"}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between mt-3">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Type</p>
                                      <p className="text-sm font-medium">{prop.type || "N/A"}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-muted-foreground">Distance</p>
                                      <Badge variant="outline" className="text-xs">
                                        {prop.distance !== undefined
                                          ? `${formatNumber(prop.distance, 2)} km`
                                          : "N/A"}
                                      </Badge>
                                    </div>
                                  </div>
                                  {prop.price !== undefined && (
                                    <div className="mt-3 pt-3 border-t">
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-bold text-primary">
                                          {formatMoney(prop.price, valuation.currency)}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {isLocationAnalysisError && !isLoadingLocation && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3 dark:bg-amber-950/10">
                    <p className="text-sm text-muted-foreground">
                      Unable to load location analysis at the moment.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchLocationAnalysis()}
                    >
                      Retry
                    </Button>
                  </div>
                )}

                
              </CardContent>
            </Card>

            {/* Workflow */}
            <Card className="border-2 border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Workflow
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 bg-muted/30 rounded-lg border">
                    <div className="flex items-center gap-2 font-semibold">
                      <FileText className="h-4 w-4" /> Submitted
                    </div>
                    <p className="text-muted-foreground mt-1">
                      {formatDateTime(submittedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Submitted By: {submittedByName}
                    </p>
                  </div>

                  <div className="p-4 bg-green-50/50 dark:bg-green-950/10 rounded-lg border border-green-200 dark:border-green-900/30">
                    <div className="flex items-center gap-2 font-semibold">
                      <BadgeCheck className="h-4 w-4 text-green-600" /> Approved
                    </div>
                    <p className="text-muted-foreground mt-1">
                      {formatDateTime(valuation.approvedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Approved By: {approverName}
                    </p>
                  </div>

                  <div className="p-4 bg-red-50/50 dark:bg-red-950/10 rounded-lg border border-red-200 dark:border-red-900/30 md:col-span-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <XCircle className="h-4 w-4 text-red-600" /> Rejected
                    </div>
                    <p className="text-muted-foreground mt-1">
                      {formatDateTime(valuation.rejectedAt)}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      <p className="text-xs text-muted-foreground">
                        Rejected By: {rejecterName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reason: {valuation.rejectionReason ?? "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileArchive className="h-5 w-5 text-primary" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {documents.length > 0 ? (
                  <div className="space-y-3">
                    {Array.isArray(documents) &&
                      documents
                        .slice()
                        .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
                        .map((doc) => (
                          <div
                            key={`${doc.documentId}-${doc.version}`}
                            className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                v{doc.version ?? 0} — {doc.fileName ?? "N/A"}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {bytesToSize(doc.fileSize ?? 0)} •{" "}
                                {formatDateTime(doc.createdAt ?? null)}
                              </p>
                            </div>

                            <Badge variant="outline" className="shrink-0">
                              {doc.mimeType ?? "unknown"}
                            </Badge>
                          </div>
                        ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed rounded-xl bg-muted/20">
                    <div className="h-12 w-12 bg-background rounded-full flex items-center justify-center shadow-sm mb-4">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium">No documents uploaded</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Upload valuation reports to make them available for
                      download.
                    </p>
                  </div>
                )}

                <Separator />

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDownloadLatest}
                  disabled={!hasDocument || downloading}
                >
                  {downloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download Latest
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Title Deed */}
            {titleDoc && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Title Deed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="secondary">
                      {titleDoc.titleDeedType ?? "N/A"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Deed No</span>
                    <span className="font-mono text-xs font-semibold">
                      {titleDoc.titleDeedNo ?? "N/A"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Size</span>
                    <span className="font-semibold">
                      {titleDoc.totalSizeByTitleDeed
                        ? `${formatNumber(titleDoc.totalSizeByTitleDeed, 0)} m²`
                        : "N/A"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            
            {/* Data Source */}
            {dataSource && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Data Source
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="secondary">
                      {dataSource.sourceType ?? "N/A"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="font-semibold">
                      {dataSource.contactName ?? "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dataSource.phoneNumber ?? ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* People */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  People
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarImage 
                      src={getUserAvatar(valuerUser)}
                      alt={buildUserName(valuerUser)} 
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {getUserInitials(valuerUser)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Valuer</p>
                    <p className="font-semibold">
                      {buildUserName(valuerUser)}
                    </p>
                    {valuerUser?.username && (
                      <p className="text-xs text-muted-foreground">
                        @{valuerUser.username}
                      </p>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-green-500/20">
                    <AvatarImage 
                      src={getUserAvatar(approverUser)}
                      alt={approverName} 
                    />
                    <AvatarFallback className="bg-green-500/10 text-green-600 font-semibold">
                      {getUserInitials(approverUser)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Approver</p>
                    <p className="font-semibold">
                      {approverName === "N/A" ? "Not assigned" : approverName}
                    </p>
                    {approverUser?.username && (
                      <p className="text-xs text-muted-foreground">
                        @{approverUser.username}
                      </p>
                    )}
                  </div>
                </div>

                {(rejecterUser || valuation.rejectedById) && (
                  <>
                    <Separator />

                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border-2 border-red-500/20">
                        <AvatarImage
                          src={getUserAvatar(rejecterUser)}
                          alt={rejecterName}
                        />
                        <AvatarFallback className="bg-red-500/10 text-red-600 font-semibold">
                          {getUserInitials(rejecterUser)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Rejecter</p>
                        <p className="font-semibold">
                          {rejecterName === "N/A" ? "Not assigned" : rejecterName}
                        </p>
                        {rejecterUser?.username && (
                          <p className="text-xs text-muted-foreground">
                            @{rejecterUser.username}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Property */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Property
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold">{getPropertyLabel(valuation)}</p>
                {addressLine && (
                  <p className="text-muted-foreground">{addressLine}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {propertyTypeName && (
                    <Badge variant="outline">{propertyTypeName}</Badge>
                  )}
                  {subtypeName && (
                    <Badge variant="outline">{subtypeName}</Badge>
                  )}
                  {valuation.property?.status && (
                    <Badge variant="secondary">
                      {String(valuation.property.status)}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Valuation ID
                  </span>
                  <Badge variant="outline" className="font-mono">
                    {valuation.valuationId}
                  </Badge>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">
                    Property ID
                  </span>
                  <span className="font-semibold">{valuation.propertyId}</span>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">
                    Currency
                  </span>
                  <Badge variant="secondary">
                    {valuation.currency || "USD"}
                  </Badge>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    Price / m²
                  </span>
                  <span className="font-semibold">
                    {formatMoney(
                      (valuation as any).pricePerSqm,
                      valuation.currency,
                    )}
                  </span>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">
                    Documents
                  </span>
                  <span className="font-semibold">{documents.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Record Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Record Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <p className="font-medium">
                    {formatDateTime((valuation as any).createdAt)}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Last Updated
                  </p>
                  <p className="font-medium">
                    {formatDateTime((valuation as any).updatedAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Valuation</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this valuation. This will be
              visible to the valuer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Enter the reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Reject Valuation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
