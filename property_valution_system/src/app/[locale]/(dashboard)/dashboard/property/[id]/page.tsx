"use client";
import React, { useState } from "react";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import {
  useProperty,
  usePropertyLocationAnalysis,
  useDeletePropertyTransaction,
} from "@/hooks/useProperty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  MapPin,
  DollarSign,
  Home,
  ArrowLeft,
  Calendar,
  Ruler,
  Layers,
  TrendingUp,
  Edit,
  FileText,
  Image as ImageIcon,
  MapPinned,
  TreePine,
  Users,
  Phone,
  ExternalLink,
  Bed,
  Bath,
  Square,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  User,
  GraduationCap,
  Stethoscope,
  UtensilsCrossed,
  Landmark,
  ShoppingCart,
  Star,
  Navigation,
  Trash2,
  Loader2,
} from "lucide-react";
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
import {GoogleMapPolygon} from "@/components/googleMap/GoogleMapPolygon";
import SearchParamsEffect from "./SearchParamsEffect";
import { PropertyWorkflowActions } from "@/components/property/PropertyWorkflowActions";
import { useAuth } from "@/hooks/auth/useAuth";
import { formatPhysicalCondition } from "@/utils/physicalCondition";
import { toConstructionPercentageNumber } from "@/utils/constructionPercentage";
import {
  formatTransactionTypeLabel,
  normalizeTransactionType,
} from "@/constants/transactionOptions";
import { formatViewTypeLabel } from "@/constants/viewTypeOptions";

const getTransactionBadgeVariant = (transactionType?: string | null) => {
  const normalizedTransactionType = normalizeTransactionType(transactionType);

  if (
    normalizedTransactionType === "SALE" ||
    normalizedTransactionType === "SOLD"
  ) {
    return "default";
  }

  if (
    normalizedTransactionType === "RENTAL" ||
    normalizedTransactionType === "RENTED"
  ) {
    return "secondary";
  }

  return "outline";
};

