"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { useProperty, useUpdateProperty } from "@/hooks/useProperty";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Home,
  Plus,
  ArrowLeft,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
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
import { BasicInfoTab } from "@/components/property/BasicInfoTab";
import { LandInformationCard } from "@/components/property/LandInformationCard";
import { AddressTab } from "@/components/property/AddressTab";
import { DocumentsTab } from "@/components/property/DocumentsTab";
import { DataSourceTab } from "@/components/property/DataSourceTab";
import { TransactionTab } from "@/components/property/TransactionTab";
import { PhotoUploadTab } from "@/components/property/PhotoUploadTab";
import { PropertyNavigationFooter } from "@/components/property/PropertyNavigationFooter";
import { PropertyPageHeader } from "@/components/property/PropertyPageHeader";
import { PropertyBuildingCard } from "@/components/property/PropertyBuildingCard";
import { PropertyUnitCard } from "@/components/property/PropertyUnitCard";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import type { BuildingData } from "@/types/property.types";
import type { DrawnShape } from "@/types/googleMap.types";
import { useAuth } from "@/hooks/auth/useAuth";
import { getUnitTypeOptions } from "@/constants/buildingUnitOptions";
import { normalizePhysicalCondition } from "@/utils/physicalCondition";
import { convertShapesToGeoJson, logPolygonInfo } from "@/utils/geoJsonConverter";
import type { GeoJsonPolygon } from "@/hooks/propertyValuation/propertyValuation.types";
import {
  toConstructionPercentageNumber,
  toConstructionPercentageSelectValue,
} from "@/utils/constructionPercentage";
import { normalizeTransactionType } from "@/constants/transactionOptions";
import { propertyAddressService } from "@/hooks/propertyAddress/propertyAddress.service";
import {
  ensureResolvedAddressHierarchy,
  getAddressEntityCode,
  toResolvedAddressItem,
  completeResolvedHierarchyFromDetectedAddress,
  type ResolvedAddressDraft,
} from "@/utils/propertyAddressResolution";
import type { ResolvedAddressHierarchyItems } from "@/types/propertyAddress.types";

// Helper function to clean rejection reasons from description
function cleanRejectionReasons(description: string): string {
  if (!description) return "";
  
  // Remove rejection reason patterns like:
  // "\n\nRejection Reason (2/3/2026): review again"
  const rejectionPattern = /\n*Rejection Reason \([^)]+\):[^\n]*/g;
  let cleaned = description.replace(rejectionPattern, "");
  
  // Remove excessive newlines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  
  // Trim leading/trailing whitespace
  return cleaned.trim();
}

const toDateInputValue = (value?: string | null) => {
  if (!value) {
    return new Date().toISOString().split("T")[0];
  }
  return value.split("T")[0];
};

const DEFAULT_ADDRESS_LATITUDE = 11.5564;
const DEFAULT_ADDRESS_LONGITUDE = 104.9282;
const EMPTY_RESOLVED_ADDRESS_ITEMS: ResolvedAddressHierarchyItems = {
  province: null,
  district: null,
  commune: null,
  village: null,
};

const pickFirstNonEmpty = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }

  return null;
};

const parseCoordinatePairInput = (
  value: string
): { latitude: string; longitude: string } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[,/\s]+\s*(-?\d+(?:\.\d+)?)\s*$/u
  );
  if (!match) return null;

  const latitude = Number.parseFloat(match[1]);
  const longitude = Number.parseFloat(match[2]);

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
  };
};

const ALLOWED_BUILDING_VIEW_TYPES = [
  "CITY_VIEW",
  "PARK_VIEW",
  "RIVER_VIEW",
  "SEA_VIEW",
  "MOUNTAIN_VIEW",
  "NO_VIEW",
] as const;

const ALLOWED_BUILDING_STATUSES = [
  "EXISTING_CONSTRUCTION",
  "UNDER_CONSTRUCTION",
  "COMPLETED",
] as const;

const normalizeBuildingViewType = (value?: string | null) => {
  const raw = (value || "").trim().toUpperCase();
  if (
    ALLOWED_BUILDING_VIEW_TYPES.includes(
      raw as (typeof ALLOWED_BUILDING_VIEW_TYPES)[number]
    )
  ) {
    return raw;
  }
  return "CITY_VIEW";
};

const normalizeBuildingStatus = (value?: string | null) => {
  const raw = (value || "").trim().toUpperCase();

  if (
    ALLOWED_BUILDING_STATUSES.includes(
      raw as (typeof ALLOWED_BUILDING_STATUSES)[number]
    )
  ) {
    return raw;
  }

  if (raw === "EXISTING" || raw === "EXISTING_BUILDING") {
    return "EXISTING_CONSTRUCTION";
  }

  if (raw === "UNDERCONSTRUCTION" || raw === "IN_PROGRESS") {
    return "UNDER_CONSTRUCTION";
  }

  return "COMPLETED";
};

