"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { GoogleMapPolygon } from "@/components/googleMap/GoogleMapPolygon";
import { useAuth } from "@/hooks/auth/useAuth";
import { usePropertyLocationAnalysis } from "@/hooks/property/useProperty";
import {
  useExportIndicativeValuationPdf,
  useApproveIndicativeValuation,
  useIndicativeValuation,
  useRejectIndicativeValuation,
  useSubmitIndicativeValuation,
} from "@/hooks/indicativeValuation/useIndicativeValuation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Navigation,
  Send,
  Star,
  TrendingUp,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { PropertyAnalysis } from "@/types/property.types";

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

const formatNumber = (value?: number | string | null, digits = 0) => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(numeric);
};

const workflowBadgeClass: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  PENDING_REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  ARCHIVED: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const businessBadgeClass: Record<string, string> = {
  ACTIVE: "border-green-200 bg-green-50 text-green-700",
  SUPERSEDED: "border-amber-200 bg-amber-50 text-amber-700",
  EXPIRED: "border-slate-200 bg-slate-100 text-slate-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};

export default function PropertyIndicativeValuationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("indicativeValuation");
  const tc = useTranslations("common");
  const { user, hasHierarchyLevel } = useAuth();
  const valuationId = Number(params.id);

  const submitMutation = useSubmitIndicativeValuation();
  const approveMutation = useApproveIndicativeValuation();
  const rejectMutation = useRejectIndicativeValuation();
  const exportPdfMutation = useExportIndicativeValuationPdf();

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: valuation, isLoading, isError } = useIndicativeValuation(
    valuationId,
    Number.isFinite(valuationId),
  );

  const isHighLevel = hasHierarchyLevel(2);
  const isOwner = Number(valuation?.valuerId) === Number(user?.id);
  const canSubmit = valuation?.workflowStatus === "DRAFT" && (isOwner || isHighLevel);
  const canReview = valuation?.workflowStatus === "PENDING_REVIEW" && isHighLevel;
  const canEdit =
    (
      valuation?.workflowStatus === "DRAFT" ||
      valuation?.workflowStatus === "REJECTED" ||
      (valuation?.workflowStatus === "APPROVED" && valuation?.status === "ACTIVE")
    ) &&
    (isOwner || isHighLevel);
  const canGeneratePdf =
    valuation?.status === "ACTIVE" && valuation?.workflowStatus === "APPROVED";
  const hasStoredPdf = Boolean(valuation?.hasIndicativePdf);

  const propertyLabel = useMemo(() => {
    return valuation?.property?.propertyName || valuation?.property?.propertyCode || `#${valuation?.propertyId ?? ""}`;
  }, [valuation]);

  const valuerLabel = useMemo(() => {
    return valuation?.valuer?.firstName || valuation?.valuer?.lastName
      ? `${valuation?.valuer?.firstName ?? ""} ${valuation?.valuer?.lastName ?? ""}`.trim()
      : valuation?.valuer?.username || t("notAssigned");
  }, [t, valuation]);

  const initials = useMemo(() => {
    const firstName = valuation?.valuer?.firstName ?? "";
    const lastName = valuation?.valuer?.lastName ?? "";
    const username = valuation?.valuer?.username ?? "NA";
    return firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : username.slice(0, 2).toUpperCase();
  }, [valuation]);

  const addressLine = useMemo(() => {
    const province =
      valuation?.property?.propertyAddress?.province?.provinceName ||
      valuation?.property?.propertyAddress?.province?.nameEn ||
      valuation?.property?.propertyAddress?.province?.nameKh;
    const district =
      valuation?.property?.propertyAddress?.district?.districtName ||
      valuation?.property?.propertyAddress?.district?.nameEn ||
      valuation?.property?.propertyAddress?.district?.nameKh;
    return [district, province].filter(Boolean).join(", ") || "-";
  }, [valuation]);
  const formattedAddress = useMemo(() => {
    const location = valuation?.property?.propertyLocation as
      | { formattedAddress?: string | null }
      | undefined;
    return location?.formattedAddress || "";
  }, [valuation]);
  const latLng = useMemo(() => {
    const location = valuation?.property?.propertyLocation as
      | { latitude?: number | string | null; longitude?: number | string | null }
      | undefined;
    const lat = location?.latitude ? Number(location.latitude) : null;
    const lng = location?.longitude ? Number(location.longitude) : null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: lat as number, lng: lng as number };
  }, [valuation]);
  const mapsUrl = useMemo(() => {
    const location = valuation?.property?.propertyLocation as
      | { geolocationLink?: string | null }
      | undefined;
    if (location?.geolocationLink) return location.geolocationLink;
    if (!latLng) return null;
    return `https://www.google.com/maps?q=${latLng.lat},${latLng.lng}&z=18`;
  }, [latLng, valuation]);
  const locationText = addressLine !== "-" ? addressLine : formattedAddress || "";
  const propertyId = valuation?.propertyId || valuation?.property?.propertyId;
  const hasLocation = Boolean(valuation?.property?.propertyLocation);
  const {
    data: locationAnalysis,
    isLoading: isLoadingLocation,
    isError: isLocationAnalysisError,
    refetch: refetchLocationAnalysis,
  } = usePropertyLocationAnalysis(propertyId ?? 0, !!propertyId && hasLocation);
  const locationAnalysisSummary = locationAnalysis as PropertyAnalysis | undefined;
  const totalNearbyAmenities =
    (locationAnalysisSummary?.summary?.totalNearbySchools ?? 0) +
    (locationAnalysisSummary?.summary?.totalNearbyHospitals ?? 0) +
    (locationAnalysisSummary?.summary?.totalNearbyRestaurants ?? 0) +
    (locationAnalysisSummary?.summary?.totalNearbyBanks ?? 0) +
    (locationAnalysisSummary?.summary?.totalNearbySupermarkets ?? 0);

  const totalIndicativeMinValue =
    valuation?.totalIndicativeMinValue ?? valuation?.minMarketValue ?? null;
  const totalIndicativeMaxValue =
    valuation?.totalIndicativeMaxValue ?? valuation?.maxMarketValue ?? null;
  const propertyImages = [
    valuation?.property?.propertyPhotos?.frontSide,
    valuation?.property?.propertyPhotos?.inside,
  ].filter(Boolean) as string[];
  const workflowLabel = valuation?.workflowStatus
    ? t(`statusLabels.${valuation.workflowStatus}`)
    : t("statusLabels.DRAFT");
  const businessLabel = valuation?.status
    ? t(`businessStatus.${valuation.status}`)
    : t("businessStatus.ACTIVE");
  const contactName = valuation?.contactName || valuation?.property?.dataSource?.contactName || "-";
  const contactTel = valuation?.contactTel || valuation?.property?.dataSource?.phoneNumber || "-";
  const chargeFeeLabel =
    valuation?.chargeFee != null
      ? formatMoney(valuation.chargeFee, valuation.currency ?? "USD")
      : "-";

  const handleSubmit = useCallback(() => {
    if (!valuation) return;
    submitMutation.mutate(valuation.valuationId, {
      onSuccess: () => setSubmitDialogOpen(false),
    });
  }, [submitMutation, valuation]);

  const handleApprove = useCallback(() => {
    if (!valuation) return;
    approveMutation.mutate(
      { id: valuation.valuationId, data: { notes: approvalNotes.trim() || undefined } },
      { onSuccess: () => setApproveDialogOpen(false) },
    );
  }, [approvalNotes, approveMutation, valuation]);

  const handleReject = useCallback(() => {
    if (!valuation || !rejectionReason.trim()) {
      toast.error(t("errors.rejectionReasonRequired"));
      return;
    }
    rejectMutation.mutate(
      { id: valuation.valuationId, data: { rejectionReason: rejectionReason.trim() } },
      { onSuccess: () => setRejectDialogOpen(false) },
    );
  }, [rejectMutation, rejectionReason, t, valuation]);

  const handleViewPdf = useCallback(async () => {
    if (!valuation) return;

    try {
      const document = await exportPdfMutation.mutateAsync({
        id: valuation.valuationId,
        refresh: false,
      });
      window.open(document.viewUrl ?? document.publicUrl, "_blank", "noopener,noreferrer");
      toast.success(t("messages.pdfReady"));
    } catch {
      // Mutation toast already surfaces the API error.
    }
  }, [exportPdfMutation, t, valuation]);

  const handleRegeneratePdf = useCallback(async () => {
    if (!valuation || !canGeneratePdf) return;

    try {
      const document = await exportPdfMutation.mutateAsync({
        id: valuation.valuationId,
        refresh: true,
      });
      window.open(document.viewUrl ?? document.publicUrl, "_blank", "noopener,noreferrer");
      toast.success(t("messages.pdfRegenerated"));
    } catch {
      // Mutation toast already surfaces the API error.
    }
  }, [canGeneratePdf, exportPdfMutation, t, valuation]);

  return (
    <PermissionGuard
      maxHierarchyLevel={3}
      requiredPermissions={["property:read"]}
      requireAllPermissions
      redirectTo="/dashboard"
    >
      <div className="min-h-dvh bg-gradient-to-br from-muted/30 to-background">
        <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mmax-w-8xl mx-auto px-4 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/dashboard/propertyIndicativeValuation")}
                  className="rounded-full"
                  aria-label={tc("back")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                <div className="space-y-3">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                      {valuation?.valuationNo || t("detailsTitle")}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t("detailsDescription")}</p>
                  </div>

                  {valuation ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className={workflowBadgeClass[valuation.workflowStatus ?? ""] ?? "border-slate-200 bg-slate-100 text-slate-700"}
                        >
                          {workflowLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={businessBadgeClass[valuation.status ?? ""] ?? "border-green-200 bg-green-50 text-green-700"}
                        >
                          {businessLabel}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{propertyLabel}</span>
                        <span className="text-border">•</span>
                        <MapPin className="h-4 w-4" />
                        <span>{addressLine}</span>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canSubmit ? (
                  <Button onClick={() => setSubmitDialogOpen(true)}>
                    <Send className="mr-2 h-4 w-4" />
                    {t("actions.submit")}
                  </Button>
                ) : null}
                {canEdit ? (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/dashboard/propertyIndicativeValuation/${valuationId}/edit`)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {t("actions.edit")}
                  </Button>
                ) : null}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleViewPdf()}
                      disabled={
                        exportPdfMutation.isPending ||
                        !valuation ||
                        (!hasStoredPdf && !canGeneratePdf)
                      }
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {hasStoredPdf ? t("actions.viewPdf") : t("actions.generatePdf")}
                    </Button>
                    {hasStoredPdf ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleRegeneratePdf()}
                        disabled={exportPdfMutation.isPending || !valuation || !canGeneratePdf}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        {t("actions.regeneratePdf")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {canReview ? (
                  <Button variant="outline" onClick={() => setApproveDialogOpen(true)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t("actions.approve")}
                  </Button>
                ) : null}
                {canReview ? (
                  <Button variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    {t("actions.reject")}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("loading")}
              </CardContent>
            </Card>
          ) : null}

          {isError ? (
            <Card>
              <CardContent className="py-10 text-sm text-destructive">{t("loadError")}</CardContent>
            </Card>
          ) : null}

          {valuation ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                <Card className="border-primary/10 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("summary.totalRange")}</div>
                        <div className="text-lg font-semibold">
                          {`${formatMoney(totalIndicativeMinValue, valuation.currency ?? "USD")} - ${formatMoney(totalIndicativeMaxValue, valuation.currency ?? "USD")}`}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                

                <Card className="border-primary/10 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {t("fields.forcedSaleValue")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("summary.forcedSalePercentOfTotalMax", {
                            percent: Number(valuation.forcedSalePercent ?? 0).toFixed(2),
                          })}
                        </div>
                        <div className="text-lg font-semibold">
                          {formatMoney(valuation.forcedSaleValue, valuation.currency ?? "USD")}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_380px]">
                <div className="space-y-6">
                  <Card className="overflow-hidden border shadow-sm">
                    <CardHeader className="border-b bg-muted/20">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {t("sections.summary")}
                      </CardTitle>
                      <CardDescription>{t("sections.summaryDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.property")}</div>
                        <div className="font-medium">{propertyLabel}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.valuer")}</div>
                        <div className="font-medium">{valuerLabel}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.contactName")}</div>
                        <div className="font-medium">{contactName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.currency")}</div>
                        <div className="font-medium">{valuation.currency || "USD"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.valuationDate")}</div>
                        <div className="font-medium">{formatDate(valuation.valuationDate)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.preparedFor")}</div>
                        <div className="font-medium">{valuation.preparedFor || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.dateOfInspection")}</div>
                        <div className="font-medium">{formatDate(valuation.dateOfInspection)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.dateOfReport")}</div>
                        <div className="font-medium">{formatDate(valuation.dateOfReport)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.expiryDate")}</div>
                        <div className="font-medium">{formatDate(valuation.expiryDate)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.inspectorName")}</div>
                        <div className="font-medium">{valuation.inspectorName || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.contactTel")}</div>
                        <div className="font-medium">{contactTel}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.chargeFee")}</div>
                        <div className="font-medium">{chargeFeeLabel}</div>
                      </div>
                      </CardContent>
                  </Card>

                  <Card className="overflow-hidden border shadow-sm">
                    <CardHeader className="border-b bg-muted/20">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Location
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      {locationText ? (
                        <p className="text-sm text-muted-foreground">{locationText}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No address available.</p>
                      )}

                      <Separator />

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border bg-muted/20 p-4 text-center">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Latitude
                          </div>
                          <div className="mt-2 text-base font-semibold">
                            {latLng ? formatNumber(latLng.lat, 6) : "-"}
                          </div>
                        </div>
                        <div className="rounded-2xl border bg-muted/20 p-4 text-center">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Longitude
                          </div>
                          <div className="mt-2 text-base font-semibold">
                            {latLng ? formatNumber(latLng.lng, 6) : "-"}
                          </div>
                        </div>
                      </div>

                      {mapsUrl ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View on Google Maps
                        </Button>
                      ) : null}

                      {valuation.property?.propertyLocation ? (
                        <>
                          <Separator />
                          <GoogleMapPolygon property={valuation.property} />
                        </>
                      ) : null}

                      {hasLocation && isLoadingLocation ? (
                        <div className="flex items-center gap-2 rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading property location analysis...
                        </div>
                      ) : null}

                      {locationAnalysisSummary ? (
                        <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <Navigation className="h-4 w-4 text-primary" />
                              Location Analysis
                            </div>
                            <Badge variant="outline" className="bg-background">
                              <Star className="mr-1 h-3 w-3" />
                              {locationAnalysisSummary.summary.locationRating || "N/A"}
                            </Badge>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border bg-background p-4 text-center">
                              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Location Score
                              </div>
                              <div className="mt-2 text-lg font-semibold">
                                {locationAnalysisSummary.summary.locationScore}
                              </div>
                            </div>
                            <div className="rounded-2xl border bg-background p-4 text-center">
                              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Rating
                              </div>
                              <div className="mt-2 text-lg font-semibold">
                                {locationAnalysisSummary.summary.locationRating || "N/A"}
                              </div>
                            </div>
                            <div className="rounded-2xl border bg-background p-4 text-center">
                              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Amenities
                              </div>
                              <div className="mt-2 text-lg font-semibold">
                                {totalNearbyAmenities}
                              </div>
                            </div>
                            <div className="rounded-2xl border bg-background p-4 text-center">
                              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Nearby Properties
                              </div>
                              <div className="mt-2 text-lg font-semibold">
                                {locationAnalysisSummary.summary.totalNearbyProperties}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {isLocationAnalysisError && !isLoadingLocation ? (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-4 dark:bg-amber-950/10">
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
                      ) : null}
                    </CardContent>
                  </Card>

                  {propertyImages.length > 0 ? (
                    <Card className="overflow-hidden border shadow-sm">
                      <CardHeader className="border-b bg-muted/20">
                        <CardTitle className="flex items-center gap-2">
                          <ImageIcon className="h-5 w-5 text-primary" />
                          {t("sections.photos")}
                        </CardTitle>
                        <CardDescription>{t("sections.photosDescription")}</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                        {valuation?.property?.propertyPhotos?.frontSide ? (
                          <div className="space-y-3">
                            <div className="text-sm font-medium text-foreground">
                              {t("fields.frontViewPhoto")}
                            </div>
                            <div className="overflow-hidden rounded-2xl border bg-muted/20">
                              <img
                                src={valuation.property.propertyPhotos.frontSide}
                                alt={t("fields.frontViewPhoto")}
                                className="h-64 w-full object-cover"
                              />
                            </div>
                          </div>
                        ) : null}
                        {valuation?.property?.propertyPhotos?.inside ? (
                          <div className="space-y-3">
                            <div className="text-sm font-medium text-foreground">
                              {t("fields.insideViewPhoto")}
                            </div>
                            <div className="overflow-hidden rounded-2xl border bg-muted/20">
                              <img
                                src={valuation.property.propertyPhotos.inside}
                                alt={t("fields.insideViewPhoto")}
                                className="h-64 w-full object-cover"
                              />
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : null}
                </div>

                <div className="space-y-6 xl:sticky xl:top-28">
                  <Card className="overflow-hidden border shadow-sm">
                    <CardHeader className="border-b bg-muted/20">
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        {t("sections.timeline")}
                      </CardTitle>
                      <CardDescription>{t("sections.timelineDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex items-center gap-3 rounded-2xl border bg-muted/20 p-4">
                        <Avatar className="h-12 w-12 border border-border">
                          <AvatarImage
                            src={valuation.valuer?.profilePicture || valuation.valuer?.profileImage || undefined}
                            alt={valuerLabel}
                          />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm text-muted-foreground">{t("fields.valuer")}</div>
                          <div className="font-medium">{valuerLabel}</div>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-2xl border bg-background p-4">
                          <div className="text-sm text-muted-foreground">{tc("status")}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge
                              variant="outline"
                              className={workflowBadgeClass[valuation.workflowStatus ?? ""] ?? "border-slate-200 bg-slate-100 text-slate-700"}
                            >
                              {workflowLabel}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={businessBadgeClass[valuation.status ?? ""] ?? "border-green-200 bg-green-50 text-green-700"}
                            >
                              {businessLabel}
                            </Badge>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-4">
                          <div className="flex items-start gap-3">
                            <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">{t("fields.createdAt")}</div>
                              <div className="font-medium">{formatDate(valuation.createdAt)}</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-4">
                          <div className="flex items-start gap-3">
                            <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">{t("fields.expiryDate")}</div>
                              <div className="font-medium">{formatDate(valuation.expiryDate)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden border shadow-sm">
                    <CardHeader className="border-b bg-muted/20">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {t("fields.property")}
                      </CardTitle>
                      <CardDescription>{t("summary.selectedProperty")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.property")}</div>
                        <div className="font-medium">{propertyLabel}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.preparedFor")}</div>
                        <div className="font-medium">{valuation.preparedFor || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.inspectorName")}</div>
                        <div className="font-medium">{valuation.inspectorName || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{tc("details")}</div>
                        <div className="mt-1 flex items-start gap-2 text-sm">
                          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <span>{addressLine}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden border shadow-sm">
                    <CardHeader className="border-b bg-muted/20">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {t("sections.notes")}
                      </CardTitle>
                      <CardDescription>{t("sections.notesDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.purposeOfValuation")}</div>
                        <div className="mt-1 text-sm">{valuation.purposeOfValuation || "-"}</div>
                      </div>
                      <Separator />
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.note")}</div>
                        <div className="mt-1 text-sm">{valuation.note || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("fields.internalNotes")}</div>
                        <div className="mt-1 text-sm">{valuation.internalNotes || "-"}</div>
                      </div>
                      {valuation.rejectionReason ? (
                        <>
                          <Separator />
                          <div>
                            <div className="text-sm text-muted-foreground">{t("rejectionReason")}</div>
                            <div className="mt-1 text-sm text-red-700">{valuation.rejectionReason}</div>
                          </div>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("dialogs.submitTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("dialogs.submitDescription", {
                  reference: valuation?.valuationNo || `#${valuation?.valuationId ?? ""}`,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmit}>
                {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("actions.submit")}
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
                  reference: valuation?.valuationNo || `#${valuation?.valuationId ?? ""}`,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="approval-notes">{t("approvalNotes")}</Label>
              <Input
                id="approval-notes"
                value={approvalNotes}
                onChange={(event) => setApprovalNotes(event.target.value)}
                placeholder={t("approvalNotesPlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={handleApprove} disabled={approveMutation.isPending}>
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
                  reference: valuation?.valuationNo || `#${valuation?.valuationId ?? ""}`,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">{t("rejectionReason")}</Label>
              <Input
                id="rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder={t("rejectionReasonPlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
                {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("actions.reject")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