export default function PropertyDetailPage() {
  const params = useParams() as { id?: string };
  const id = Number(params?.id || 0);
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { data, isLoading, error, refetch } = useProperty(id);
  const deleteTransactionMutation = useDeletePropertyTransaction();
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(
    null
  );

  
  // Auth & Permissions
  const { user, hasHierarchyLevel, hasPermission, highestRole } = useAuth();

  const {
    data: locationAnalysis,
    isLoading: isLoadingLocation,
    isError: isLocationAnalysisError,
    refetch: refetchLocationAnalysis,
  } = usePropertyLocationAnalysis(id, !!data && !!data.propertyLocation);

  const enableFromCreateRefetch = Boolean(data);

  const initiateDelete = (transactionId: number) => {
    setTransactionToDelete(transactionId);
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      deleteTransactionMutation.mutate(
        { transactionId: transactionToDelete, propertyId: id },
        {
          onSettled: () => {
            // We keep the modal open while loading,
            // but close it immediately after success/error logic runs
            setTransactionToDelete(null);
          },
        }
      );
    }
  };

  if (!id) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Invalid property ID
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">
            Loading property details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium text-destructive">
            Failed to load property
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const property = data;

  if (!property) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium text-muted-foreground">
            Property not found
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const latestVal = property.propertyValuation?.[0];

  const transactions = [...(property.transaction ?? [])].sort((a: any, b: any) => {
    const dateDiff =
      new Date(b.transactionDate).getTime() -
      new Date(a.transactionDate).getTime();
    if (Number.isFinite(dateDiff) && dateDiff !== 0) return dateDiff;
    return Number(b.transactionId ?? 0) - Number(a.transactionId ?? 0);
  });

  const parseNumeric = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  type ResidualEntry = {
    grossAreaSqm: number;
    replacementCostPerSqm: number;
    constructionPercentage: number;
    effectiveAge: number;
    usefulLife: number;
  };

  const residualEntriesFromBuildings = (property.building ?? [])
    .map((item: any) => {
      const grossAreaSqm = parseNumeric(item.grossAreaSqm);
      const replacementCostPerSqm = parseNumeric(item.replacementCostPerSqm);
      const usefulLife = parseNumeric(item.usefulLife);

      if (grossAreaSqm <= 0 || replacementCostPerSqm <= 0 || usefulLife <= 0) {
        return null;
      }

      const constructionPercent = toConstructionPercentageNumber(
        item.percentageOfConstruction
      );

      return {
        grossAreaSqm,
        replacementCostPerSqm,
        constructionPercentage:
          constructionPercent !== undefined ? constructionPercent / 100 : 1,
        effectiveAge: parseNumeric(item.effectiveAge),
        usefulLife,
      };
    })
    .filter((item: ResidualEntry | null): item is ResidualEntry => item !== null);

  const nestedBuildingUnits = (property.building ?? []).flatMap(
    (building: any) => building?.buildingUnits ?? []
  );
  const allBuildingUnits = [...(property.buildingUnits ?? []), ...nestedBuildingUnits];

  const residualEntriesFromUnits = allBuildingUnits
    .map((unit: any) => {
      const grossAreaSqm = parseNumeric(unit.floorAreaSqm);
      const replacementCostPerSqm = parseNumeric(unit.replacementCostPerSqm);
      const usefulLife = parseNumeric(unit.usefulLife);

      if (grossAreaSqm <= 0 || replacementCostPerSqm <= 0 || usefulLife <= 0) {
        return null;
      }

      return {
        grossAreaSqm,
        replacementCostPerSqm,
        constructionPercentage: 1,
        effectiveAge: parseNumeric(unit.effectiveAge),
        usefulLife,
      };
    })
    .filter((item: ResidualEntry | null): item is ResidualEntry => item !== null);

  const residualEntries =
    residualEntriesFromBuildings.length > 0
      ? residualEntriesFromBuildings
      : residualEntriesFromUnits;

  const latestTransactionTotalPrice = parseNumeric(transactions[0]?.totalPrice);
  const landAreaFromLand = parseNumeric(property.land?.landAreaSqm);
  const landAreaFromTitleDeed = parseNumeric(
    property.titleDocument?.totalSizeByTitleDeed
  );
  const landAreaForResidual =
    landAreaFromTitleDeed > 0 ? landAreaFromTitleDeed : landAreaFromLand;

  const residualSummary =
    latestTransactionTotalPrice > 0 &&
    landAreaForResidual > 0 &&
    residualEntries.length > 0
      ? (() => {
          const totals = residualEntries.reduce(
            (
              acc: { newBuildingCost: number; depreciationAmount: number },
              entry: ResidualEntry
            ) => {
              const newBuildingCost =
                entry.grossAreaSqm *
                entry.replacementCostPerSqm *
                entry.constructionPercentage;
              const depreciationRatio =
                entry.usefulLife > 0 ? entry.effectiveAge / entry.usefulLife : 0;
              const depreciationAmount = newBuildingCost * depreciationRatio;

              acc.newBuildingCost += newBuildingCost;
              acc.depreciationAmount += depreciationAmount;
              return acc;
            },
            { newBuildingCost: 0, depreciationAmount: 0 }
          );

          const currentBuildingValue =
            totals.newBuildingCost - totals.depreciationAmount;
          const residualLandValue =
            latestTransactionTotalPrice - currentBuildingValue;

          return {
            transactionPrice: latestTransactionTotalPrice,
            entryCount: residualEntries.length,
            sourceLabel:
              residualEntriesFromBuildings.length > 0 ? "building" : "unit",
            newBuildingCost: totals.newBuildingCost,
            depreciationAmount: totals.depreciationAmount,
            depreciationRatio:
              totals.newBuildingCost > 0
                ? totals.depreciationAmount / totals.newBuildingCost
                : 0,
            currentBuildingValue,
            residualLandValue,
            landAreaForCalculation: landAreaForResidual,
            landPricePerSqm:
              landAreaForResidual > 0
                ? residualLandValue / landAreaForResidual
                : 0,
          };
        })()
      : null;
  
  const isAdminOrManager = hasHierarchyLevel(2); // hierarchyLevel <= 2
  const isDataEntry =
    highestRole?.hierarchyLevel === 4 ||
    (highestRole?.roleCode ?? "").toUpperCase() === "DATA_ENTRY";
  const isCreator = user?.id === property.createdBy;
  
  // Determine workflow permissions
  const canEdit = isDataEntry
    ? isCreator
    : isCreator || isAdminOrManager || hasPermission("property:update");
  const canSubmit = isCreator || isAdminOrManager || hasPermission("property:submit");
  const canApprove = isAdminOrManager || hasPermission("property:approve");
  const canReject = isAdminOrManager || hasPermission("property:reject");
  const canArchive = isAdminOrManager || hasPermission("property:archive");
  const canRestore = isAdminOrManager || hasPermission("property:restore");

  // Collect all images for gallery
  const allImages = [
    property.propertyPhotos?.frontSide,
    property.propertyPhotos?.inside,
    property.propertyPhotos?.leftSide,
    property.propertyPhotos?.rightSide,
    property.propertyPhotos?.opposite,
    ...(property.propertyPhotos?.gallery || []),
  ].filter(Boolean) as string[];

  const openImageViewer = (imageUrl: string) => {
    const index = allImages.indexOf(imageUrl);
    setCurrentImageIndex(index >= 0 ? index : 0);
    setSelectedImage(imageUrl);
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    setSelectedImage(allImages[(currentImageIndex + 1) % allImages.length]);
  };

  const prevImage = () => {
    setCurrentImageIndex(
      (prev) => (prev - 1 + allImages.length) % allImages.length
    );
    setSelectedImage(
      allImages[(currentImageIndex - 1 + allImages.length) % allImages.length]
    );
  };

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsEffect enabled={enableFromCreateRefetch} onFromCreate={refetch} />
      </Suspense>
    <div className="min-h-dvh bg-gradient-to-br from-muted/30 to-background">
      {/* Image Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={closeImageViewer}
          >
            <X className="h-6 w-6" />
          </Button>
          {allImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 text-white hover:bg-white/20"
                onClick={prevImage}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 text-white hover:bg-white/20"
                onClick={nextImage}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}
          <img
            src={selectedImage}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            {currentImageIndex + 1} / {allImages.length}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="max-w-8xl mx-auto px-4 py-4">
          <div className="flex items-start gap-4 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full mt-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl font-bold truncate">{property.propertyName}</h1>
                <Badge
                  variant={
                    property.workflowStatus === "APPROVED"
                      ? "success"
                      : property.workflowStatus === "PENDING_REVIEW"
                      ? "warning"
                      : property.workflowStatus === "REJECTED"
                      ? "destructive"
                      : property.workflowStatus === "ARCHIVED"
                      ? "secondary"
                      : property.workflowStatus === "DRAFT"
                      ? "info"
                      : "outline"
                  }
                >
                  {property.workflowStatus?.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {property.propertyCode} • {property.propertyType?.propertyName}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <PropertyWorkflowActions
                propertyId={id}
                workflowStatus={property.workflowStatus || "DRAFT"}
                propertyName={property.propertyName}
                canSubmit={canSubmit}
                canApprove={canApprove}
                canReject={canReject}
                canArchive={canArchive}
                canRestore={canRestore}
                onSuccess={() => refetch()}
              />
              {canEdit && (
                <Button
                  onClick={() => router.push(`/dashboard/property/${id}/edit`)}
                  variant="outline"
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
      <div className="max-w-8xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Image Section */}
            {allImages.length > 0 && (
              <Card className="overflow-hidden">
                <div className="relative">
                  <img
                    src={allImages[0]}
                    alt={property.propertyName}
                    className="w-full h-[400px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => openImageViewer(allImages[0])}
                  />
                  <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    {allImages.length} Photos
                  </div>
                </div>
                {allImages.length > 1 && (
                  <div className="p-4 bg-muted/30">
                    <div className="grid grid-cols-5 gap-2">
                      {allImages.slice(1, 6).map((img, idx) => (
                        <div
                          key={idx}
                          className="relative group cursor-pointer"
                          onClick={() => openImageViewer(img)}
                        >
                          <img
                            src={img}
                            alt={`Preview ${idx + 2}`}
                            className="w-full h-20 object-cover rounded border-2 border-transparent group-hover:border-primary transition-all"
                          />
                          {idx === 4 && allImages.length > 6 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded text-white font-semibold">
                              +{allImages.length - 6}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Valuation Card */}
            {latestVal && (
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Current Valuation
                      </p>
                      <div className="flex items-baseline gap-2">
                        <DollarSign className="h-6 w-6 text-muted-foreground" />
                        <span className="text-4xl font-bold">
                          {Number(latestVal.listPrice).toLocaleString()}
                        </span>
                        <span className="text-lg text-muted-foreground">
                          USD
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">
                        Valuation Date
                      </p>
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="mr-1 h-3 w-3" />
                        {new Date(latestVal.valuationDate).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Property Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Property Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Property Type
                    </p>
                    <p className="font-semibold text-lg">
                      {property.propertyType?.propertyName}
                    </p>
                    {property.propertyType?.recordType && (
                      <Badge variant="secondary" className="mt-1">
                        {property.propertyType.recordType.recordName}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Subtype
                    </p>
                    <p className="font-semibold">
                      {property.propertySubtype?.subtypeName || "N/A"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Current Use
                    </p>
                    <p className="font-semibold text-lg">
                      {property.currentUse?.useName || "N/A"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Status
                    </p>
                    <Badge
                      variant={
                        property.status === "ACTIVE"
                          ? "success"
                          : property.status === "INACTIVE"
                          ? "destructive"
                          : property.status === "SOLD"
                          ? "warning"
                          : "info"
                      }
                    >
                      {property.status}
                    </Badge>
                  </div>
                </div>
                {property.description && (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Description
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {property.description}
                      </p>
                    </div>
                    <Separator />
                  </>
                )}
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
                <div className="font-hanuman">
                  {" "}
                  {/* Ensure Khmer font is applied */}
                  <p className="text-muted-foreground">
                    {[
                      property.propertyAddress?.village?.nameEn
                        ? `Village ${property.propertyAddress.village.nameEn}`
                        : null,

                      property.propertyAddress?.commune?.nameEn
                        ? `Commune ${property.propertyAddress.commune.nameEn}`
                        : null,

                      property.propertyAddress?.district?.nameEn
                        ? `District ${property.propertyAddress.district.nameEn}`
                        : null,
                      property.propertyAddress?.province?.nameEn
                        ? `Province ${property.propertyAddress.province.nameEn}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>

                {property.propertyLocation && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {property.propertyLocation.formattedAddress && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPinned className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">
                            {property.propertyLocation.formattedAddress}
                          </span>
                        </div>
                      )}
                      {property.propertyLocation.geolocationLink && (
                        <a
                          href={property.propertyLocation.geolocationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View on Google Maps
                        </a>
                      )}
                    </div>

                    {/* Interactive Map with Polygon */}
                    <Separator />
                    <GoogleMapPolygon property={property} />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Land Details */}
            {property.land && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-primary" />
                    Land Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
                      <Square className="h-5 w-5 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">
                        {property.land.landAreaSqm
                          ? Number(property.land.landAreaSqm).toLocaleString()
                          : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total Area (m²)
                      </p>
                    </div>

                    {property.land.widthMeters && (
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">
                          {property.land.widthMeters}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Width (m)
                        </p>
                      </div>
                    )}

                    {property.land.lengthMeters && (
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">
                          {property.land.lengthMeters}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Length (m)
                        </p>
                      </div>
                    )}

                    {property.land.landShape && (
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm font-semibold">
                          {property.land.landShape.replace("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">Shape</p>
                      </div>
                    )}
                  </div>

                  {(property.land.topography ||
                    property.land.sitePosition ||
                    property.land.waterSource) && (
                    <>
                      <Separator className="my-4" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {property.land.topography && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Topography
                            </p>
                            <Badge
                              variant="outline"
                              className="w-full justify-center"
                            >
                              {property.land.topography.replace("_", " ")}
                            </Badge>
                          </div>
                        )}
                        {property.land.sitePosition && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Site Position
                            </p>
                            <Badge
                              variant="outline"
                              className="w-full justify-center"
                            >
                              {property.land.sitePosition.replace("_", " ")}
                            </Badge>
                          </div>
                        )}
                        {property.land.waterSource && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Water Source
                            </p>
                            <Badge
                              variant="outline"
                              className="w-full justify-center"
                            >
                              {property.land.waterSource.replace("_", " ")}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Buildings */}
            {property.building && property.building.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    Buildings
                    <Badge variant="secondary" className="ml-2">
                      {property.building.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {property.building.map((building: any, index: number) => (
                    <Card key={building.buildingId} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {building.buildingName || `Building ${index + 1}`}
                          </h4>
                          <Badge variant="outline">
                            {building.buildingSubtype?.subtypeName || "N/A"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {building.numberOfStorey && (
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <Layers className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                              <p className="text-lg font-bold">
                                {building.numberOfStorey}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Floors
                              </p>
                            </div>
                          )}
                          {building.width && (
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <Ruler className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                              <p className="text-lg font-bold">{building.width}</p>
                              <p className="text-xs text-muted-foreground">
                                Width (m)
                              </p>
                            </div>
                          )}
                          {building.length && (
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <Ruler className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                              <p className="text-lg font-bold">{building.length}</p>
                              <p className="text-xs text-muted-foreground">
                                Length (m)
                              </p>
                            </div>
                          )}
                          {building.grossAreaSqm && (
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <Square className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                              <p className="text-lg font-bold">
                                {Number(building.grossAreaSqm).toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Area (m²)
                              </p>
                            </div>
                          )}
                          {building.constructionYear && (
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                              <p className="text-lg font-bold">
                                {building.constructionYear}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Built
                              </p>
                            </div>
                          )}
                          {building.buildingUnits.length && (
                            <div className="text-center p-3 bg-muted/50 rounded">
                              <Home className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                              <p className="text-lg font-bold">
                                {building.buildingUnits.length}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Units
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Room Details */}
                        {(building.bedroom ||
                          building.bathroom ||
                          building.livingroom ||
                          building.kitchen ||
                          building.diningroom) && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Room Details
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {building.bedroom && (
                                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                                    <Bed className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex-1">
                                      <p className="text-xs text-muted-foreground">
                                        Bedrooms
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {building.bedroom}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {building.bathroom && (
                                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                                    <Bath className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex-1">
                                      <p className="text-xs text-muted-foreground">
                                        Bathrooms
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {building.bathroom}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {building.livingroom && (
                                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                                    <Home className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex-1">
                                      <p className="text-xs text-muted-foreground">
                                        Living Rooms
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {building.livingroom}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {building.kitchen && (
                                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                                    <Home className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex-1">
                                      <p className="text-xs text-muted-foreground">
                                        Kitchens
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {building.kitchen}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {building.diningroom && (
                                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                                    <Home className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex-1">
                                      <p className="text-xs text-muted-foreground">
                                        Dining Rooms
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {building.diningroom}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {building.totalRoom && (
                                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                                    <Home className="h-4 w-4 text-blue-600" />
                                    <div className="flex-1">
                                      <p className="text-xs text-blue-600 font-medium">
                                        Total Rooms
                                      </p>
                                      <p className="text-sm font-bold text-blue-700">
                                        {building.totalRoom}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Additional Building Details */}
                        {(building.parkingSpace ||
                          building.effectiveAge ||
                          building.usefulLife ||
                          building.viewType ||
                          building.status) && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Additional Details
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {building.parkingSpace && (
                                  <div className="p-2 bg-muted/30 rounded">
                                    <p className="text-xs text-muted-foreground">
                                      Parking Spaces
                                    </p>
                                    <p className="text-sm font-semibold">
                                      {building.parkingSpace}
                                    </p>
                                  </div>
                                )}
                                {building.effectiveAge && (
                                  <div className="p-2 bg-muted/30 rounded">
                                    <p className="text-xs text-muted-foreground">
                                      Effective Age
                                    </p>
                                    <p className="text-sm font-semibold">
                                      {building.effectiveAge} years
                                    </p>
                                  </div>
                                )}
                                {building.usefulLife && (
                                  <div className="p-2 bg-muted/30 rounded">
                                    <p className="text-xs text-muted-foreground">
                                      Useful Life
                                    </p>
                                    <p className="text-sm font-semibold">
                                      {building.usefulLife} years
                                    </p>
                                  </div>
                                )}
                                {building.viewType && (
                                  <div className="p-2 bg-muted/30 rounded">
                                    <p className="text-xs text-muted-foreground">
                                      View Type
                                    </p>
                                    <Badge variant="outline" className="mt-1">
                                      {formatViewTypeLabel(building.viewType)}
                                    </Badge>
                                  </div>
                                )}
                                {building.status && (
                                  <div className="p-2 bg-muted/30 rounded">
                                    <p className="text-xs text-muted-foreground">
                                      Status
                                    </p>
                                    <Badge variant="outline" className="mt-1">
                                      {building.status}
                                    </Badge>
                                  </div>
                                )}
                                {building.percentageOfConstruction && (
                                  <div className="p-2 bg-muted/30 rounded">
                                    <p className="text-xs text-muted-foreground">
                                      Construction Progress
                                    </p>
                                    <p className="text-sm font-semibold">
                                      {toConstructionPercentageNumber(
                                        building.percentageOfConstruction
                                      )}
                                      %
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Cost Information & Residual Method Calculation (for LandAndBuilding) */}
                        {(building.costEstimationPerSqm ||
                          building.replacementCostPerSqm ||
                          building.totalBuildingCost) && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Cost Estimation
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                {building.costEstimationPerSqm && (
                                  <div className="p-3 bg-green-50 rounded border border-green-200">
                                    <p className="text-xs text-green-600 mb-1">
                                      Cost per m²
                                    </p>
                                    <div className="flex items-baseline gap-1">
                                      <DollarSign className="h-4 w-4 text-green-600" />
                                      <p className="text-lg font-bold text-green-700">
                                        {Number(
                                          building.costEstimationPerSqm
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {building.replacementCostPerSqm && (
                                  <div className="p-3 bg-orange-50 rounded border border-orange-200">
                                    <p className="text-xs text-orange-600 mb-1">
                                      Replacement Cost per m²
                                    </p>
                                    <div className="flex items-baseline gap-1">
                                      <DollarSign className="h-4 w-4 text-orange-600" />
                                      <p className="text-lg font-bold text-orange-700">
                                        {Number(
                                          building.replacementCostPerSqm
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {building.totalBuildingCost && (
                                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                                    <p className="text-xs text-blue-600 mb-1">
                                      Total Building Cost
                                    </p>
                                    <div className="flex items-baseline gap-1">
                                      <DollarSign className="h-4 w-4 text-blue-600" />
                                      <p className="text-lg font-bold text-blue-700">
                                        {Number(
                                          building.totalBuildingCost
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Residual Method Calculation Panel for LandAndBuilding */}
                            {property.propertyType?.recordType?.recordName ===
                              "LandAndBuilding" &&
                              index === 0 &&
                              residualSummary && (
                                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                                      <svg
                                        className="h-4 w-4 text-blue-600"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M16 5v6a2 2 0 002 2h6"
                                        />
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M8 19v-6a2 2 0 00-2-2H0"
                                        />
                                      </svg>
                                      Residual Method Calculation
                                    </h4>
                                    <p className="text-xs text-blue-700 mb-2">
                                      Based on {residualSummary.entryCount} {residualSummary.sourceLabel}
                                      {residualSummary.entryCount > 1 ? "s" : ""}
                                    </p>
                                    <ul className="text-sm text-blue-900 space-y-1">
                                      <li>
                                        <strong>New Building Cost:</strong>{" "}
                                        {`Σ(Building/Unit Area × Replacement Cost × %Construction) = $${residualSummary.newBuildingCost.toLocaleString()}`}{" "}
                                        <span className="text-gray-500">
                                          (${residualSummary.newBuildingCost.toLocaleString()})
                                        </span>
                                      </li>
                                      <li>
                                        <strong>Depreciation Ratio:</strong>{" "}
                                        {`Total Depreciation ÷ Total New Cost = ${(
                                          residualSummary.depreciationRatio * 100
                                        ).toFixed(1)}%`}{" "}
                                        <span className="text-gray-500">
                                          ({residualSummary.depreciationRatio})
                                        </span>
                                      </li>
                                      <li>
                                        <strong>Depreciation Amount:</strong>{" "}
                                        {`${residualSummary.newBuildingCost} × ${residualSummary.depreciationRatio} = $${residualSummary.depreciationAmount.toLocaleString()}`}{" "}
                                        <span className="text-gray-500">
                                          ($
                                          {residualSummary.depreciationAmount.toLocaleString()})
                                        </span>
                                      </li>
                                      <li>
                                        <strong>Current Building Value:</strong>{" "}
                                        {`${residualSummary.newBuildingCost} - ${residualSummary.depreciationAmount} = $${residualSummary.currentBuildingValue.toLocaleString()}`}{" "}
                                        <span className="text-gray-500">
                                          ($
                                          {residualSummary.currentBuildingValue.toLocaleString()}
                                          )
                                        </span>
                                      </li>
                                      <li>
                                        <strong>Residual Land Value:</strong>{" "}
                                        {`${residualSummary.transactionPrice} - ${residualSummary.currentBuildingValue} = $${residualSummary.residualLandValue.toLocaleString()}`}{" "}
                                        <span className="text-gray-500">
                                          (${residualSummary.residualLandValue.toLocaleString()}
                                          )
                                        </span>
                                      </li>
                                      <li>
                                        <strong>Land Price per SQM:</strong>{" "}
                                         {`${residualSummary.residualLandValue} / ${residualSummary.landAreaForCalculation} = $${residualSummary.landPricePerSqm.toLocaleString()}`}{" "}
                                        <span className="text-gray-500">
                                          (${residualSummary.landPricePerSqm.toLocaleString()})
                                        </span>
                                      </li>
                                    </ul>
                                  </div>
                              )}
                          </>
                        )}

                        {/* Building Units */}
                        {building.buildingUnits &&
                          building.buildingUnits.length > 0 && (
                            <>
                              <Separator />
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-semibold flex items-center gap-2">
                                    <Home className="h-4 w-4" />
                                    Units ({building.buildingUnits.length})
                                  </h5>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {building.buildingUnits.map(
                                    (unit: any, unitIndex: number) => (
                                      <div
                                        key={
                                          unit.buildingUnitId ||
                                          `unit-${unitIndex}`
                                        }
                                        className="p-3 bg-muted/30 rounded-lg border border-muted"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div>
                                            <p className="font-semibold">
                                              Unit {unit.unitNo}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Floor {unit.floorNo}
                                            </p>
                                          </div>
                                          {unit.unitType && (
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {unit.unitType}
                                            </Badge>
                                          )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                          {unit.floorAreaSqm && (
                                            <div>
                                              <p className="text-muted-foreground">
                                                Floor Area
                                              </p>
                                              <p className="font-semibold">
                                                {unit.floorAreaSqm} m²
                                              </p>
                                            </div>
                                          )}
                                          {unit.totalAreaSqm && (
                                            <div>
                                              <p className="text-muted-foreground">
                                                Total Area
                                              </p>
                                              <p className="font-semibold">
                                                {unit.totalAreaSqm} m²
                                              </p>
                                            </div>
                                          )}
                                        </div>

                                        {(unit.numberOfBedrooms ||
                                          unit.numberOfBathrooms) && (
                                          <div className="flex gap-3 text-xs">
                                            {unit.numberOfBedrooms && (
                                              <div className="flex items-center gap-1">
                                                <Bed className="h-3 w-3 text-muted-foreground" />
                                                <span>
                                                  {unit.numberOfBedrooms}
                                                </span>
                                              </div>
                                            )}
                                            {unit.numberOfBathrooms && (
                                              <div className="flex items-center gap-1">
                                                <Bath className="h-3 w-3 text-muted-foreground" />
                                                <span>
                                                  {unit.numberOfBathrooms}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {(unit.hasKitchen ||
                                          unit.hasLivingRoom ||
                                          unit.hasParkingSpace) && (
                                          <div className="mt-2 pt-2 border-t border-muted text-xs flex flex-wrap gap-2">
                                            {unit.hasKitchen && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                Kitchen
                                              </Badge>
                                            )}
                                            {unit.hasLivingRoom && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                Living Room
                                              </Badge>
                                            )}
                                            {unit.hasParkingSpace && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                Parking
                                              </Badge>
                                            )}
                                          </div>
                                        )}

                                        {/* Unit Cost Information */}
                                        {(unit.costPerSqm ||
                                          unit.replacementCostPerSqm ||
                                          unit.totalBuildingCost) && (
                                          <div className="mt-2 pt-2 border-t border-muted">
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              {unit.costPerSqm && (
                                                <div className="p-2 bg-green-50 rounded border border-green-200">
                                                  <p className="text-green-600 mb-0.5">
                                                    Cost/m²
                                                  </p>
                                                  <p className="font-bold text-green-700">
                                                    $
                                                    {Number(
                                                      unit.costPerSqm
                                                    ).toLocaleString()}
                                                  </p>
                                                </div>
                                              )}
                                              {unit.replacementCostPerSqm && (
                                                <div className="p-2 bg-orange-50 rounded border border-orange-200">
                                                  <p className="text-orange-600 mb-0.5">
                                                    Replace/m²
                                                  </p>
                                                  <p className="font-bold text-orange-700">
                                                    $
                                                    {Number(
                                                      unit.replacementCostPerSqm
                                                    ).toLocaleString()}
                                                  </p>
                                                </div>
                                              )}
                                              {unit.totalBuildingCost && (
                                                <div className="p-2 bg-blue-50 rounded border border-blue-200 col-span-2">
                                                  <p className="text-blue-600 mb-0.5">
                                                    Total Cost
                                                  </p>
                                                  <p className="font-bold text-blue-700">
                                                    $
                                                    {Number(
                                                      unit.totalBuildingCost
                                                    ).toLocaleString()}
                                                  </p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* 📊 Depreciation Calculation for Building Units */}
                                        {unit.floorAreaSqm &&
                                          unit.replacementCostPerSqm &&
                                          unit.effectiveAge != null &&
                                          unit.usefulLife && (
                                            <div className="mt-2 pt-2 border-t border-muted">
                                              <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                                                <p className="text-xs font-semibold text-purple-900 mb-2 flex items-center gap-1">
                                                  <TrendingUp className="h-3 w-3" />
                                                  Cost Approach Valuation
                                                </p>

                                                {(() => {
                                                  const floorArea = parseFloat(
                                                    unit.floorAreaSqm
                                                  );
                                                  const replacementCost =
                                                    parseFloat(
                                                      unit.replacementCostPerSqm
                                                    );
                                                  const effectiveAge =
                                                    parseFloat(
                                                      unit.effectiveAge
                                                    );
                                                  const usefulLife = parseFloat(
                                                    unit.usefulLife
                                                  );

                                                  const newBuildingCost =
                                                    floorArea * replacementCost;
                                                  const depreciationRatio =
                                                    usefulLife > 0
                                                      ? effectiveAge /
                                                        usefulLife
                                                      : 0;
                                                  const depreciationAmount =
                                                    newBuildingCost *
                                                    depreciationRatio;
                                                  const currentValue =
                                                    newBuildingCost -
                                                    depreciationAmount;
                                                  const remainingLife =
                                                    usefulLife - effectiveAge;

                                                  return (
                                                    <div className="space-y-2 text-[10px]">
                                                      <div className="grid grid-cols-2 gap-1.5">
                                                        <div className="bg-white/70 p-1.5 rounded">
                                                          <p className="text-gray-600 mb-0.5">
                                                            New Cost
                                                          </p>
                                                          <p className="font-bold text-purple-900 text-xs">
                                                            $
                                                            {newBuildingCost.toLocaleString(
                                                              "en-US",
                                                              {
                                                                maximumFractionDigits: 0,
                                                              }
                                                            )}
                                                          </p>
                                                        </div>
                                                        <div className="bg-white/70 p-1.5 rounded">
                                                          <p className="text-gray-600 mb-0.5">
                                                            Depreciation
                                                          </p>
                                                          <p className="font-bold text-orange-600 text-xs">
                                                            {(
                                                              depreciationRatio *
                                                              100
                                                            ).toFixed(1)}
                                                            %
                                                          </p>
                                                        </div>
                                                        <div className="bg-white/70 p-1.5 rounded">
                                                          <p className="text-gray-600 mb-0.5">
                                                            Deprec. Amt
                                                          </p>
                                                          <p className="font-bold text-red-600 text-xs">
                                                            -$
                                                            {depreciationAmount.toLocaleString(
                                                              "en-US",
                                                              {
                                                                maximumFractionDigits: 0,
                                                              }
                                                            )}
                                                          </p>
                                                        </div>
                                                        <div className="bg-green-50 p-1.5 rounded border border-green-300">
                                                          <p className="text-green-700 mb-0.5 font-medium">
                                                            Current Value
                                                          </p>
                                                          <p className="font-bold text-green-600 text-sm">
                                                            $
                                                            {currentValue.toLocaleString(
                                                              "en-US",
                                                              {
                                                                maximumFractionDigits: 0,
                                                              }
                                                            )}
                                                          </p>
                                                        </div>
                                                      </div>
                                                      <div className="bg-indigo-100 p-1.5 rounded text-center">
                                                        <p className="text-indigo-800 font-medium">
                                                          ⏳{" "}
                                                          {remainingLife > 0
                                                            ? remainingLife
                                                            : 0}
                                                          y (
                                                          {(
                                                            (1 -
                                                              depreciationRatio) *
                                                            100
                                                          ).toFixed(0)}
                                                          %)
                                                        </p>
                                                      </div>
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                          )}

                                        {/* Unit Year and Condition */}
                                        {(unit.constructedYear ||
                                          unit.physical_condition ||
                                          unit.viewType) && (
                                          <div className="mt-2 pt-2 border-t border-muted">
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              {unit.constructedYear && (
                                                <div>
                                                  <p className="text-muted-foreground">
                                                    Built
                                                  </p>
                                                  <p className="font-semibold">
                                                    {unit.constructedYear}
                                                  </p>
                                                </div>
                                              )}
                                              {unit.physical_condition && (
                                                <div>
                                                  <p className="text-muted-foreground">
                                                    Condition
                                                  </p>
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs mt-0.5"
                                                  >
                                                    {formatPhysicalCondition(
                                                      unit.physical_condition
                                                    )}
                                                  </Badge>
                                                </div>
                                              )}
                                              {unit.viewType && (
                                                <div className="col-span-2">
                                                  <p className="text-muted-foreground mb-0.5">
                                                    View
                                                  </p>
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs"
                                                  >
                                                    <Eye className="h-3 w-3 mr-1" />
                                                    {unit.viewType.replace(
                                                      /_/g,
                                                      " "
                                                    )}
                                                  </Badge>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {unit.managementFee && (
                                          <div className="mt-2 pt-2 border-t border-muted text-xs">
                                            <p className="text-muted-foreground mb-0.5">
                                              Management Fee
                                            </p>
                                            <p className="font-semibold">
                                              ${unit.managementFee}/month
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Direct Unit Entry (when units are not inside buildings) */}
            {property.buildingUnits && property.buildingUnits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-primary" />
                    Property Units
                    <Badge variant="secondary" className="ml-2">
                      {property.buildingUnits.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {property.buildingUnits.map(
                      (unit: any, unitIndex: number) => (
                        <Card
                          key={unit.buildingUnitId || `unit-${unitIndex}`}
                          className="border-2"
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-semibold text-lg">
                                  Unit {unit.unitNo}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Floor {unit.floorNo}
                                </p>
                              </div>
                              {unit.unitType && (
                                <Badge variant="outline" className="text-sm">
                                  {unit.unitType.replace("_", " ")}
                                </Badge>
                              )}
                            </div>

                            {/* Area Information */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              {unit.floorAreaSqm && (
                                <div className="text-center p-3 bg-muted/50 rounded">
                                  <Square className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <p className="text-lg font-bold">
                                    {Number(unit.floorAreaSqm).toLocaleString()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Floor Area (m²)
                                  </p>
                                </div>
                              )}
                              {unit.totalAreaSqm && (
                                <div className="text-center p-3 bg-muted/50 rounded">
                                  <Square className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                  <p className="text-lg font-bold">
                                    {Number(unit.totalAreaSqm).toLocaleString()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Total Area (m²)
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Room Information */}
                            {(unit.numberOfBedrooms ||
                              unit.numberOfBathrooms) && (
                              <div className="flex justify-center gap-6 mb-4">
                                {unit.numberOfBedrooms && (
                                  <div className="flex items-center gap-2">
                                    <Bed className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {unit.numberOfBedrooms} Bedrooms
                                    </span>
                                  </div>
                                )}
                                {unit.numberOfBathrooms && (
                                  <div className="flex items-center gap-2">
                                    <Bath className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {unit.numberOfBathrooms} Bathrooms
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Amenities */}
                            {(unit.hasKitchen ||
                              unit.hasLivingRoom ||
                              unit.hasParkingSpace) && (
                              <>
                                <Separator className="my-3" />
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {unit.hasKitchen && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Kitchen
                                    </Badge>
                                  )}
                                  {unit.hasLivingRoom && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Living Room
                                    </Badge>
                                  )}
                                  {unit.hasParkingSpace && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Parking Space
                                    </Badge>
                                  )}
                                </div>
                              </>
                            )}

                            {/* Cost Information */}
                            {(unit.costPerSqm ||
                              unit.replacementCostPerSqm ||
                              unit.totalBuildingCost) && (
                              <>
                                <Separator className="my-3" />
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  {unit.costPerSqm && (
                                    <div className="p-3 bg-green-50 rounded border border-green-200">
                                      <p className="text-xs text-green-600 mb-1">
                                        Cost per m²
                                      </p>
                                      <div className="flex items-baseline gap-1">
                                        <DollarSign className="h-4 w-4 text-green-600" />
                                        <p className="text-lg font-bold text-green-700">
                                          {Number(
                                            unit.costPerSqm
                                          ).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {unit.replacementCostPerSqm && (
                                    <div className="p-3 bg-orange-50 rounded border border-orange-200">
                                      <p className="text-xs text-orange-600 mb-1">
                                        Replacement Cost/m²
                                      </p>
                                      <div className="flex items-baseline gap-1">
                                        <DollarSign className="h-4 w-4 text-orange-600" />
                                        <p className="text-lg font-bold text-orange-700">
                                          {Number(
                                            unit.replacementCostPerSqm
                                          ).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {unit.totalBuildingCost && (
                                    <div className="p-3 bg-blue-50 rounded border border-blue-200 col-span-2">
                                      <p className="text-xs text-blue-600 mb-1">
                                        Total Building Cost
                                      </p>
                                      <div className="flex items-baseline gap-1">
                                        <DollarSign className="h-4 w-4 text-blue-600" />
                                        <p className="text-lg font-bold text-blue-700">
                                          {Number(
                                            unit.totalBuildingCost
                                          ).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
{/* 
                            

                            {/* Additional Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {unit.constructedYear && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    Built Year
                                  </p>
                                  <p className="font-semibold">
                                    {unit.constructedYear}
                                  </p>
                                </div>
                              )}
                              {unit.physical_condition && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    Condition
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {formatPhysicalCondition(
                                      unit.physical_condition
                                    )}
                                  </Badge>
                                </div>
                              )}
                              {unit.viewType && unit.viewType !== "NO_VIEW" && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    View Type
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    <Eye className="h-3 w-3 mr-1" />
                                    {formatViewTypeLabel(unit.viewType)}
                                  </Badge>
                                </div>
                              )}
                              {unit.managementFee && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    Management Fee
                                  </p>
                                  {unit.managementFee === "FREE" ? (
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-green-50 text-green-700 border-green-200"
                                    >
                                      FREE
                                    </Badge>
                                  ) : (
                                    <p className="font-semibold">
                                      ${unit.managementFee}/month
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Title Document */}
            {property.titleDocument && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Certificate of Ownership
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Title Deed Type
                      </p>
                      <Badge variant="secondary">
                        {property.titleDocument.titleDeedType}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Title Deed No
                      </p>
                      <p className="font-semibold font-mono text-sm">
                        {property.titleDocument.titleDeedNo}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        TotalSize By TitleDeed
                      </p>
                      <p className="font-semibold">
                        {Number(
                          property.titleDocument.totalSizeByTitleDeed
                        ).toLocaleString()}{" "}
                        m²
                      </p>
                    </div>
                  </div>

                  {(property.titleDocument.coverPhotoUrl ||
                    property.titleDocument.backSidePhotoUrl) && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        {property.titleDocument.coverPhotoUrl && (
                          <div
                            className="cursor-pointer"
                            onClick={() =>
                              openImageViewer(
                                property.titleDocument.coverPhotoUrl
                              )
                            }
                          >
                            <p className="text-xs text-muted-foreground mb-2">
                              Cover Photo
                            </p>
                            <img
                              src={property.titleDocument.coverPhotoUrl}
                              alt="Title Deed Cover"
                              className="w-full h-40 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                            />
                          </div>
                        )}
                        {property.titleDocument.backSidePhotoUrl && (
                          <div
                            className="cursor-pointer"
                            onClick={() =>
                              openImageViewer(
                                property.titleDocument.backSidePhotoUrl
                              )
                            }
                          >
                            <p className="text-xs text-muted-foreground mb-2">
                              Back Side
                            </p>
                            <img
                              src={property.titleDocument.backSidePhotoUrl}
                              alt="Title Deed Back"
                              className="w-full h-40 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Transaction Information */}
            <Card className="border-2 border-green-200 dark:border-green-900 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-700 dark:text-green-400" />
                  </div>
                  <div>
                    Transaction History
                    <p className="text-xs font-normal text-muted-foreground mt-0.5">
                      Record of price changes and valuations
                    </p>
                  </div>
                  {transactions.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    >
                      {transactions.length} Records
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-6 bg-slate-50/30 dark:bg-slate-950/10">
                {transactions.length > 0 ? (
                  <div className="space-y-6">
                    {transactions.map(
                      (transaction: any, idx: number) => (
                        <div
                          key={transaction.transactionId}
                          className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                        >
                          {/* Status Strip */}
                          <div
                            className={`h-1 w-full ${
                              idx === 0
                                ? "bg-green-500"
                                : "bg-slate-200 dark:bg-slate-700"
                            }`}
                          />

                          <div className="p-5">
                            {/* Header Section */}
                            <div className="flex justify-between items-start mb-6">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={getTransactionBadgeVariant(
                                      transaction.transactionType
                                    )}
                                  >
                                    {formatTransactionTypeLabel(
                                      transaction.transactionType
                                    )}
                                  </Badge>
                                  {idx === 0 && (
                                    <span className="text-[10px] font-bold tracking-wider text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full uppercase">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(
                                    transaction.transactionDate
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </div>
                              </div>

                              <div className="absolute top-4 right-4 z-10">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  onClick={() =>
                                    initiateDelete(transaction.transactionId)
                                  } // <--- Open Modal
                                  title="Delete record"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Price Section */}
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-dashed border-slate-200 dark:border-slate-800">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                  Total Transaction Price
                                </p>
                                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                  $
                                  {Number(
                                    transaction.totalPrice
                                  ).toLocaleString()}
                                </p>
                              </div>
                              {transaction.pricePerSqm && (
                                <div className="text-right">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                    Price per Sqm
                                  </p>
                                  <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                                    $
                                    {Number(
                                      transaction.pricePerSqm
                                    ).toLocaleString()}{" "}
                                    <span className="text-sm font-normal text-muted-foreground">
                                      /m²
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Valuation Details (Collapsible-like look) */}
                            {(transaction.residualLandValue ||
                              transaction.newBuildingCost) && (
                              <div className="mt-5 space-y-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                  <TrendingUp className="h-4 w-4 text-blue-500" />
                                  Valuation Method:
                                  <span className="font-normal text-muted-foreground">
                                    {transaction.residualLandValue
                                      ? "Residual (Land & Building)"
                                      : "Cost (Building Only)"}
                                  </span>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {/* New Building Cost */}
                                  {transaction.newBuildingCost && (
                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                        Building Cost
                                      </p>
                                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                                        $
                                        {Number(
                                          transaction.newBuildingCost
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  )}

                                  {/* Depreciation */}
                                  {transaction.depreciationAmount && (
                                    <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30">
                                      <p className="text-[10px] uppercase tracking-wider text-red-600/70 dark:text-red-400/70 mb-1">
                                        Depreciation
                                      </p>
                                      <p className="font-semibold text-red-600 dark:text-red-400">
                                        -$
                                        {Number(
                                          transaction.depreciationAmount
                                        ).toLocaleString()}
                                      </p>
                                      {transaction.depreciationRatio && (
                                        <p className="text-[10px] text-red-500 mt-0.5">
                                          Ratio:{" "}
                                          {(
                                            transaction.depreciationRatio * 100
                                          ).toFixed(1)}
                                          %
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* Current Building Value */}
                                  {transaction.currentBuildingValue && (
                                    <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30">
                                      <p className="text-[10px] uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 mb-1">
                                        Current Bldg Value
                                      </p>
                                      <p className="font-semibold text-blue-600 dark:text-blue-400">
                                        $
                                        {Number(
                                          transaction.currentBuildingValue
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  )}

                                  {/* Residual Land Value (Full Width if present) */}
                                  {transaction.residualLandValue && (
                                    <div className="col-span-2 md:col-span-3 p-3 rounded-lg bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/30 flex justify-between items-center">
                                      <div>
                                        <p className="text-[10px] uppercase tracking-wider text-green-700/70 dark:text-green-400/70 mb-0.5">
                                          Residual Land Value
                                        </p>
                                        <p className="font-bold text-lg text-green-700 dark:text-green-400">
                                          $
                                          {Number(
                                            transaction.residualLandValue
                                          ).toLocaleString()}
                                        </p>
                                      </div>
                                      {/* Optional visual indicator */}
                                      <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                        <MapPin className="h-4 w-4 text-green-600" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="h-12 w-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                      <DollarSign className="h-6 w-6 text-slate-300" />
                    </div>
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">
                      No History Available
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Transaction records and valuation history will appear here
                      once added.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Location Analysis - Nearby Amenities */}
            {locationAnalysis && !isLoadingLocation && (
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Navigation className="h-5 w-5 text-primary" />
                      Location Analysis
                    </CardTitle>
                    <Badge variant="default" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      {locationAnalysis.summary?.locationRating || "N/A"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Location Score Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
                        {locationAnalysis.summary?.locationScore || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Location Score
                      </p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">
                        {locationAnalysis.summary?.totalNearbyProperties || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Nearby Properties
                      </p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">
                        {(locationAnalysis.summary?.totalNearbySchools || 0) +
                          (locationAnalysis.summary?.totalNearbyHospitals ||
                            0) +
                          (locationAnalysis.summary?.totalNearbyRestaurants ||
                            0) +
                          (locationAnalysis.summary?.totalNearbyBanks || 0) +
                          (locationAnalysis.summary?.totalNearbySupermarkets ||
                            0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total Amenities
                      </p>
                    </div>
                  </div>

                  {/* Nearby Amenities Categories */}
                  <div className="space-y-4">
                    {/* Schools */}
                    {locationAnalysis.nearbyAmenities?.schools &&
                      locationAnalysis.nearbyAmenities.schools.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-blue-600" />
                              Schools Nearby
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysis.summary?.totalNearbySchools ||
                                0}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {locationAnalysis.nearbyAmenities.schools.map(
                              (school: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">
                                      {school.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {school.address}
                                    </p>
                                    {school.rating && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-medium">
                                          {school.rating}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {school.distance}m
                                  </Badge>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Hospitals */}
                    {locationAnalysis.nearbyAmenities?.hospitals &&
                      locationAnalysis.nearbyAmenities.hospitals.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Stethoscope className="h-4 w-4 text-red-600" />
                              Healthcare Facilities
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysis.summary?.totalNearbyHospitals ||
                                0}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {locationAnalysis.nearbyAmenities.hospitals.map(
                              (hospital: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">
                                      {hospital.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {hospital.address}
                                    </p>
                                    {hospital.rating && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-medium">
                                          {hospital.rating}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {hospital.distance}m
                                  </Badge>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Restaurants */}
                    {locationAnalysis.nearbyAmenities?.restaurants &&
                      locationAnalysis.nearbyAmenities.restaurants.length >
                        0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <UtensilsCrossed className="h-4 w-4 text-orange-600" />
                              Restaurants & Dining
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysis.summary
                                ?.totalNearbyRestaurants || 0}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {locationAnalysis.nearbyAmenities.restaurants.map(
                              (restaurant: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between p-3 bg-orange-50/50 dark:bg-orange-950/20 rounded-lg border border-orange-100 dark:border-orange-900"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {restaurant.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {restaurant.rating && (
                                        <div className="flex items-center gap-1">
                                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                          <span className="text-xs font-medium">
                                            {restaurant.rating}
                                          </span>
                                        </div>
                                      )}
                                      {restaurant.priceLevel && (
                                        <span className="text-xs text-muted-foreground">
                                          {"$".repeat(restaurant.priceLevel)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="text-xs ml-2"
                                  >
                                    {restaurant.distance}m
                                  </Badge>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Banks */}
                    {locationAnalysis.nearbyAmenities?.banks &&
                      locationAnalysis.nearbyAmenities.banks.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Landmark className="h-4 w-4 text-green-600" />
                              Banks & ATMs
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysis.summary?.totalNearbyBanks || 0}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {locationAnalysis.nearbyAmenities.banks.map(
                              (bank: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between p-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg border border-green-100 dark:border-green-900"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">
                                      {bank.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {bank.address}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {bank.distance}m
                                  </Badge>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Supermarkets */}
                    {locationAnalysis.nearbyAmenities?.supermarkets &&
                      locationAnalysis.nearbyAmenities.supermarkets.length >
                        0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <ShoppingCart className="h-4 w-4 text-purple-600" />
                              Supermarkets
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysis.summary
                                ?.totalNearbySupermarkets || 0}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {locationAnalysis.nearbyAmenities.supermarkets.map(
                              (market: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-100 dark:border-purple-900"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">
                                      {market.name}
                                    </p>
                                    {market.rating && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-medium">
                                          {market.rating}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {market.distance}m
                                  </Badge>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Nearby Properties */}
                  {locationAnalysis.nearbyProperties &&
                    locationAnalysis.nearbyProperties.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              Nearby Properties
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {locationAnalysis.nearbyProperties.length}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {locationAnalysis.nearbyProperties.map(
                              (prop: any) => (
                                <Card
                                  key={prop.id}
                                  className="border-2 hover:border-primary/50 transition-colors cursor-pointer"
                                  onClick={() =>
                                    router.push(
                                      `/dashboard/property/${prop.id}`
                                    )
                                  }
                                >
                                  <CardContent className="pt-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">
                                          {prop.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {prop.code}
                                        </p>
                                      </div>
                                      <Badge
                                        variant={
                                          prop.status === "ACTIVE"
                                            ? "default"
                                            : "secondary"
                                        }
                                        className="text-xs ml-2"
                                      >
                                        {prop.status}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center justify-between mt-3">
                                      <div>
                                        <p className="text-xs text-muted-foreground">
                                          Type
                                        </p>
                                        <p className="text-sm font-medium">
                                          {prop.type}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-muted-foreground">
                                          Distance
                                        </p>
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {prop.distance} km
                                        </Badge>
                                      </div>
                                    </div>
                                    {prop.price && (
                                      <div className="mt-3 pt-3 border-t">
                                        <div className="flex items-center gap-1">
                                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                                          <span className="font-bold text-primary">
                                            {Number(
                                              prop.price
                                            ).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )
                            )}
                          </div>
                        </div>
                      </>
                    )}
                </CardContent>
              </Card>
            )}

            {isLocationAnalysisError && !isLoadingLocation && (
              <Card className="border border-dashed border-amber-300 bg-amber-50/40 dark:bg-amber-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Navigation className="h-5 w-5" />
                    Location Analysis Unavailable
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Unable to load nearby amenities right now.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchLocationAnalysis()}
                  >
                    Retry
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">
                    Property Code
                  </span>
                  <Badge variant="outline" className="font-mono">
                    {property.propertyCode}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">
                    Buildings
                  </span>
                  <span className="font-semibold">
                    {property.building?.length || 0}
                  </span>
                </div>
                {property.buildingUnits &&
                  property.buildingUnits.length > 0 && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-muted-foreground">
                          Units
                        </span>
                        <span className="font-semibold">
                          {property.buildingUnits.length}
                        </span>
                      </div>
                    </>
                  )}
                {property.land && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">
                        Land Area
                      </span>
                      <span className="font-semibold">
                        {property.land.landAreaSqm
                          ? `${Number(
                              property.land.landAreaSqm
                            ).toLocaleString()} m²`
                          : "N/A"}
                      </span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Photos</span>
                  <span className="font-semibold">{allImages.length}</span>
                </div>
              </CardContent>
            </Card>
            {/* Data Source / Contact Information */}
            {property.dataSource && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Data Source
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Source Type
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {property.dataSource.sourceType}
                    </Badge>
                  </div>
                  <Separator />
                  {property.dataSource.contactName && (
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Contact Name
                        </p>
                        <p className="text-sm font-medium">
                          {property.dataSource.contactName}
                        </p>
                      </div>
                    </div>
                  )}
                  {property.dataSource.phoneNumber && (
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Phone Number
                        </p>
                        <p className="text-sm font-medium">
                          {property.dataSource.phoneNumber}
                        </p>
                      </div>
                    </div>
                  )}
                  {property.dataSource.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Email
                        </p>
                        <p className="text-xs font-medium truncate">
                          {property.dataSource.email}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Created By User */}
            {property.createdByUser && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Created By
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-primary/20">
                      <AvatarImage
                        src={property.createdByUser.profilePicture || undefined}
                        alt={property.createdByUser.username}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {property.createdByUser.firstName?.[0] ||
                          property.createdByUser.username?.[0] ||
                          "U"}
                        {property.createdByUser.lastName?.[0] || ""}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {property.createdByUser.firstName &&
                        property.createdByUser.lastName
                          ? `${property.createdByUser.firstName} ${property.createdByUser.lastName}`
                          : property.createdByUser.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{property.createdByUser.username}
                      </p>
                      <Badge
                        variant={
                          property.createdByUser.status === "ACTIVE"
                            ? "default"
                            : "secondary"
                        }
                        className="mt-1 text-xs"
                      >
                        {property.createdByUser.status}
                      </Badge>
                    </div>
                  </div>
                  <Separator />
                  {property.createdByUser.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Email
                        </p>
                        <p className="text-xs font-medium truncate">
                          {property.createdByUser.email}
                        </p>
                      </div>
                    </div>
                  )}
                  {property.createdByUser.phone && (
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Phone
                        </p>
                        <p className="text-xs font-medium">
                          {property.createdByUser.phone}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
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
                    {new Date(property.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Last Updated
                  </p>
                  <p className="font-medium">
                    {new Date(property.updatedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {property.createdByUser?.lastLogin && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Creator Last Login
                      </p>
                      <p className="font-medium">
                        {new Date(
                          property.createdByUser.lastLogin
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          {/* 🗑️ DELETE CONFIRMATION MODAL */}
          <AlertDialog
            open={!!transactionToDelete}
            onOpenChange={(open) => !open && setTransactionToDelete(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  Delete Transaction Record?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  this transaction history record from the database.
                  <br />
                  <br />
                  The property's current valuation will revert to the next most
                  recent record.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={deleteTransactionMutation.isPending}
                >
                  Cancel
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault(); // Prevent auto-closing
                    confirmDelete();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                  disabled={deleteTransactionMutation.isPending}
                >
                  {deleteTransactionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Record"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
    </>
  );
}