export default function EditPropertyPage() {
  const t = useTranslations("properties");
  const tCommon = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const propertyId = Number(params?.id || 0);
  const { hasHierarchyLevel, user, highestRole } = useAuth();
  const canSelectStatus = hasHierarchyLevel(2);
  const canSelectWorkflowStatus = hasHierarchyLevel(2);
  const isDataEntry =
    highestRole?.hierarchyLevel === 4 ||
    (highestRole?.roleCode ?? "").toUpperCase() === "DATA_ENTRY";

  
  const propertyTypes = usePropertyTypes();

  // Fetch property data
  const {
    data: property,
    isLoading: isLoadingProperty,
    error,
  } = useProperty(propertyId);

  const updateMutation = useUpdateProperty();

  const [currentTab, setCurrentTab] = useState("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [isDirty, setIsDirty] = useState(false);
  const [expandedBuildings, setExpandedBuildings] = useState<
    Record<number, boolean>
  >({});
  const hasLoadedData = useRef(false); // Track if we've loaded data once
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [shapes, setShapes] = useState<DrawnShape[]>([]);
  const [existingPolygon, setExistingPolygon] = useState<GeoJsonPolygon | null>(
    null
  );
  const [polygonGeoJson, setPolygonGeoJson] = useState<GeoJsonPolygon | null>(
    null
  );
  const hadPolygonDrawnRef = useRef(false);
  const originalPolygonRef = useRef<GeoJsonPolygon | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const originalDataRef = useRef<{
    formData: typeof formData | null;
    addressCodes: typeof addressCodes | null;
    resolvedAddressItems: ResolvedAddressHierarchyItems | null;
    photoPreview: typeof photoPreview | null;
  }>({
    formData: null,
    addressCodes: null,
    resolvedAddressItems: null,
    photoPreview: null,
  });

  // Photo state
  const [photos, setPhotos] = useState({
    frontSide: null as File | null,
    inside: null as File | null,
    leftSide: null as File | null,
    rightSide: null as File | null,
    opposite: null as File | null,
    gallery: [] as File[],
    coverPhoto: null as File | null,
    backSidePhoto: null as File | null,
    buildingImage: null as File | null,
    buildingImages: [] as File[][], // Multi-image support per building
  });

  const [imagesToDelete, setImagesToDelete] = useState({
    frontSide: false,
    inside: false,
    leftSide: false,
    rightSide: false,
    opposite: false,
    buildingImage: false,
    coverPhoto: false,
    backSidePhoto: false,
    gallery: [] as number[], // Track building image indices to delete
  });

  const [photoPreview, setPhotoPreview] = useState({
    frontSide: "",
    inside: "",
    leftSide: "",
    rightSide: "",
    opposite: "",
    gallery: [] as string[],
    coverPhoto: "",
    backSidePhoto: "",
    buildingImage: "",
    buildingImages: [] as string[][], // Multi-image preview per building
  });

  const [formData, setFormData] = useState({
    propertyName: "",
    propertyTypeId: "",
    propertySubtypeId: "",
    currentUseId: "",
    workflowStatus: "",
    status: "",
    description: "",
    provinceId: "",
    districtId: "",
    communeId: "",
    villageId: "",
    street: "",
    houseNo: "",
    latitude: "",
    longitude: "",
    formattedAddress: "",
    placeId: "",
    widthMeters: "",
    lengthMeters: "",
    landAreaSqm: "",
    totalFloors: "",
    builtYear: "",
    buildingAreaSqm: "",
    floorAreaSqm: "",
    bedrooms: "",
    bathrooms: "",
    landShape: "RECTANGLE",
    topography: "LEVEL",
    sitePosition: "",
    waterSource: "",
    typeofTree: "",
    numberOfTrees: "",
    ageOfTrees: "",
    buildings: [] as BuildingData[],
    titleDeedType: "",
    titleDeedNo: "",
    issuedYear: "",
    parcelNo: "",
    totalSizeByTitleDeed: "",
    sourceType: "OWNERSHIP",
    contactName: "",
    phoneNumber: "",
    transactionType: "SALE",
    transactionDate: new Date().toISOString().split("T")[0],
    totalPrice: "",
  });

  // Address codes state for API-based form (note: PropertyAddressForm uses "Id" naming but stores codes)
  const [addressCodes, setAddressCodes] = useState<{
    provinceId: string | null;
    districtId: string | null;
    communeId: string | null;
    villageId: string | null;
  }>({
    provinceId: null,
    districtId: null,
    communeId: null,
    villageId: null,
  });
  const [resolvedAddressItems, setResolvedAddressItems] =
    useState<ResolvedAddressHierarchyItems>(EMPTY_RESOLVED_ADDRESS_ITEMS);
  const lastResolvedAddressKeyRef = useRef("");
  const activeResolveRequestRef = useRef(0);
  const preserveTypedDetectedAddressRef = useRef(false);
  const resolvedCanonicalAddressRef = useRef("");
  const hasAddressResolutionInteractionRef = useRef(false);
  const addressResolutionSourceRef = useRef<"coordinates" | "formattedAddress">(
    "coordinates"
  );

  // Handle address change from PropertyAddressForm
  const handleAddressChange = useCallback(
    (address: {
      provinceId: string | null;
      districtId: string | null;
      communeId: string | null;
      villageId: string | null;
    }) => {
      setAddressCodes(address);
      setResolvedAddressItems(EMPTY_RESOLVED_ADDRESS_ITEMS);
      setFormData((prev) => ({
        ...prev,
        provinceId: address.provinceId || "",
        districtId: address.districtId || "",
        communeId: address.communeId || "",
        villageId: address.villageId || "",
      }));
    },
    []
  );

  // Handle map coordinates change
  const handleMapCoordinatesChange = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      hasAddressResolutionInteractionRef.current = true;
      preserveTypedDetectedAddressRef.current = false;
      addressResolutionSourceRef.current = "coordinates";
      setFormData((prev) => ({
        ...prev,
        latitude: coords.latitude.toFixed(6),
        longitude: coords.longitude.toFixed(6),
      }));
    },
    []
  );

  const applyResolvedAddress = useCallback((resolved: ResolvedAddressDraft) => {
    const hasResolvedHierarchy = Boolean(
      resolved.provinceId ||
        resolved.districtId ||
        resolved.communeId ||
        resolved.villageId
    );

    if (hasResolvedHierarchy) {
      setAddressCodes({
        provinceId: resolved.provinceId ?? null,
        districtId: resolved.districtId ?? null,
        communeId: resolved.communeId ?? null,
        villageId: resolved.villageId ?? null,
      });
      setResolvedAddressItems({
        province: resolved.province ?? null,
        district: resolved.district ?? null,
        commune: resolved.commune ?? null,
        village: resolved.village ?? null,
      });
    }

    resolvedCanonicalAddressRef.current =
      resolved.resolvedFormattedAddress?.trim() ?? "";

    setFormData((prev) => {
      const currentLatitude = Number.parseFloat(prev.latitude);
      const currentLongitude = Number.parseFloat(prev.longitude);
      const shouldPreserveManualCoordinates =
        addressResolutionSourceRef.current === "coordinates" &&
        Number.isFinite(currentLatitude) &&
        currentLatitude >= -90 &&
        currentLatitude <= 90 &&
        Number.isFinite(currentLongitude) &&
        currentLongitude >= -180 &&
        currentLongitude <= 180;

      return {
        ...prev,
        ...(resolved.latitude != null && {
          latitude: shouldPreserveManualCoordinates
            ? prev.latitude
            : resolved.latitude.toFixed(6),
        }),
        ...(resolved.longitude != null && {
          longitude: shouldPreserveManualCoordinates
            ? prev.longitude
            : resolved.longitude.toFixed(6),
        }),
        ...(resolved.formattedAddress &&
          (!preserveTypedDetectedAddressRef.current ||
            !prev.formattedAddress.trim()) && {
            formattedAddress: resolved.formattedAddress,
          }),
        ...(resolved.placeId && {
          placeId: resolved.placeId,
        }),
        ...(!prev.street && resolved.street && { street: resolved.street }),
        ...(!prev.houseNo && resolved.houseNumber && { houseNo: resolved.houseNumber }),
        ...(hasResolvedHierarchy && {
          provinceId: resolved.provinceId ?? "",
          districtId: resolved.districtId ?? "",
          communeId: resolved.communeId ?? "",
          villageId: resolved.villageId ?? "",
        }),
      };
    });
  }, []);

  useEffect(() => {
    const nextCodes = {
      provinceId: pickFirstNonEmpty(
        formData.provinceId,
        addressCodes.provinceId,
        resolvedAddressItems.province?.code
      ),
      districtId: pickFirstNonEmpty(
        formData.districtId,
        addressCodes.districtId,
        resolvedAddressItems.district?.code
      ),
      communeId: pickFirstNonEmpty(
        formData.communeId,
        addressCodes.communeId,
        resolvedAddressItems.commune?.code
      ),
      villageId: pickFirstNonEmpty(
        formData.villageId,
        addressCodes.villageId,
        resolvedAddressItems.village?.code
      ),
    };

    setAddressCodes((prev) => {
      if (
        prev.provinceId === nextCodes.provinceId &&
        prev.districtId === nextCodes.districtId &&
        prev.communeId === nextCodes.communeId &&
        prev.villageId === nextCodes.villageId
      ) {
        return prev;
      }

      return nextCodes;
    });

    setFormData((prev) => {
      const nextFormData = {
        ...prev,
        provinceId: pickFirstNonEmpty(prev.provinceId, nextCodes.provinceId) ?? "",
        districtId: pickFirstNonEmpty(prev.districtId, nextCodes.districtId) ?? "",
        communeId: pickFirstNonEmpty(prev.communeId, nextCodes.communeId) ?? "",
        villageId: pickFirstNonEmpty(prev.villageId, nextCodes.villageId) ?? "",
      };

      if (
        nextFormData.provinceId === prev.provinceId &&
        nextFormData.districtId === prev.districtId &&
        nextFormData.communeId === prev.communeId &&
        nextFormData.villageId === prev.villageId
      ) {
        return prev;
      }

      return nextFormData;
    });
  }, [
    addressCodes.communeId,
    addressCodes.districtId,
    addressCodes.provinceId,
    addressCodes.villageId,
    formData.communeId,
    formData.districtId,
    formData.provinceId,
    formData.villageId,
    resolvedAddressItems.commune?.code,
    resolvedAddressItems.district?.code,
    resolvedAddressItems.province?.code,
    resolvedAddressItems.village?.code,
  ]);

  // Handle reverse geocoding from map
  const handleReverseGeocode = useCallback(async (data: any) => {
    if (!data) return;

    const typedDetectedAddress = formData.formattedAddress.trim();
    const shouldPreferTypedDetectedAddress =
      preserveTypedDetectedAddressRef.current &&
      addressResolutionSourceRef.current === "formattedAddress" &&
      typedDetectedAddress.length >= 6;
    const currentLatitude = Number.parseFloat(formData.latitude);
    const currentLongitude = Number.parseFloat(formData.longitude);
    const hasCurrentCoordinates =
      Number.isFinite(currentLatitude) &&
      currentLatitude >= -90 &&
      currentLatitude <= 90 &&
      Number.isFinite(currentLongitude) &&
      currentLongitude >= -180 &&
      currentLongitude <= 180;
    const shouldPreserveManualCoordinates =
      addressResolutionSourceRef.current === "coordinates" && hasCurrentCoordinates;

    const addressComponents =
      data.addressComponents ?? data.address_components ?? [];
    const geometryLocation = data.geometry?.location;
    const geometryLatitude =
      typeof geometryLocation?.lat === "function"
        ? geometryLocation.lat()
        : typeof geometryLocation?.lat === "number"
        ? geometryLocation.lat
        : null;
    const geometryLongitude =
      typeof geometryLocation?.lng === "function"
        ? geometryLocation.lng()
        : typeof geometryLocation?.lng === "number"
        ? geometryLocation.lng
        : null;
    const resolvedLatitude = shouldPreserveManualCoordinates
      ? currentLatitude
      : data.latitude ?? data.coordinates?.latitude ?? geometryLatitude ?? null;
    const resolvedLongitude = shouldPreserveManualCoordinates
      ? currentLongitude
      : data.longitude ?? data.coordinates?.longitude ?? geometryLongitude ?? null;
    const resolvedFormattedAddress =
      data.formattedAddress ?? data.formatted_address ?? null;
    const isInitialDefaultReverseGeocode =
      !hasAddressResolutionInteractionRef.current &&
      resolvedLatitude != null &&
      resolvedLongitude != null &&
      Math.abs(resolvedLatitude - DEFAULT_ADDRESS_LATITUDE) < 0.000001 &&
      Math.abs(resolvedLongitude - DEFAULT_ADDRESS_LONGITUDE) < 0.000001 &&
      !formData.latitude &&
      !formData.longitude &&
      !formData.formattedAddress.trim();

    if (isInitialDefaultReverseGeocode) {
      return;
    }

    const findComponent = (type: string) =>
      addressComponents.find((component: any) =>
        Array.isArray(component.types) ? component.types.includes(type) : false
      )?.long_name;

    const preliminaryResolved: ResolvedAddressDraft = {
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
      formattedAddress: resolvedFormattedAddress,
      resolvedFormattedAddress,
      placeId: data.placeId ?? data.place_id ?? null,
      street: data.street ?? findComponent("route") ?? null,
      houseNumber:
        data.houseNumber ?? data.streetNumber ?? findComponent("street_number") ?? null,
      provinceId: data.provinceId ?? data.provinceCode ?? null,
      districtId: data.districtId ?? data.districtCode ?? null,
      communeId: data.communeId ?? data.communeCode ?? null,
      villageId: data.villageId ?? data.villageCode ?? null,
    };

    const hasResolvedHierarchy = Boolean(
      preliminaryResolved.provinceId ||
        preliminaryResolved.districtId ||
        preliminaryResolved.communeId ||
        preliminaryResolved.villageId
    );

    let normalizedResolved = preliminaryResolved;

    if (!hasResolvedHierarchy) {
      try {
        if (
          preliminaryResolved.latitude != null &&
          preliminaryResolved.longitude != null
        ) {
          normalizedResolved = await propertyAddressService.resolveAddress({
            latitude: preliminaryResolved.latitude,
            longitude: preliminaryResolved.longitude,
          });
        } else if (preliminaryResolved.formattedAddress?.trim()) {
          normalizedResolved = await propertyAddressService.resolveAddress({
            formattedAddress: preliminaryResolved.formattedAddress.trim(),
          });
        }
      } catch (error) {
        console.error("Failed to normalize property edit reverse geocode payload", error);
      }
    }

    normalizedResolved = await ensureResolvedAddressHierarchy(normalizedResolved);

    const shouldCompleteFromResolvedAddress = !(
      normalizedResolved.provinceId &&
      normalizedResolved.districtId &&
      normalizedResolved.communeId
    );

    if (shouldPreferTypedDetectedAddress) {
      try {
        normalizedResolved = await completeResolvedHierarchyFromDetectedAddress(
          {
            ...normalizedResolved,
            formattedAddress: typedDetectedAddress,
          },
          typedDetectedAddress
        );
      } catch (error) {
        console.error("Failed to complete property edit typed detected address", error);
      }
    } else if (
      shouldCompleteFromResolvedAddress &&
      normalizedResolved.formattedAddress?.trim()
    ) {
      try {
        normalizedResolved = await completeResolvedHierarchyFromDetectedAddress(
          normalizedResolved,
          normalizedResolved.formattedAddress.trim()
        );
      } catch (error) {
        console.error("Failed to complete property edit reverse geocoded address", error);
      }
    }

    if (shouldPreferTypedDetectedAddress) {
      addressResolutionSourceRef.current = "formattedAddress";
      lastResolvedAddressKeyRef.current = `address:${typedDetectedAddress.toLowerCase()}`;
    } else if (
      normalizedResolved.latitude != null &&
      normalizedResolved.longitude != null
    ) {
      const finalLatitude = shouldPreserveManualCoordinates
        ? currentLatitude
        : normalizedResolved.latitude;
      const finalLongitude = shouldPreserveManualCoordinates
        ? currentLongitude
        : normalizedResolved.longitude;

      if (finalLatitude == null || finalLongitude == null) {
        return;
      }

      if (shouldPreserveManualCoordinates) {
        normalizedResolved = {
          ...normalizedResolved,
          latitude: finalLatitude,
          longitude: finalLongitude,
        };
      }
      lastResolvedAddressKeyRef.current = `coords:${finalLatitude.toFixed(6)}:${finalLongitude.toFixed(6)}`;
      addressResolutionSourceRef.current = "coordinates";
    } else if (normalizedResolved.formattedAddress?.trim()) {
      lastResolvedAddressKeyRef.current = `address:${normalizedResolved.formattedAddress.trim().toLowerCase()}`;
    }

    applyResolvedAddress(normalizedResolved);
  }, [
    applyResolvedAddress,
    completeResolvedHierarchyFromDetectedAddress,
    formData.formattedAddress,
    formData.latitude,
    formData.longitude,
  ]);

  useEffect(() => {
    if (!hasAddressResolutionInteractionRef.current) {
      return;
    }

    const latitude = Number.parseFloat(formData.latitude);
    const longitude = Number.parseFloat(formData.longitude);
    const hasValidCoordinates =
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180;
    const trimmedAddress = formData.formattedAddress.trim();
    const shouldResolveFromDetectedAddress =
      addressResolutionSourceRef.current === "formattedAddress" &&
      trimmedAddress.length >= 6;

    const payload = shouldResolveFromDetectedAddress
      ? { formattedAddress: trimmedAddress }
      : hasValidCoordinates
      ? { latitude, longitude }
      : trimmedAddress.length >= 6
      ? { formattedAddress: trimmedAddress }
      : null;

    if (!payload) {
      lastResolvedAddressKeyRef.current = "";
      return;
    }

    const resolutionKey = shouldResolveFromDetectedAddress
      ? `address:${trimmedAddress.toLowerCase()}`
      : hasValidCoordinates
      ? `coords:${latitude.toFixed(6)}:${longitude.toFixed(6)}`
      : `address:${trimmedAddress.toLowerCase()}`;

    if (lastResolvedAddressKeyRef.current === resolutionKey) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = activeResolveRequestRef.current + 1;
      activeResolveRequestRef.current = requestId;
      setIsReverseGeocoding(true);

      try {
        const resolved = await propertyAddressService.resolveAddress(payload);
        if (activeResolveRequestRef.current !== requestId) return;
        const hydratedResolved = await ensureResolvedAddressHierarchy(resolved);
        if (activeResolveRequestRef.current !== requestId) return;
        const shouldCompleteFromHydratedAddress = !(
          hydratedResolved.provinceId &&
          hydratedResolved.districtId &&
          hydratedResolved.communeId
        );
        const completionAddress = shouldResolveFromDetectedAddress
          ? trimmedAddress
          : shouldCompleteFromHydratedAddress
          ? hydratedResolved.formattedAddress?.trim() ?? ""
          : "";
        const completedResolved = completionAddress
          ? await completeResolvedHierarchyFromDetectedAddress(
              hydratedResolved,
              completionAddress
            )
          : hydratedResolved;
        if (activeResolveRequestRef.current !== requestId) return;
        const nextResolved =
          hasValidCoordinates && addressResolutionSourceRef.current === "coordinates"
            ? { ...completedResolved, latitude, longitude }
            : completedResolved;

        if (nextResolved.latitude != null && nextResolved.longitude != null) {
          const resolvedLatitudeValue = nextResolved.latitude;
          const resolvedLongitudeValue = nextResolved.longitude;

          if (resolvedLatitudeValue == null || resolvedLongitudeValue == null) {
            return;
          }

          if (shouldResolveFromDetectedAddress) {
            addressResolutionSourceRef.current = "formattedAddress";
            lastResolvedAddressKeyRef.current = resolutionKey;
          } else {
            addressResolutionSourceRef.current = "coordinates";
            lastResolvedAddressKeyRef.current = `coords:${resolvedLatitudeValue.toFixed(6)}:${resolvedLongitudeValue.toFixed(6)}`;
          }
        } else {
          lastResolvedAddressKeyRef.current = resolutionKey;
        }

        applyResolvedAddress(nextResolved);
      } catch (error) {
        if (activeResolveRequestRef.current === requestId) {
          console.error("Failed to resolve property edit address", error);
        }
      } finally {
        if (activeResolveRequestRef.current === requestId) {
          setIsReverseGeocoding(false);
        }
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    applyResolvedAddress,
    completeResolvedHierarchyFromDetectedAddress,
    formData.formattedAddress,
    formData.latitude,
    formData.longitude,
  ]);

  const handleShapesChange = useCallback(
    (newShapes: DrawnShape[]) => {
      setShapes(newShapes);
      setIsDirty(true);

      if (newShapes.length > 0) {
        const geoJson = convertShapesToGeoJson(newShapes);
        if (geoJson) {
          setPolygonGeoJson(geoJson);
          hadPolygonDrawnRef.current = true;
          logPolygonInfo(geoJson, "Edit Property Polygon");
        }
        return;
      }

      // Keep converted polygon when map remount clears runtime shape objects.
      if (hadPolygonDrawnRef.current && polygonGeoJson) {
        return;
      }

      if (existingPolygon) {
        setPolygonGeoJson(existingPolygon);
      }
    },
    [existingPolygon, polygonGeoJson]
  );

  // Auto-center pin when NEW shape is drawn (not for existing polygon)
  useEffect(() => {
    // Only auto-center if:
    // 1. User has drawn a shape (shapes.length > 0)
    // 2. The shape is NOT the temporary polygon preview (id !== 'temp-polygon')
    // 3. Property has already loaded (hasLoadedData.current is true)
    if (shapes.length > 0 && window.google?.maps && hasLoadedData.current) {
      // Filter out temp polygon
      const actualShapes = shapes.filter(s => s.id !== 'temp-polygon');

      if (actualShapes.length === 0) return; // Only temp polygon exists, don't auto-center

      const shape = actualShapes[0]; // Get the first actual drawn shape

      let centerLat: number | null = null;
      let centerLng: number | null = null;

      if (shape.shape instanceof google.maps.Polygon) {
        const path = shape.shape.getPath();
        const bounds = new google.maps.LatLngBounds();
        for (let i = 0; i < path.getLength(); i++) {
          bounds.extend(path.getAt(i));
        }
        const center = bounds.getCenter();
        centerLat = center.lat();
        centerLng = center.lng();
      } else if (shape.shape instanceof google.maps.Rectangle) {
        const bounds = shape.shape.getBounds();
        if (bounds) {
          const center = bounds.getCenter();
          centerLat = center.lat();
          centerLng = center.lng();
        }
      } else if (shape.shape instanceof google.maps.Circle) {
        const center = shape.shape.getCenter();
        if (center) {
          centerLat = center.lat();
          centerLng = center.lng();
        }
      }

      if (centerLat !== null && centerLng !== null) {
        console.log("📍 Auto-centering pin to NEW shape center:", { lat: centerLat, lng: centerLng });
        handleInputChange("latitude", centerLat.toString());
        handleInputChange("longitude", centerLng.toString());
      }
    }
  }, [shapes]);

  // Debug effect for map coordinates
  useEffect(() => {
    if (formData.latitude && formData.longitude) {
      console.log("🗺️ Map Coordinates in Form:", {
        latitude: formData.latitude,
        longitude: formData.longitude,
        parsed: {
          lat: parseFloat(formData.latitude),
          lng: parseFloat(formData.longitude),
        },
        addressCodes,
        hasPolygon: !!existingPolygon,
      });
    }
  }, [formData.latitude, formData.longitude, addressCodes, existingPolygon]);

  useEffect(() => {
    if (property && !hasLoadedData.current) {
      hasLoadedData.current = true; // Mark as loaded

      // ✅ Handle both backend data structures:
      // 1) Real buildings (with dimensions/construction data)
      // 2) Direct units (without a parent building)
      let buildingsData: any[] = [];
      const propertyBuildings = Array.isArray(property.building)
        ? property.building
        : [];
      const directBuildingUnits = Array.isArray(property.buildingUnits)
        ? property.buildingUnits
        : [];
      const mapUnitToForm = (u: any) => ({
        buildingUnitId: u.buildingUnitId?.toString() || "",
        buildingId: u.buildingId?.toString() || "",
        unitNo: u.unitNo || "",
        floorNo: u.floorNo?.toString() || "",
        floorAreaSqm: u.floorAreaSqm?.toString() || "",
        totalAreaSqm: u.totalAreaSqm?.toString() || "",
        numberOfBedrooms: u.numberOfBedrooms?.toString() || "",
        numberOfBathrooms: u.numberOfBathrooms?.toString() || "",
        hasKitchen: u.hasKitchen ?? false,
        hasLivingRoom: u.hasLivingRoom ?? false,
        hasParkingSpace: u.hasParkingSpace ?? false,
        constructedYear: u.constructedYear?.toString() || "",
        usefulLife: u.usefulLife?.toString() || "50",
        effectiveAge: u.effectiveAge?.toString() || "",
        unitType: u.unitType || "",
        costPerSqm: u.costPerSqm?.toString() || "",
        replacementCostPerSqm: u.replacementCostPerSqm?.toString() || "",
        costEstimationPerSqm: u.costEstimationPerSqm?.toString() || "",
        totalBuildingCost: u.totalBuildingCost?.toString() || "",
        physical_condition: normalizePhysicalCondition(u.physical_condition) || "",
        managementFee: u.managementFee || "",
        viewType: u.viewType || "",
      });

      // Prefer actual buildings when present so we keep width/length/storey/etc.
      if (propertyBuildings.length > 0) {
        buildingsData = propertyBuildings.map((b: any) => {
          // Calculate effectiveAge if not provided but constructionYear exists
          const constructionYear = b.constructionYear ? parseInt(b.constructionYear.toString()) : 0;
          const currentYear = new Date().getFullYear();
          const calculatedEffectiveAge = constructionYear > 0 ? currentYear - constructionYear : 0;
          const effectiveAge = b.effectiveAge?.toString() || (calculatedEffectiveAge > 0 ? calculatedEffectiveAge.toString() : "");
          const nestedUnits = Array.isArray(b.buildingUnits) ? b.buildingUnits : [];
          const unitsForBuilding =
            nestedUnits.length > 0
              ? nestedUnits
              : directBuildingUnits.filter(
                  (u: any) =>
                    Number(u?.buildingId) > 0 &&
                    Number(u.buildingId) === Number(b.buildingId)
                );

          return {
            buildingId: b.buildingId?.toString() || "",
            buildingName: b.buildingName || `Building ${b.buildingId}`,
            buildingSubtypeId:
              b.buildingSubtypeId?.toString() ||
              b.buildingSubtype?.buildingSubtypeId?.toString() ||
              "",
            width: b.width?.toString() || "",
            length: b.length?.toString() || "",
            numberOfStorey: b.numberOfStorey?.toString() || "",
            grossAreaSqm: b.grossAreaSqm?.toString() || "",
            bedroom: b.bedroom?.toString() || "",
            bathroom: b.bathroom?.toString() || "",
            livingroom: b.livingroom?.toString() || "",
            kitchen: b.kitchen?.toString() || "",
            diningroom: b.diningroom?.toString() || "",
            totalRoom: b.totalRoom?.toString() || "",
            parkingSpace: b.parkingSpace?.toString() || "",
            constructionYear: b.constructionYear?.toString() || "",
            effectiveAge: effectiveAge,
            usefulLife: b.usefulLife?.toString() || "",
            costPerSqm: b.costPerSqm?.toString() || "",
            replacementCostPerSqm: b.replacementCostPerSqm?.toString() || "",
            totalBuildingCost: b.totalBuildingCost?.toString() || "",
            viewType: normalizeBuildingViewType(b.viewType),
            status: normalizeBuildingStatus(b.status),
            percentageOfConstruction: toConstructionPercentageSelectValue(
              b.percentageOfConstruction
            ),
            totalUnits:
              unitsForBuilding.length > 0
                ? unitsForBuilding.length.toString()
                : b.totalUnits?.toString() || "0",
            units: unitsForBuilding.map(mapUnitToForm),
          };
        });
      }
      // Direct Unit Entry (Residential/Commercial Buildings):
      // Units are in property.buildingUnits array without building parent
      else if (directBuildingUnits.length > 0) {
        console.log(
          "✅ Loading DIRECT UNITS (no building parent):",
          directBuildingUnits.length
        );
        // Create a single "virtual" building to hold all direct units
        buildingsData = [
          {
            buildingId: "",
            buildingName: property.propertyName || "Units",
            buildingSubtypeId: "", // Direct units don't have building subtype
            width: "",
            length: "",
            numberOfStorey: "",
            grossAreaSqm: "",
            bedroom: "",
            bathroom: "",
            livingroom: "",
            kitchen: "",
            diningroom: "",
            totalRoom: "",
            parkingSpace: "",
            constructionYear: "",
            effectiveAge: "",
            usefulLife: "",
            costPerSqm: "",
            replacementCostPerSqm: "",
            totalBuildingCost: "",
            viewType: normalizeBuildingViewType(undefined),
            status: normalizeBuildingStatus(undefined),
            percentageOfConstruction: "",
            totalUnits: directBuildingUnits.length.toString(),
            units: directBuildingUnits.map(mapUnitToForm),
          },
        ];
      }

      setFormData({
        propertyName: property.propertyName || "",
        propertyTypeId: property.propertyType?.propertyTypeId?.toString() || "",
        propertySubtypeId: property.propertySubtypeId?.toString() || "",
        currentUseId: property.currentUseId?.toString() || "",
        status: property.status || "",
        workflowStatus: property.workflowStatus || "",
        // Auto-clean rejection reasons from description for rejected workflow items
        description: property.workflowStatus === "REJECTED" 
          ? cleanRejectionReasons(property.description || "")
          : property.description || "",
        provinceId: getAddressEntityCode(property.propertyAddress?.province) || "",
        districtId: getAddressEntityCode(property.propertyAddress?.district) || "",
        communeId: getAddressEntityCode(property.propertyAddress?.commune) || "",
        villageId: getAddressEntityCode(property.propertyAddress?.village) || "",
        street: property.propertyAddress?.street || "",
        houseNo: property.propertyAddress?.houseNo || "",
        latitude: property.propertyLocation?.latitude?.toString() || "",
        longitude: property.propertyLocation?.longitude?.toString() || "",
        formattedAddress: property.propertyLocation?.formattedAddress || "",
        placeId: property.propertyLocation?.placeId || "",
        widthMeters: property.land?.widthMeters?.toString() || "",
        lengthMeters: property.land?.lengthMeters?.toString() || "",
        landAreaSqm: property.land?.landAreaSqm?.toString() || "",
        landShape: property.land?.landShape || "",
        topography: property.land?.topography || "",
        sitePosition: property.land?.sitePosition || "",
        waterSource: property.land?.waterSource || "",
        typeofTree: property.agricultureLand?.typeofTree || "",
        numberOfTrees: property.agricultureLand?.numberOfTrees?.toString() || "",
        ageOfTrees: property.agricultureLand?.ageOfTrees?.toString() || "",
        totalFloors: property.totalFloors?.toString() || "",
        builtYear: property.builtYear?.toString() || "",
        buildingAreaSqm: property.buildingAreaSqm?.toString() || "",
        floorAreaSqm: property.floorAreaSqm?.toString() || "",
        bedrooms: property.bedrooms?.toString() || "",
        bathrooms: property.bathrooms?.toString() || "",
        buildings: buildingsData,
        titleDeedType: property.titleDocument?.titleDeedType || "",
        titleDeedNo: property.titleDocument?.titleDeedNo || "",
        issuedYear: property.titleDocument?.issuedYear?.toString() || "",
        parcelNo: property.titleDocument?.parcelNo || "",
        totalSizeByTitleDeed:
          property.titleDocument?.totalSizeByTitleDeed?.toString() || "",
        sourceType: property.dataSource?.sourceType || "",
        contactName: property.dataSource?.contactName || "",
        phoneNumber: property.dataSource?.phoneNumber || "",
        transactionType:
          normalizeTransactionType(
            property.transaction?.[0]?.transactionType
          ) || "",
        transactionDate: toDateInputValue(
          property.transaction?.[0]?.transactionDate?.toString()
        ),
        totalPrice: property.transaction?.[0]?.totalPrice?.toString() || "",
      });

      // Sync addressCodes state with loaded property data
      setAddressCodes({
        provinceId: getAddressEntityCode(property.propertyAddress?.province),
        districtId: getAddressEntityCode(property.propertyAddress?.district),
        communeId: getAddressEntityCode(property.propertyAddress?.commune),
        villageId: getAddressEntityCode(property.propertyAddress?.village),
      });
      setResolvedAddressItems({
        province: toResolvedAddressItem(property.propertyAddress?.province),
        district: toResolvedAddressItem(property.propertyAddress?.district),
        commune: toResolvedAddressItem(property.propertyAddress?.commune),
        village: toResolvedAddressItem(property.propertyAddress?.village),
      });

      // Load existing photos if available
      setPhotoPreview({
        frontSide: property.propertyPhotos?.frontSide || "",
        inside: property.propertyPhotos?.inside || "",
        leftSide: property.propertyPhotos?.leftSide || "",
        rightSide: property.propertyPhotos?.rightSide || "",
        opposite: property.propertyPhotos?.opposite || "",
        gallery: property.propertyPhotos?.gallery || [],
        coverPhoto: property.titleDocument?.coverPhotoUrl || "",
        backSidePhoto: property.titleDocument?.backSidePhotoUrl || "",
        buildingImage: property.building?.[0]?.buildingImage || "",
        buildingImages:
          property.building?.map((b: any) =>
            b.buildingImages && Array.isArray(b.buildingImages)
              ? b.buildingImages
              : b.buildingImage
              ? [b.buildingImage]
              : []
          ) || [],
      });

      const rawPolygon = property.propertyLocation?.polygon;
      let parsedPolygon: GeoJsonPolygon | null = null;

      if (rawPolygon) {
        if (typeof rawPolygon === "string") {
          try {
            parsedPolygon = JSON.parse(rawPolygon) as GeoJsonPolygon;
          } catch {
            parsedPolygon = null;
          }
        } else if (typeof rawPolygon === "object") {
          parsedPolygon = rawPolygon as GeoJsonPolygon;
        }
      }

      if (parsedPolygon?.type === "Polygon" && parsedPolygon.coordinates?.length) {
        setExistingPolygon(parsedPolygon);
        setPolygonGeoJson(parsedPolygon);
        originalPolygonRef.current = parsedPolygon;
        hadPolygonDrawnRef.current = false;
        logPolygonInfo(parsedPolygon, "Loaded Existing Polygon");
      } else {
        setExistingPolygon(null);
        setPolygonGeoJson(null);
        originalPolygonRef.current = null;
      }
    }
  }, [property]);

  // Store original data after it's loaded (for reset functionality)
  useEffect(() => {
    if (hasLoadedData.current && formData.propertyName && !originalDataRef.current.formData) {
      originalDataRef.current = {
        formData: JSON.parse(JSON.stringify(formData)),
        addressCodes: JSON.parse(JSON.stringify(addressCodes)),
        resolvedAddressItems: JSON.parse(JSON.stringify(resolvedAddressItems)),
        photoPreview: JSON.parse(JSON.stringify(photoPreview)),
      };
    }
  }, [formData, addressCodes, photoPreview, resolvedAddressItems]);

  const selectedPropertyType = useMemo(() => {
    const selected = propertyTypes.find(
      (pt) => pt.propertyTypeId === parseInt(formData.propertyTypeId)
    );
    console.log("🔍 Selected Property Type:", {
      propertyTypeId: formData.propertyTypeId,
      selected: selected?.propertyName,
      buildingSubtypes: selected?.buildingSubtypes?.length || 0,
    });
    return selected;
  }, [formData.propertyTypeId, propertyTypes]);

  const availableSubtypes = useMemo(() => {
    return selectedPropertyType?.subtypes || [];
  }, [selectedPropertyType]);

  const availableCurrentUses = useMemo(() => {
    return selectedPropertyType?.currentUses || [];
  }, [selectedPropertyType]);

  const availableBuildingSubtypes = useMemo(() => {
    const subtypes = selectedPropertyType?.buildingSubtypes || [];
    console.log("🏗️ Available Building Subtypes:", subtypes.length, subtypes);
    return subtypes;
  }, [selectedPropertyType]);

  const availableUnitTypes = useMemo(() => {
    return getUnitTypeOptions(formData.propertyTypeId);
  }, [formData.propertyTypeId]);


  const handlePhotoUpload = (
    field: keyof typeof photos,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const shouldDeleteExisting = Boolean(photoPreview[field as keyof typeof photoPreview]);

    // Enhanced validation
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please select a valid image file (JPEG, PNG, WebP)");
      return;
    }

    if (field === "gallery") {
      const fileArray = Array.from(files);
      setPhotos((prev) => ({
        ...prev,
        gallery: [...prev.gallery, ...fileArray],
      }));

      fileArray.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview((prev) => ({
            ...prev,
            gallery: [...prev.gallery, reader.result as string],
          }));
        };
        reader.readAsDataURL(file);
      });
    } else {
      // ✅ Store the actual File object
      setPhotos((prev) => {
        const updated = { ...prev, [field]: file };
        console.log(`✅ Updated photos.${field}:`, file.name, file);
        return updated;
      });

      // Generate preview separately
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview((prev) => ({
          ...prev,
          [field]: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
      setImagesToDelete((prev) => ({
        ...prev,
        [field]: prev[field as keyof typeof prev] || shouldDeleteExisting,
      }));
    }

    setIsDirty(true);
    toast.success(`${field.replace(/([A-Z])/g, " $1")} uploaded!`);
  };

  const handleBuildingImageUpload = (
    buildingIndex: number,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    setPhotos((prev) => {
      const newBuildingImages = [...prev.buildingImages];
      while (newBuildingImages.length <= buildingIndex) {
        newBuildingImages.push([]);
      }
      newBuildingImages[buildingIndex] = [
        ...(newBuildingImages[buildingIndex] || []),
        ...fileArray,
      ];
      return { ...prev, buildingImages: newBuildingImages };
    });

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview((prev) => {
          const newPreviews = [...prev.buildingImages];
          while (newPreviews.length <= buildingIndex) {
            newPreviews.push([]);
          }
          if (!newPreviews[buildingIndex]) {
            newPreviews[buildingIndex] = [];
          }
          newPreviews[buildingIndex] = [
            ...newPreviews[buildingIndex],
            reader.result as string,
          ];
          return { ...prev, buildingImages: newPreviews };
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeBuildingImage = (buildingIndex: number, imageIndex: number) => {
    setPhotos((prev) => {
      const newBuildingImages = [...prev.buildingImages];
      if (newBuildingImages[buildingIndex]) {
        newBuildingImages[buildingIndex] = newBuildingImages[
          buildingIndex
        ].filter((_, idx) => idx !== imageIndex);
      }
      return { ...prev, buildingImages: newBuildingImages };
    });

    setPhotoPreview((prev) => {
      const newPreviews = [...prev.buildingImages];
      if (newPreviews[buildingIndex]) {
        newPreviews[buildingIndex] = newPreviews[buildingIndex].filter(
          (_, idx) => idx !== imageIndex
        );
      }
      return { ...prev, buildingImages: newPreviews };
    });
  };

  const removePhoto = (field: keyof typeof photos, index?: number) => {
    if (field === "gallery" && index !== undefined) {
      setPhotos((prev) => ({
        ...prev,
        gallery: prev.gallery.filter((_, i) => i !== index),
      }));
      setPhotoPreview((prev) => ({
        ...prev,
        gallery: prev.gallery.filter((_, i) => i !== index),
      }));
      setImagesToDelete((prev) => ({
        ...prev,
        gallery: [...prev.gallery, index],
      }));
    } else {
      setPhotos((prev) => ({ ...prev, [field]: null }));
      setPhotoPreview((prev) => ({ ...prev, [field]: "" }));
      setImagesToDelete((prev) => ({ ...prev, [field]: true }));
    }
    setIsDirty(true);
    toast.success("Image removed successfully!");
  };

  // ============================================
  // 🔄 RESET HANDLERS FOR EACH TAB
  // ============================================
  const resetToOriginal = (tabName: string, resetFn: () => void) => {
    if (!originalDataRef.current.formData) {
      toast.error("Original data not available");
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: `Reset ${tabName}`,
      description: `Are you sure you want to reset ${tabName} to the original values? Any unsaved changes will be lost.`,
      onConfirm: () => {
        resetFn();
        setIsDirty(false);
        setValidationErrors({});
        toast.success(`${tabName} reset to original values`);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resetBasicTab = () => {
    resetToOriginal("Basic Information", () => {
      if (!originalDataRef.current.formData) return;
      setFormData((prev) => ({
        ...prev,
        propertyName: originalDataRef.current.formData!.propertyName,
        propertyTypeId: originalDataRef.current.formData!.propertyTypeId,
        propertySubtypeId: originalDataRef.current.formData!.propertySubtypeId,
        currentUseId: originalDataRef.current.formData!.currentUseId,
        status: originalDataRef.current.formData!.status,
        workflowStatus: originalDataRef.current.formData!.workflowStatus,
        description: originalDataRef.current.formData!.description,
      }));
    });
  };

  const resetDetailsTab = () => {
    resetToOriginal("Property Details", () => {
      if (!originalDataRef.current.formData) return;
      setFormData((prev) => ({
        ...prev,
        widthMeters: originalDataRef.current.formData!.widthMeters,
        lengthMeters: originalDataRef.current.formData!.lengthMeters,
        landAreaSqm: originalDataRef.current.formData!.landAreaSqm,
        totalFloors: originalDataRef.current.formData!.totalFloors,
        builtYear: originalDataRef.current.formData!.builtYear,
        buildingAreaSqm: originalDataRef.current.formData!.buildingAreaSqm,
        floorAreaSqm: originalDataRef.current.formData!.floorAreaSqm,
        bedrooms: originalDataRef.current.formData!.bedrooms,
        bathrooms: originalDataRef.current.formData!.bathrooms,
        landShape: originalDataRef.current.formData!.landShape,
        topography: originalDataRef.current.formData!.topography,
        sitePosition: originalDataRef.current.formData!.sitePosition,
        waterSource: originalDataRef.current.formData!.waterSource,
        typeofTree: originalDataRef.current.formData!.typeofTree,
        numberOfTrees: originalDataRef.current.formData!.numberOfTrees,
        ageOfTrees: originalDataRef.current.formData!.ageOfTrees,
        buildings: JSON.parse(JSON.stringify(originalDataRef.current.formData!.buildings)),
      }));
      if (originalDataRef.current.photoPreview) {
        setPhotoPreview((prev) => ({
          ...prev,
          buildingImages: JSON.parse(JSON.stringify(originalDataRef.current.photoPreview!.buildingImages)),
        }));
      }
      setPhotos((prev) => ({
        ...prev,
        buildingImages: [],
      }));
    });
  };

  const resetAddressTab = () => {
    resetToOriginal("Address Information", () => {
      if (!originalDataRef.current.formData || !originalDataRef.current.addressCodes) return;
      setFormData((prev) => ({
        ...prev,
        provinceId: originalDataRef.current.formData!.provinceId,
        districtId: originalDataRef.current.formData!.districtId,
        communeId: originalDataRef.current.formData!.communeId,
        villageId: originalDataRef.current.formData!.villageId,
        street: originalDataRef.current.formData!.street,
        houseNo: originalDataRef.current.formData!.houseNo,
        latitude: originalDataRef.current.formData!.latitude,
        longitude: originalDataRef.current.formData!.longitude,
        formattedAddress: originalDataRef.current.formData!.formattedAddress,
        placeId: originalDataRef.current.formData!.placeId,
      }));
      setAddressCodes(JSON.parse(JSON.stringify(originalDataRef.current.addressCodes)));
      setResolvedAddressItems(
        JSON.parse(
          JSON.stringify(
            originalDataRef.current.resolvedAddressItems ?? EMPTY_RESOLVED_ADDRESS_ITEMS
          )
        )
      );
      setShapes([]);
      setExistingPolygon(originalPolygonRef.current);
      setPolygonGeoJson(originalPolygonRef.current);
      hadPolygonDrawnRef.current = false;
      setIsReverseGeocoding(false);
      lastResolvedAddressKeyRef.current = "";
      activeResolveRequestRef.current = 0;
      preserveTypedDetectedAddressRef.current = false;
      resolvedCanonicalAddressRef.current = "";
      hasAddressResolutionInteractionRef.current = false;
      addressResolutionSourceRef.current = "coordinates";
    });
  };

  const resetDocumentsTab = () => {
    resetToOriginal("Documents & Photos", () => {
      if (!originalDataRef.current.formData || !originalDataRef.current.photoPreview) return;
      setFormData((prev) => ({
        ...prev,
        titleDeedType: originalDataRef.current.formData!.titleDeedType,
        titleDeedNo: originalDataRef.current.formData!.titleDeedNo,
        issuedYear: originalDataRef.current.formData!.issuedYear,
        parcelNo: originalDataRef.current.formData!.parcelNo,
        totalSizeByTitleDeed: originalDataRef.current.formData!.totalSizeByTitleDeed,
      }));
      setPhotoPreview((prev) => ({
        ...prev,
        frontSide: originalDataRef.current.photoPreview!.frontSide,
        inside: originalDataRef.current.photoPreview!.inside,
        leftSide: originalDataRef.current.photoPreview!.leftSide,
        rightSide: originalDataRef.current.photoPreview!.rightSide,
        opposite: originalDataRef.current.photoPreview!.opposite,
        gallery: JSON.parse(JSON.stringify(originalDataRef.current.photoPreview!.gallery)),
        coverPhoto: originalDataRef.current.photoPreview!.coverPhoto,
        backSidePhoto: originalDataRef.current.photoPreview!.backSidePhoto,
      }));
      setPhotos((prev) => ({
        ...prev,
        frontSide: null,
        inside: null,
        leftSide: null,
        rightSide: null,
        opposite: null,
        gallery: [],
        coverPhoto: null,
        backSidePhoto: null,
      }));
      setImagesToDelete({
        frontSide: false,
        inside: false,
        leftSide: false,
        rightSide: false,
        opposite: false,
        buildingImage: false,
        coverPhoto: false,
        backSidePhoto: false,
        gallery: [],
      });
    });
  };

  const resetSourceTab = () => {
    resetToOriginal("Data Source", () => {
      if (!originalDataRef.current.formData) return;
      setFormData((prev) => ({
        ...prev,
        sourceType: originalDataRef.current.formData!.sourceType,
        contactName: originalDataRef.current.formData!.contactName,
        phoneNumber: originalDataRef.current.formData!.phoneNumber,
      }));
    });
  };

  const resetTransactionTab = () => {
    resetToOriginal("Transaction Information", () => {
      if (!originalDataRef.current.formData) return;
      setFormData((prev) => ({
        ...prev,
        transactionType: originalDataRef.current.formData!.transactionType,
        transactionDate: originalDataRef.current.formData!.transactionDate,
        totalPrice: originalDataRef.current.formData!.totalPrice,
      }));
    });
  };

  const isLandProperty = useMemo(() => {
    return (
      selectedPropertyType?.recordType.recordName === "Land" ||
      selectedPropertyType?.recordType.recordName === "LandAndBuilding"
    );
  }, [selectedPropertyType]);

  const isBuildingProperty = useMemo(() => {
    // Check both the form data and the actual property data from API
    const fromSelectedType =
      selectedPropertyType?.recordType.recordName === "Building" ||
      selectedPropertyType?.recordType.recordName === "LandAndBuilding";

    const fromApiData =
      property?.propertyType?.recordType?.recordName === "Building" ||
      property?.propertyType?.recordType?.recordName === "LandAndBuilding";

    const result = fromSelectedType || fromApiData;

    return result;
  }, [selectedPropertyType, property]);

  const isLandAndBuilding = useMemo(() => {
    const fromSelectedType =
      selectedPropertyType?.recordType.recordName === "LandAndBuilding";
    const fromApiData =
      property?.propertyType?.recordType?.recordName === "LandAndBuilding";
    return !!(fromSelectedType || fromApiData);
  }, [selectedPropertyType, property]);

  const isAgricultural = useMemo(() => {
    return selectedPropertyType?.propertyName.includes("Agricultural");
  }, [selectedPropertyType]);

  const requiresDirectUnits = useMemo(() => {
    // Property types 3 and 4 are Residential Building and Commercial Building
    return formData.propertyTypeId === "3" || formData.propertyTypeId === "4";
  }, [formData.propertyTypeId]);

  const handleInputChange = (field: string, value: any) => {
    if (field === "formattedAddress") {
      const nextValue = String(value ?? "");
      const coordinatePair = parseCoordinatePairInput(nextValue);

      hasAddressResolutionInteractionRef.current = nextValue.trim().length > 0;
      preserveTypedDetectedAddressRef.current = !coordinatePair && nextValue.trim().length > 0;
      addressResolutionSourceRef.current = coordinatePair ? "coordinates" : "formattedAddress";
      lastResolvedAddressKeyRef.current = "";

      if (coordinatePair) {
        setFormData((prev) => ({
          ...prev,
          formattedAddress: nextValue,
          latitude: coordinatePair.latitude,
          longitude: coordinatePair.longitude,
        }));
        return;
      }
    }

    if (field === "latitude" || field === "longitude") {
      hasAddressResolutionInteractionRef.current = true;
      preserveTypedDetectedAddressRef.current = false;
      addressResolutionSourceRef.current = "coordinates";
      lastResolvedAddressKeyRef.current = "";

      const coordinatePair = parseCoordinatePairInput(String(value ?? ""));
      if (coordinatePair) {
        setFormData((prev) => ({
          ...prev,
          latitude: coordinatePair.latitude,
          longitude: coordinatePair.longitude,
        }));
        return;
      }
    }

    console.log("🔄 Input change:", field, "=", value);
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      console.log("📝 Updated formData:", updated);
      return updated;
    });
  };

  const addBuilding = () => {
    setFormData((prev) => ({
      ...prev,
      buildings: [
        ...prev.buildings,
        {
          buildingId: "",
          buildingName: `Building ${prev.buildings.length + 1}`,
          buildingSubtypeId: "",
          width: "",
          length: "",
          numberOfStorey: "",
          grossAreaSqm: "",
          bedroom: "",
          bathroom: "",
          livingroom: "",
          kitchen: "",
          diningroom: "",
          totalRoom: "",
          parkingSpace: "",
          constructionYear: new Date().getFullYear().toString(),
          effectiveAge: "0",
          usefulLife: "50", 
          costPerSqm: "",
          replacementCostPerSqm: "",
          totalBuildingCost: "",
          constructionPercentage: "",
          physical_condition: "",
          depreciation: "",
          currentBuildingValue: "",
          percentageOfConstruction: "",
          viewType: "CITY_VIEW",
          status: "COMPLETED",
          totalUnits: "0",
          units: [],
        },
      ],
    }));
    // Initialize empty image arrays
    setPhotos((prev) => ({
      ...prev,
      buildingImages: [...prev.buildingImages, []],
    }));
    setPhotoPreview((prev) => ({
      ...prev,
      buildingImages: [...prev.buildingImages, []],
    }));
  };

  const removeBuilding = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      buildings: prev.buildings.filter((_, i) => i !== index),
    }));

    // Remove corresponding building images
    setPhotos((prev) => ({
      ...prev,
      buildingImages: (prev.buildingImages || []).filter((_, i) => i !== index),
    }));

    setPhotoPreview((prev) => ({
      ...prev,
      buildingImages: (prev.buildingImages || []).filter((_, i) => i !== index),
    }));
  };

  const updateBuilding = (index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b, i) =>
        i === index ? { ...b, [field]: value } : b
      ),
    }));
  };

  const addUnit = (buildingIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b, i) =>
        i === buildingIndex
          ? {
              ...b,
              units: [
                ...b.units,
                {
                  buildingUnitId: "",
                  buildingId: b.buildingId || "",
                  unitNo: `${String(b.units.length + 1).padStart(4, "0")}`,
                  floorNo: "1",
                  floorAreaSqm: "",
                  totalAreaSqm: "",
                  numberOfBedrooms: "1",
                  numberOfBathrooms: "1",
                  hasKitchen: true,
                  hasLivingRoom: true,
                  hasParkingSpace: false,
                  constructedYear: new Date().getFullYear().toString(),
                  usefulLife: "50",
                  effectiveAge: "0",
                  unitType: "",
                  costEstimationPerSqm: "",
                  costPerSqm: "",
                  replacementCostPerSqm: "",
                  totalBuildingCost: "",
                  physical_condition: "",
                  managementFee: "",
                  viewType: "",
                },
              ],
            }
          : b
      ),
    }));
  };

  const removeUnit = (buildingIndex: number, unitIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b, i) =>
        i === buildingIndex
          ? { ...b, units: b.units.filter((_, ui) => ui !== unitIndex) }
          : b
      ),
    }));
  };

  const updateUnit = (
    buildingIndex: number,
    unitIndex: number,
    field: string,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b, i) =>
        i === buildingIndex
          ? {
              ...b,
              units: b.units.map((u, ui) =>
                ui === unitIndex ? { ...u, [field]: value } : u
              ),
            }
          : b
      ),
    }));
  };

  // ============================================
  // AUTO-CALCULATION FUNCTIONS
  // ============================================
  const autoCalculateGrossArea = (buildingIndex: number) => {
    setFormData((prev) => {
      const building = prev.buildings[buildingIndex];
      const width = Number(building.width) || 0;
      const length = Number(building.length) || 0;
      const numberOfStorey = Number(building.numberOfStorey) || 1;

      const grossArea = width * length * numberOfStorey;

      return {
        ...prev,
        buildings: prev.buildings.map((b, idx) =>
          idx === buildingIndex
            ? { ...b, grossAreaSqm: grossArea > 0 ? String(grossArea) : "" }
            : b
        ),
      };
    });
  };

 const autoCalculateTotalRooms = (buildingIndex: number) => {
    setFormData((prev) => {
      const building = prev.buildings[buildingIndex];
      const bedroom = Number(building.bedroom) || 0;
      const bathroom = Number(building.bathroom) || 0;
      const livingroom = Number(building.livingroom) || 0;
      const kitchen = Number(building.kitchen) || 0;
      const diningroom = Number(building.diningroom) || 0;

      const totalRoom = bedroom + bathroom + livingroom + kitchen + diningroom;

      return {
        ...prev,
        buildings: prev.buildings.map((b, idx) =>
          idx === buildingIndex
            ? { ...b, totalRoom: totalRoom > 0 ? String(totalRoom) : "" }
            : b
        ),
      };
    });
  };

  // Auto-calculate effective age
  const autoCalculateEffectiveAge = (buildingIndex: number) => {
    setFormData((prev) => {
      const building = prev.buildings[buildingIndex];
      const constructionYear = Number(building.constructionYear) || 0;

      if (constructionYear > 0) {
        const currentYear = new Date().getFullYear();
        const effectiveAge = currentYear - constructionYear;

        return {
          ...prev,
          buildings: prev.buildings.map((b, idx) =>
            idx === buildingIndex
              ? { ...b, effectiveAge: String(Math.max(0, effectiveAge)) }
              : b
          ),
        };
      }
      return prev;
    });
  };

  // Auto-calculate unit effective age
  const autoCalculateUnitEffectiveAge = (buildingIndex: number, unitIndex: number) => {
    setFormData((prev) => {
      const unit = prev.buildings[buildingIndex]?.units[unitIndex];
      if (!unit) return prev;

      const constructionYear = Number(unit.constructedYear) || 0;

      if (constructionYear > 0) {
        const currentYear = new Date().getFullYear();
        const effectiveAge = currentYear - constructionYear;

        return {
          ...prev,
          buildings: prev.buildings.map((b, bIdx) =>
            bIdx === buildingIndex
              ? {
                  ...b,
                  units: b.units.map((u, uIdx) =>
                    uIdx === unitIndex
                      ? { ...u, effectiveAge: String(Math.max(0, effectiveAge)) }
                      : u
                  ),
                }
              : b
          ),
        };
      }
      return prev;
    });
  };

  
  // Auto-calculate unit total building cost
  const autoCalculateUnitCost = (buildingIndex: number, unitIndex: number) => {
    setFormData((prev) => {
      const unit = prev.buildings[buildingIndex]?.units[unitIndex];
      if (!unit) return prev;

      const floorArea = Number(unit.floorAreaSqm) || 0;
      const TotalSizeByTitleDeed = Number(prev.totalSizeByTitleDeed) || 0;
      const costPerSqm = Number(unit.costPerSqm) || 0;
      const totalCost =
        TotalSizeByTitleDeed * costPerSqm || floorArea * costPerSqm;

      return {
        ...prev,
        buildings: prev.buildings.map((b, bIdx) =>
          bIdx === buildingIndex
            ? {
                ...b,
                units: b.units.map((u, uIdx) =>
                  uIdx === unitIndex
                    ? {
                        ...u,
                        totalBuildingCost:
                          totalCost > 0 ? String(totalCost) : "",
                      }
                    : u
                ),
              }
            : b
        ),
      };
    });
  };

  // Replace the handleSubmit function in your EditPropertyPage component with this:

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const validationErrors: string[] = [];
      const normalizedTransactionType = normalizeTransactionType(
        formData.transactionType
      );

      if (isBuildingProperty && formData.buildings.length === 0) {
        validationErrors.push(
          "Please add at least one building for Building record type."
        );
      }

      if (isBuildingProperty) {
        const totalUnits = formData.buildings.reduce(
          (sum, building) => sum + building.units.length,
          0
        );

        if (requiresDirectUnits && totalUnits === 0) {
          validationErrors.push(
            "At least one unit is required for this property type."
          );
        }

        formData.buildings.forEach((building, buildingIndex) => {
          if (!requiresDirectUnits && !building.buildingSubtypeId?.trim()) {
            validationErrors.push(
              `Building ${buildingIndex + 1}: Construction type is required`
            );
          }

          building.units.forEach((unit, unitIndex) => {
            if (!unit.unitType?.trim()) {
              validationErrors.push(
                `Building ${buildingIndex + 1}, Unit ${
                  unitIndex + 1
                }: Unit type is required`
              );
            }
          });
        });
      }

      if (formData.totalPrice && parseFloat(formData.totalPrice) > 0) {
        if (!normalizedTransactionType) {
          validationErrors.push("Please select a valid transaction type.");
        }
      }

      if (validationErrors.length > 0) {
        validationErrors.forEach((message) => toast.error(message));
        setIsSubmitting(false);
        return;
      }

      // Create FormData instance
      const formDataToSend = new FormData();

      // ===== Add basic fields =====
      formDataToSend.append("propertyName", formData.propertyName);
      formDataToSend.append(
        "propertyTypeId",
        String(Number(formData.propertyTypeId))
      );
      formDataToSend.append(
        "propertySubtypeId",
        String(Number(formData.propertySubtypeId))
      );
      formDataToSend.append(
        "currentUseId",
        String(Number(formData.currentUseId))
      );
      
      // Keep business status in sync when the user is allowed to edit it.
      if (formData.status) {
        formDataToSend.append("status", formData.status);
      }

      // Admins/managers can explicitly update workflow status.
      // Regular users omit it so the backend can keep the current workflow
      // or auto-return rejected records to DRAFT when appropriate.
      if (canSelectWorkflowStatus && formData.workflowStatus) {
        formDataToSend.append("workflowStatus", formData.workflowStatus);
      }

      // ✅ IMPORTANT: Always send description to allow updates/clearing
      // Rejection reasons are pre-cleaned during form load
      formDataToSend.append("description", formData.description || "");

      // ===== Add propertyAddress as JSON string =====
      const propertyAddress = {
        provinceId: formData.provinceId,
        districtId: formData.districtId,
        communeId: formData.communeId,
        villageId: formData.villageId || undefined,
        street: formData.street || undefined,
        houseNo: formData.houseNo || undefined,
      };
      formDataToSend.append("propertyAddress", JSON.stringify(propertyAddress));

      // ===== Add propertyLocation as JSON string =====
      if (formData.latitude && formData.longitude) {
        const propertyLocation: any = {
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
        };

        const polygonToSend = polygonGeoJson ?? existingPolygon;
        if (polygonToSend) {
          propertyLocation.polygon = polygonToSend;
          logPolygonInfo(polygonToSend, "Submitting Polygon");
        }

        formDataToSend.append(
          "propertyLocation",
          JSON.stringify(propertyLocation)
        );
      }

      // ===== Add land data if applicable =====
      if (isLandProperty) {
        const land = {
          widthMeters: formData.widthMeters
            ? parseFloat(formData.widthMeters)
            : undefined,
          lengthMeters: formData.lengthMeters
            ? parseFloat(formData.lengthMeters)
            : undefined,
          landAreaSqm: formData.landAreaSqm
            ? parseFloat(formData.landAreaSqm)
            : undefined,
          landShape: formData.landShape || undefined,
          topography: formData.topography || undefined,
          sitePosition: formData.sitePosition || undefined,
          waterSource: formData.waterSource || undefined,
        };
        formDataToSend.append("land", JSON.stringify(land));
      }

      // ===== Add agriculture land if applicable =====
      if (isAgricultural && formData.typeofTree) {
        const agricultureLand = {
          typeofTree: formData.typeofTree,
          numberOfTrees: formData.numberOfTrees
            ? parseInt(formData.numberOfTrees)
            : undefined,
          ageOfTrees: formData.ageOfTrees
            ? parseInt(formData.ageOfTrees)
            : undefined,
        };
        formDataToSend.append(
          "agricultureLand",
          JSON.stringify(agricultureLand)
        );
      }
      // ===== Add titleDocument as JSON string =====
      // ⚠️ DO NOT include photo URLs here - they're sent as files separately
      const titleDocument = {
        titleDeedType: formData.titleDeedType,
        titleDeedNo: formData.titleDeedNo,
        issuedYear: formData.issuedYear || undefined,
        parcelNo: formData.parcelNo || undefined,
        totalSizeByTitleDeed: formData.totalSizeByTitleDeed
          ? parseFloat(formData.totalSizeByTitleDeed)
          : undefined,
      };
      const titleDocumentString = JSON.stringify(titleDocument);
      formDataToSend.append("titleDocument", titleDocumentString);

      // ===== Add dataSource as JSON string =====
      const dataSource = {
        sourceType: formData.sourceType,
        contactName: formData.contactName,
        phoneNumber: formData.phoneNumber || undefined,
      };
      formDataToSend.append("dataSource", JSON.stringify(dataSource));

      // ===== Add transaction data if Total Price is provided =====
      if (formData.totalPrice && parseFloat(formData.totalPrice) > 0) {
        const transaction: any = {
          transactionType: normalizedTransactionType,
          transactionDate: formData.transactionDate,
          totalPrice: parseFloat(formData.totalPrice),
        };
        formDataToSend.append("transaction", JSON.stringify(transaction));
        console.log("📊 Transaction data:", transaction);
      }

      // ===== Add buildings if applicable =====
      if (isBuildingProperty && formData.buildings.length > 0) {
        const isDirectUnitType = requiresDirectUnits;
        const buildings = formData.buildings.map((building) => {
          const parsedBuildingId = building.buildingId
            ? parseInt(building.buildingId, 10)
            : undefined;
          const units =
            building.units.length > 0
              ? building.units.map((unit) => ({
                  buildingUnitId: unit.buildingUnitId
                    ? parseInt(unit.buildingUnitId, 10)
                    : undefined,
                  buildingId: unit.buildingId
                    ? parseInt(unit.buildingId, 10)
                    : parsedBuildingId,
                  unitNo: unit.unitNo,
                  floorNo: unit.floorNo ? parseInt(unit.floorNo) : undefined,
                  floorAreaSqm: unit.floorAreaSqm
                    ? parseFloat(unit.floorAreaSqm)
                    : undefined,
                  totalAreaSqm: unit.totalAreaSqm
                    ? parseFloat(unit.totalAreaSqm)
                    : undefined,
                  numberOfBedrooms: unit.numberOfBedrooms
                    ? parseInt(unit.numberOfBedrooms)
                    : undefined,
                  numberOfBathrooms: unit.numberOfBathrooms
                    ? parseInt(unit.numberOfBathrooms)
                    : undefined,
                  hasKitchen: unit.hasKitchen,
                  hasLivingRoom: unit.hasLivingRoom,
                  hasParkingSpace: unit.hasParkingSpace,
                  constructedYear: unit.constructedYear
                    ? parseInt(unit.constructedYear)
                    : undefined,
                  effectiveAge: unit.effectiveAge
                    ? parseInt(unit.effectiveAge)
                    : undefined,
                  usefulLife: unit.usefulLife
                    ? parseInt(unit.usefulLife)
                    : undefined,
                  unitType: unit.unitType || undefined,
                  costPerSqm: unit.costPerSqm
                    ? parseFloat(unit.costPerSqm)
                    : undefined,
                  replacementCostPerSqm: unit.replacementCostPerSqm
                    ? parseFloat(unit.replacementCostPerSqm)
                    : undefined,
                  totalBuildingCost: unit.totalBuildingCost
                    ? parseFloat(unit.totalBuildingCost)
                    : undefined,
                  physical_condition:
                    normalizePhysicalCondition(unit.physical_condition) ||
                    undefined,
                  managementFee: unit.managementFee || undefined,
                  viewType: unit.viewType || undefined,
                }))
              : undefined;

          // For direct-unit property types, backend expects unit updates without full building payload.
          if (isDirectUnitType) {
            return {
              buildingId: parsedBuildingId,
              units,
            };
          }

          return {
            buildingId: parsedBuildingId,
            buildingName: building.buildingName,
            buildingSubtypeId: building.buildingSubtypeId
              ? parseInt(building.buildingSubtypeId, 10)
              : undefined,
            width: building.width ? parseFloat(building.width) : undefined,
            length: building.length ? parseFloat(building.length) : undefined,
            numberOfStorey: building.numberOfStorey
              ? parseInt(building.numberOfStorey)
              : undefined,
            grossAreaSqm: building.grossAreaSqm
              ? parseFloat(building.grossAreaSqm)
              : undefined,
            bedroom: building.bedroom ? parseInt(building.bedroom) : undefined,
            bathroom: building.bathroom ? parseInt(building.bathroom) : undefined,
            livingroom: building.livingroom
              ? parseInt(building.livingroom)
              : undefined,
            kitchen: building.kitchen ? parseInt(building.kitchen) : undefined,
            diningroom: building.diningroom
              ? parseInt(building.diningroom)
              : undefined,
            totalRoom: building.totalRoom
              ? parseInt(building.totalRoom)
              : undefined,
            parkingSpace: building.parkingSpace
              ? parseInt(building.parkingSpace)
              : undefined,
            constructionYear: building.constructionYear
              ? parseInt(building.constructionYear)
              : undefined,
            effectiveAge: building.effectiveAge
              ? parseInt(building.effectiveAge)
              : undefined,
            usefulLife: building.usefulLife
              ? parseInt(building.usefulLife)
              : undefined,
            costPerSqm: building.costPerSqm
              ? parseFloat(building.costPerSqm)
              : undefined,
            replacementCostPerSqm: building.replacementCostPerSqm
              ? parseFloat(building.replacementCostPerSqm)
              : undefined,
            totalBuildingCost: building.totalBuildingCost
              ? parseFloat(building.totalBuildingCost)
              : undefined,
            viewType: normalizeBuildingViewType(building.viewType),
            status: normalizeBuildingStatus(building.status),
            percentageOfConstruction:
              toConstructionPercentageNumber(building.percentageOfConstruction),
            totalUnits: building.totalUnits
              ? parseInt(building.totalUnits)
              : building.units.length
              ? building.units.length
              : undefined,
            // ⚠️ DO NOT include building image URL - sent as file separately
            units,
          };
        });
        const buildingString = JSON.stringify(buildings);
        formDataToSend.append("building", buildingString);
      }

      // ===== ✅ ADD PHOTO FILES =====
      console.log("📸 Photo state:", {
        frontSide: photos.frontSide?.name,
        inside: photos.inside?.name,
        leftSide: photos.leftSide?.name,
        rightSide: photos.rightSide?.name,
        opposite: photos.opposite?.name,
        buildingImage: photos.buildingImage?.name,
        coverPhoto: photos.coverPhoto?.name,
        backSidePhoto: photos.backSidePhoto?.name,
        gallery: photos.gallery.length,
      });

      // Property photo

      if (photos.frontSide instanceof File) {
        formDataToSend.append("frontSide", photos.frontSide);
        console.log("✅ Added frontSide:", photos.frontSide.name);
      }
      if (photos.inside instanceof File) {
        formDataToSend.append("inside", photos.inside);
        console.log("✅ Added inside:", photos.inside.name);
      }
      if (photos.leftSide instanceof File) {
        formDataToSend.append("leftSide", photos.leftSide);
        console.log("✅ Added leftSide:", photos.leftSide.name);
      }
      if (photos.rightSide instanceof File) {
        formDataToSend.append("rightSide", photos.rightSide);
        console.log("✅ Added rightSide:", photos.rightSide.name);
      }
      if (photos.opposite instanceof File) {
        formDataToSend.append("opposite", photos.opposite);
        console.log("✅ Added opposite:", photos.opposite.name);
      }
      if (photos.buildingImage instanceof File) {
        formDataToSend.append("buildingImage", photos.buildingImage);
        console.log("✅ Added buildingImage:", photos.buildingImage.name);
      }
      if (photos.coverPhoto instanceof File) {
        formDataToSend.append("coverPhoto", photos.coverPhoto);
        console.log("✅ Added coverPhoto:", photos.coverPhoto.name);
      }
      if (photos.backSidePhoto instanceof File) {
        formDataToSend.append("backSidePhoto", photos.backSidePhoto);
        console.log("✅ Added backSidePhoto:", photos.backSidePhoto.name);
      }
      if (photos.gallery.length > 0) {
        photos.gallery.forEach((file, index) => {
          if (file instanceof File) {
            formDataToSend.append("gallery", file);
            console.log(`✅ Added gallery[${index}]:`, file.name);
          }
        });
      }

      if (photos.buildingImages?.length) {
        photos.buildingImages.forEach((buildingFiles, buildingIndex) => {
          buildingFiles.forEach((file) => {
            if (file instanceof File) {
              formDataToSend.append(`buildingImage${buildingIndex}`, file);
              console.log(`✅ Added buildingImage${buildingIndex}:`, file.name);
            }
          });
        });
      }

      const deletedImagesList: string[] = [];

      if (imagesToDelete.frontSide) deletedImagesList.push("frontSide");
      if (imagesToDelete.inside) deletedImagesList.push("inside");
      if (imagesToDelete.leftSide) deletedImagesList.push("leftSide");
      if (imagesToDelete.rightSide) deletedImagesList.push("rightSide");
      if (imagesToDelete.opposite) deletedImagesList.push("opposite");
      if (imagesToDelete.buildingImage) deletedImagesList.push("buildingImage");

      // ⚠️ Map frontend state names to backend DB column names
      if (imagesToDelete.coverPhoto) deletedImagesList.push("coverPhotoUrl");
      if (imagesToDelete.backSidePhoto)
        deletedImagesList.push("backSidePhotoUrl");

      // Send as a JSON string that the backend Controller can parse
      if (deletedImagesList.length > 0) {
        console.log("🗑️ Sending deletedImages list:", deletedImagesList);
        formDataToSend.append(
          "deletedImages",
          JSON.stringify(deletedImagesList)
        );
      }

      for (let [key, value] of formDataToSend.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: [File] ${value.name} (${value.size} bytes)`);
        } else {
          console.log(`  ${key}:`, value);
        }
      }

      // ✅ USE THE MUTATION HOOK (not direct axios call)
      await updateMutation.mutateAsync({
        id: propertyId,
        data: formDataToSend,
      });

      console.log("✅ Property updated successfully");
      setSubmitSuccess(true);

      // clear deletion flags
      setImagesToDelete({
        frontSide: false,
        inside: false,
        leftSide: false,
        rightSide: false,
        opposite: false,
        buildingImage: false,
        coverPhoto: false,
        backSidePhoto: false,
        gallery: [],
      });

      // Redirect after success
      toast.success(t("propertyUpdatedSuccess"));
      setTimeout(() => router.push(`/dashboard/property/${propertyId}`), 2000);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          t("propertyUpdateFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  if (isLoadingProperty) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">{t("loadingPropertyData")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className=" border border-red-200 rounded-lg p-6 max-w-md">
            <p className="text-red-800 font-medium mb-2">
              Error loading property
            </p>
            <p className="text-red-600 text-sm">{error.message}</p>
            <Button
              onClick={() => router.push("/dashboard/property")}
              className="mt-4"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Properties
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className=" border border-yellow-200 rounded-lg p-6 max-w-md">
            <p className="text-yellow-800 font-medium mb-2">
              Property not found
            </p>
            <p className="text-yellow-600 text-sm">
              The property you're looking for doesn't exist.
            </p>
            <Button
              onClick={() => router.push("/dashboard/property")}
              className="mt-4"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Properties
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const ownerId = property.createdBy ?? property.createdByUser?.id;
  const isOwner = typeof ownerId === "number" && user?.id === ownerId;

  if (isDataEntry && !isOwner) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className="border border-red-200 rounded-lg p-6 max-w-md">
            <p className="text-red-800 font-medium mb-2">Access denied</p>
            <p className="text-red-600 text-sm">
              You can only edit properties that you created.
            </p>
            <Button
              onClick={() => router.push("/dashboard/property")}
              className="mt-4"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Properties
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-muted/30 to-background">
      <PropertyPageHeader
        title={t("editPropertyTitle")}
        subtitle={`Property ID: #${propertyId} • ${formData.propertyName}`}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitButtonText={t("saveChanges")}
        savingText={t("saving")}
        onBack={() => router.push(`/dashboard/property/${propertyId}`)}
      />

      {/* Content */}
      <div className="max-w-8xl mx-auto px-4 pb-8 pt-6 ">
        <Tabs
          value={currentTab}
          onValueChange={setCurrentTab}
          className="space-y-6"
        >
          <div className="sticky top-[77px] z-40 rounded-md border-b bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basic"
              className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
              >{t("basicInfo")}</TabsTrigger>
              <TabsTrigger value="details"
              className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
              >{t("advancedInfo")}</TabsTrigger>
              <TabsTrigger value="address"
              className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
              >{t("propertyAddress")}</TabsTrigger>
              <TabsTrigger value="documents"
              className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
              >
                {t("certificateOfOwnership")}
              </TabsTrigger>
              <TabsTrigger value="source"
              className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
              >{t("dataSource")}</TabsTrigger>
              <TabsTrigger value="transaction"
              className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
              >{t("transaction")}</TabsTrigger>
            </TabsList>
          </div>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <BasicInfoTab
              formData={{
                propertyName: formData.propertyName,
                status: formData.status,
                workflowStatus: formData.workflowStatus,
                propertyTypeId: formData.propertyTypeId,
                propertySubtypeId: formData.propertySubtypeId,
                currentUseId: formData.currentUseId,
                description: formData.description || "",
              }}
              propertyTypes={propertyTypes}
              onInputChange={handleInputChange}
              onReset={resetBasicTab}
              canSelectStatus={canSelectStatus}
              canSelectWorkflowStatus={canSelectWorkflowStatus}
              showWorkflowStatus={canSelectWorkflowStatus}
              t={t}
            />
          </TabsContent>

          {/* Address Tab */}
          <TabsContent value="address" className="space-y-6">
            <AddressTab
              formData={formData}
              addressCodes={addressCodes}
              resolvedAddressItems={resolvedAddressItems}
              onInputChange={handleInputChange}
              onAddressChange={handleAddressChange}
              onCoordinatesChange={handleMapCoordinatesChange}
              onReverseGeocode={handleReverseGeocode}
              onShapesChange={handleShapesChange}
              shapes={shapes}
              existingPolygon={existingPolygon}
              disableBoundaryPinUpdate={true}
              enableShapeDrawing={true}
              showMap={true}
              mapHeight="700px"
              isReverseGeocoding={isReverseGeocoding}
              onReset={resetAddressTab}
              t={t}
            />
          </TabsContent>

                    {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    {t("propertyAdvancedInfo")}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetDetailsTab}
                    className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t("resetToOriginal")}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {isLandProperty && (
              <LandInformationCard
                formData={{
                  widthMeters: formData.widthMeters,
                  lengthMeters: formData.lengthMeters,
                  landAreaSqm: formData.landAreaSqm,
                  landShape: formData.landShape,
                  topography: formData.topography,
                  sitePosition: formData.sitePosition,
                  waterSource: formData.waterSource,
                  typeofTree: formData.typeofTree,
                  numberOfTrees: formData.numberOfTrees,
                  ageOfTrees: formData.ageOfTrees,
                }}
                onInputChange={handleInputChange}
                isAgricultural={isAgricultural}
                t={t}
              />
            )}

            {isBuildingProperty && !requiresDirectUnits && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        {t("buildings")} ({formData.buildings.length})
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("addBuildingDetails")} {selectedPropertyType?.propertyName}
                      </p>
                    </div>
                    <Button
                      onClick={addBuilding}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      type="button"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("addBuilding")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.buildings.map((building, idx) => (
                    <PropertyBuildingCard
                      key={idx}
                      index={idx}
                      building={building}
                      allBuildings={formData.buildings}
                      isLandAndBuilding={isLandAndBuilding}
                      totalPrice={formData.totalPrice}
                      landAreaSqm={formData.landAreaSqm}
                      totalSizeByTitleDeed={formData.totalSizeByTitleDeed}
                      photoPreviews={photoPreview.buildingImages[idx] || []}
                      availableBuildingSubtypes={availableBuildingSubtypes}
                      availableUnitTypes={availableUnitTypes}
                      onUpdate={(field, val) => updateBuilding(idx, field, val)}
                      onRemove={() => removeBuilding(idx)}
                      onAddUnit={() => addUnit(idx)}
                      onRemoveUnit={(uIdx) => removeUnit(idx, uIdx)}
                      onUpdateUnit={(uIdx, field, val) => updateUnit(idx, uIdx, field, val)}
                      onImageUpload={(files) => handleBuildingImageUpload(idx, files)}
                      onRemoveImage={(imgIdx) => removeBuildingImage(idx, imgIdx)}
                      onAutoCalculateGrossArea={() => autoCalculateGrossArea(idx)}
                      onAutoCalculateTotalRooms={() => autoCalculateTotalRooms(idx)}
                      onAutoCalculateEffectiveAge={() => autoCalculateEffectiveAge(idx)}
                      onAutoCalculateUnitEffectiveAge={(uIdx) => autoCalculateUnitEffectiveAge(idx, uIdx)}
                      t={t}
                    />
                  ))}

                  {formData.buildings.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                      <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                      <p className="text-slate-600 mb-4">
                        No buildings added yet
                      </p>
                      <Button
                        onClick={addBuilding}
                        variant="outline"
                        className="border-blue-600 text-blue-600 hover:bg-blue-50"
                        type="button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Your First Building
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {requiresDirectUnits && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        Building Units (
                        {formData.buildings[0]?.units.length || 0})
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("addIndividualUnits")} {selectedPropertyType?.propertyName}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        if (formData.buildings.length === 0) {
                          addBuilding();
                        }
                        addUnit(0);
                      }}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      type="button"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Unit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.buildings[0]?.units.map((unit, unitIndex) => (
                    <PropertyUnitCard
                      key={unitIndex}
                      unit={unit}
                      index={unitIndex}
                      onUpdate={(field, val) => {
                        updateUnit(0, unitIndex, field, val);
                        if (field === "floorAreaSqm") autoCalculateUnitCost(0, unitIndex);
                      }}
                      onRemove={() => removeUnit(0, unitIndex)}
                      totalSizeByTitleDeed={formData.totalSizeByTitleDeed || "0"}
                      onAutoCalculateEffectiveAge={() => autoCalculateUnitEffectiveAge(0, unitIndex)}
                      availableUnitTypes={availableUnitTypes}
                      t={t}
                    />
                  ))}

                  {formData.buildings[0]?.units.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg bg-gray-50">
                      <Home className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-3">
                        No units added yet
                      </p>
                      <Button
                        onClick={() => {
                          if (formData.buildings.length === 0) {
                            addBuilding();
                          }
                          addUnit(0);
                        }}
                        size="sm"
                        variant="outline"
                        type="button"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add First Unit
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <PhotoUploadTab
              photos={photos}
              photoPreview={photoPreview}
              onPhotoUpload={handlePhotoUpload}
              onRemovePhoto={removePhoto}
              t={t}
            />
          </TabsContent>

                    {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <DocumentsTab
              formData={formData}
              handleInputChange={handleInputChange}
              photoPreviews={photoPreview}
              onUpload={handlePhotoUpload}
              onRemove={removePhoto}
              onReset={resetDocumentsTab}
            />
          </TabsContent>

                    {/* Data Source Tab */}
          <TabsContent value="source" className="space-y-6">
            <DataSourceTab
              formData={formData}
              onInputChange={handleInputChange}
              onReset={resetSourceTab}
              t={t}
              tc={tCommon}
            />
          </TabsContent>

                    {/* Transaction Tab */}
          <TabsContent value="transaction" className="space-y-6">
            <TransactionTab
              formData={formData}
              onInputChange={handleInputChange}
              onReset={resetTransactionTab}
              t={t}
              tc={tCommon}
            />
          </TabsContent>
        </Tabs>

              {/* Navigation Footer */}
        <PropertyNavigationFooter
          currentTab={currentTab}
          isSubmitting={isSubmitting}
          onPrevious={() => {
            const tabs = [
              "basic",
              "details",
              "address",
              "documents",
              "source",
              "transaction",
            ];
            const currentIndex = tabs.indexOf(currentTab);
            if (currentIndex > 0) {
              setCurrentTab(tabs[currentIndex - 1]);
            }
          }}
          onNext={() => {
            const tabs = [
              "basic",
              "details",
              "address",
              "documents",
              "source",
              "transaction",
            ];
            const currentIndex = tabs.indexOf(currentTab);
            if (currentIndex < tabs.length - 1) {
              setCurrentTab(tabs[currentIndex + 1]);
            }
          }}
          onSubmit={handleSubmit}
          translations={{
            previous: tCommon("previous"),
            next: tCommon("next"),
            createProperty: t("updatePropertyButton"),
          }}
        /></div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog.onConfirm}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              Reset to Original
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}





