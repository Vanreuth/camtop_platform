"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Home,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useCreateProperty } from "@/hooks/property/useProperty";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/auth/useAuth";
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
import { DrawnShape } from "@/types/googleMap.types";
import { BasicInfoTab } from "@/components/property/BasicInfoTab";
import { LandInformationCard } from "@/components/property/LandInformationCard";

import { AddressTab } from "@/components/property/AddressTab";
import { DocumentsTab } from "@/components/property/DocumentsTab";
import { DataSourceTab } from "@/components/property/DataSourceTab";
import { TransactionTab } from "@/components/property/TransactionTab";
import {PhotoUploadTab} from  "@/components/property/PhotoUploadTab"
import { PropertyNavigationFooter } from "@/components/property/PropertyNavigationFooter";
import { PropertyPageHeader } from "@/components/property/PropertyPageHeader";

import { convertShapesToGeoJson } from "@/utils/geoJsonConverter";
import type {
  BuildingData,
  AddressCodes,
  ConfirmDialogState,
  PropertyFormData,
} from "@/types/property.types";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { PROPERTY_TYPE_IDS } from "@/constants/propertyConstants"
import { PropertyBuildingCard } from "@/components/property/PropertyBuildingCard";
import { PropertyUnitCard } from "@/components/property/PropertyUnitCard";
import { GeoJsonPolygon } from "@/hooks/propertyValuation/propertyValuation.types";
import { getUnitTypeOptions } from "@/constants/buildingUnitOptions";
import { normalizePhysicalCondition } from "@/utils/physicalCondition";
import { toConstructionPercentageNumber } from "@/utils/constructionPercentage";
import { normalizeTransactionType } from "@/constants/transactionOptions";
import { propertyAddressService } from "@/hooks/propertyAddress/propertyAddress.service";
import {
  ensureResolvedAddressHierarchy,
  completeResolvedHierarchyFromDetectedAddress as completeResolvedHierarchyFromDetectedAddressShared,
  type ResolvedAddressDraft,
} from "@/utils/propertyAddressResolution";
import type { ResolvedAddressHierarchyItems } from "@/types/propertyAddress.types";

const DEFAULT_ADDRESS_LATITUDE = 11.5564;
const DEFAULT_ADDRESS_LONGITUDE = 104.9282;
const DEFAULT_ADDRESS_LATITUDE_TEXT = DEFAULT_ADDRESS_LATITUDE.toFixed(6);
const DEFAULT_ADDRESS_LONGITUDE_TEXT = DEFAULT_ADDRESS_LONGITUDE.toFixed(6);
const EMPTY_ADD_PROPERTY_ADDRESS_CODES: AddressCodes = {
  provinceId: null,
  districtId: null,
  communeId: null,
  villageId: null,
};
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

const PROPERTY_TABS = [
  "basic",
  "details",
  "address",
  "documents",
  "source",
  "transaction",
] as const;

type PropertyTab = (typeof PROPERTY_TABS)[number];
type PropertyFieldErrorMap = Partial<Record<keyof PropertyFormData, string>>;

export default function AddPropertyPage() {
  const router = useRouter();
  const createProperty = useCreateProperty();
  const t = useTranslations("properties");
  const tc = useTranslations("common");
  const { hasHierarchyLevel } = useAuth();
  const canSelectStatus = hasHierarchyLevel(2); // Admin/Manager = level <= 2
  const canSelectWorkflowStatus = hasHierarchyLevel(2); // Admin/Manager = level <= 2
  const [currentTab, setCurrentTab] = useState<PropertyTab>("basic");
  const [fieldErrors, setFieldErrors] = useState<PropertyFieldErrorMap>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shapes, setShapes] = useState<DrawnShape[]>([]);
  // Store GeoJSON separately to preserve polygon data even if Google Maps objects lose reference
  const [polygonGeoJson, setPolygonGeoJson] = useState<GeoJsonPolygon | null>(null);

  const clearFieldErrors = useCallback(
    (...fields: Array<keyof PropertyFormData>) => {
      setFieldErrors((prev) => {
        const next = { ...prev };
        let changed = false;

        fields.forEach((item) => {
          if (next[item]) {
            delete next[item];
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    },
    []
  );

  const propertyTypes = usePropertyTypes();

  //
  const handleBuildingImageUpload = (
    buildingIndex: number,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // Update files state
    setPhotos((prev) => {
      const newBuildingImages = [...prev.buildingImages];
      // Ensure array is large enough
      while (newBuildingImages.length <= buildingIndex) {
        newBuildingImages.push([]);
      }
      // Add new files to this building's array
      newBuildingImages[buildingIndex] = [
        ...(newBuildingImages[buildingIndex] || []),
        ...fileArray,
      ];
      return { ...prev, buildingImages: newBuildingImages };
    });

    // Generate previews
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

  // Remove specific building image
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
  // ============================================
  // 🧮 AUTO-CALCULATE GROSS AREA
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

  // Auto-calculate total rooms
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

  // Form state
  const [formData, setFormData] = useState({
    propertyName: "",
    propertyTypeId: "",
    propertySubtypeId: "",
    currentUseId: "",
    status: "ACTIVE",
    workflowStatus: "DRAFT",
    description: "",
    provinceId: "",
    districtId: "",
    communeId: "",
    villageId: "",
    street: "",
    houseNo: "",
    latitude: DEFAULT_ADDRESS_LATITUDE_TEXT,
    longitude: DEFAULT_ADDRESS_LONGITUDE_TEXT,
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

  // Address codes state
  const [addressCodes, setAddressCodes] = useState<AddressCodes>(
    EMPTY_ADD_PROPERTY_ADDRESS_CODES
  );
  const [resolvedAddressItems, setResolvedAddressItems] =
    useState<ResolvedAddressHierarchyItems>(EMPTY_RESOLVED_ADDRESS_ITEMS);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const lastResolvedAddressKeyRef = useRef("");
  const activeResolveRequestRef = useRef(0);
  const preserveTypedDetectedAddressRef = useRef(false);
  const resolvedCanonicalAddressRef = useRef("");
  const hasAddressResolutionInteractionRef = useRef(false);
  const addressResolutionSourceRef = useRef<"coordinates" | "formattedAddress">(
    "coordinates"
  );

  // Photos state
  const [photos, setPhotos] = useState({
    frontSide: null as File | null,
    inside: null as File | null,
    leftSide: null as File | null,
    rightSide: null as File | null,
    opposite: null as File | null,
    buildingImage: null as File | null,
    gallery: [] as File[],
    buildingImages: [] as File[][],
    coverPhoto: null as File | null,
    backSidePhoto: null as File | null,
  });

  // Photo preview state
  const [photoPreview, setPhotoPreview] = useState({
    frontSide: "",
    inside: "",
    leftSide: "",
    rightSide: "",
    opposite: "",
    buildingImage: "",
    gallery: [] as string[],
    buildingImages: [] as string[][],
    coverPhoto: "",
    backSidePhoto: "",
  });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  // Calculated price per sqm state
  const [calculatedPricePerSqm, setCalculatedPricePerSqm] = useState<
    number | null
  >(null);
  const [referenceArea, setReferenceArea] = useState<number>(0);

  // ============================================
  // 🔄 INITIAL STATE CONSTANTS FOR RESET
  // ============================================
  const INITIAL_BASIC_STATE = {
    propertyName: "",
    propertyTypeId: "",
    propertySubtypeId: "",
    currentUseId: "",
    status: "",
    description: "",
  };

  const INITIAL_DETAILS_STATE = {
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
  };

  const INITIAL_ADDRESS_STATE = {
    provinceId: "",
    districtId: "",
    communeId: "",
    villageId: "",
    street: "",
    houseNo: "",
    latitude: DEFAULT_ADDRESS_LATITUDE_TEXT,
    longitude: DEFAULT_ADDRESS_LONGITUDE_TEXT,
    formattedAddress: "",
    placeId: "",
  };

  const INITIAL_DOCUMENTS_STATE = {
    titleDeedType: "",
    titleDeedNo: "",
    issuedYear: "",
    parcelNo: "",
    totalSizeByTitleDeed: "",
  };

  const INITIAL_SOURCE_STATE = {
    sourceType: "OWNERSHIP",
    contactName: "",
    phoneNumber: "",
  };

  const INITIAL_TRANSACTION_STATE = {
    transactionType: "SALE",
    transactionDate: new Date().toISOString().split("T")[0],
    totalPrice: "",
  };

  // ============================================
  // 🔄 RESET HANDLERS FOR EACH TAB
  // ============================================
  const resetBasicTab = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Clear Basic Information",
      description:
        "Are you sure you want to clear all basic information? This action cannot be undone.",
      onConfirm: () => {
        setFormData((prev) => ({ ...prev, ...INITIAL_BASIC_STATE }));
        clearFieldErrors("propertyTypeId", "currentUseId");
        toast.success("Basic information cleared");
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resetDetailsTab = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Clear Property Details",
      description:
        "Are you sure you want to clear all property details including buildings? This action cannot be undone.",
      onConfirm: () => {
        setFormData((prev) => ({ ...prev, ...INITIAL_DETAILS_STATE }));
        setPhotos((prev) => ({
          ...prev,
          buildingImages: [],
        }));
        setPhotoPreview((prev) => ({
          ...prev,
          buildingImages: [],
        }));
        toast.success("Property details cleared");
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resetAddressTab = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Clear Address Information",
      description:
        "Are you sure you want to clear all address and location information? This action cannot be undone.",
      onConfirm: () => {
        setFormData((prev) => ({ ...prev, ...INITIAL_ADDRESS_STATE }));
        clearFieldErrors(
          "provinceId",
          "districtId",
          "communeId",
          "latitude",
          "longitude"
        );
        setAddressCodes({ ...EMPTY_ADD_PROPERTY_ADDRESS_CODES });
        setResolvedAddressItems({ ...EMPTY_RESOLVED_ADDRESS_ITEMS });
        setIsResolvingAddress(false);
        lastResolvedAddressKeyRef.current = "";
        activeResolveRequestRef.current = 0;
        preserveTypedDetectedAddressRef.current = false;
        resolvedCanonicalAddressRef.current = "";
        hasAddressResolutionInteractionRef.current = false;
        addressResolutionSourceRef.current = "coordinates";
        toast.success("Address information cleared");
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resetDocumentsTab = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Clear Documents & Photos",
      description:
        "Are you sure you want to clear all title deed information and uploaded photos? This action cannot be undone.",
      onConfirm: () => {
        setFormData((prev) => ({ ...prev, ...INITIAL_DOCUMENTS_STATE }));
        clearFieldErrors("titleDeedType", "totalSizeByTitleDeed");
        setPhotos((prev) => ({
          ...prev,
          front: null,
          back: null,
          left: null,
          right: null,
          titleDeed: null,
          gallery: [],
        }));
        setPhotoPreview((prev) => ({
          ...prev,
          front: "",
          back: "",
          left: "",
          right: "",
          titleDeed: "",
          gallery: [],
        }));
        toast.success("Documents and photos cleared");
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resetSourceTab = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Clear Data Source Information",
      description:
        "Are you sure you want to clear all data source information? This action cannot be undone.",
      onConfirm: () => {
        setFormData((prev) => ({ ...prev, ...INITIAL_SOURCE_STATE }));
        clearFieldErrors("sourceType", "phoneNumber");
        toast.success("Data source information cleared");
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resetTransactionTab = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Clear Transaction Information",
      description:
        "Are you sure you want to clear all transaction information? This action cannot be undone.",
      onConfirm: () => {
        setFormData((prev) => ({
          ...prev,
          ...INITIAL_TRANSACTION_STATE,
          transactionDate: new Date().toISOString().split("T")[0],
        }));
        clearFieldErrors("transactionType", "transactionDate", "totalPrice");
        toast.success("Transaction information cleared");
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // ============================================
  // 📍 GOOGLE MAP AUTO-INPUT HANDLER
  // ============================================
  // 1. Handle Coordinates Change (Drag Pin or Click)
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
      clearFieldErrors("latitude", "longitude");
    },
    [clearFieldErrors]
  );

  // 2. Handle Manual Dropdown Changes
  const handleAddressChange = useCallback((address: AddressCodes) => {
    setAddressCodes(address);
    setResolvedAddressItems(EMPTY_RESOLVED_ADDRESS_ITEMS);
    setFormData((prev) => ({
      ...prev,
      provinceId: address.provinceId ?? "",
      districtId: address.districtId ?? "",
      communeId: address.communeId ?? "",
      villageId: address.villageId ?? "",
    }));
    clearFieldErrors("provinceId", "districtId", "communeId");
  }, [clearFieldErrors]);

  const completeResolvedHierarchyFromDetectedAddress = useCallback(
    async (
      resolved: ResolvedAddressDraft,
      detectedAddressOverride?: string | null
    ): Promise<ResolvedAddressDraft> => {
      const typedAddress = (
        detectedAddressOverride ?? formData.formattedAddress
      ).trim();
      const shouldUseDetectedAddress =
        addressResolutionSourceRef.current === "formattedAddress" ||
        typedAddress.length > 0;

      if (!shouldUseDetectedAddress || !typedAddress) {
        return resolved;
      }

      return completeResolvedHierarchyFromDetectedAddressShared(resolved, typedAddress);
    },
    [formData.formattedAddress]
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
    const nextCodes: AddressCodes = {
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

  // 3. Handle Map Shape Changes (Drawing on Map)
  // Use a ref to track if polygon was ever drawn - once set, preserve until explicitly cleared
  const hadPolygonDrawnRef = useRef(false);
  
  const handleShapesChange = useCallback((newShapes: DrawnShape[]) => {
    setShapes(newShapes);
    
    // Convert to GeoJSON immediately and store it
    // This ensures we capture the polygon data before Google Maps objects might lose reference
    if (newShapes.length > 0) {
      const geoJson = convertShapesToGeoJson(newShapes);
      if (geoJson) {
        setPolygonGeoJson(geoJson);
        hadPolygonDrawnRef.current = true; // Mark that user drew a polygon
      }
    } else if (hadPolygonDrawnRef.current && polygonGeoJson) {
      // User had polygon before, and we still have GeoJSON stored
      // This is likely a component remount - PRESERVE the GeoJSON
      // Don't clear polygonGeoJson - it will be sent with the form submission
    }
  }, [polygonGeoJson]);

  // 4. Handle Reverse Geocode Data (Auto-populate address from map pin)
  const handleReverseGeocode = useCallback(async (data: {
    formattedAddress?: string;
    resolvedFormattedAddress?: string;
    placeId?: string;
    street?: string;
    houseNumber?: string;
    streetNumber?: string;
    provinceId?: string;
    districtId?: string;
    communeId?: string;
    villageId?: string;
    provinceCode?: string;
    districtCode?: string;
    communeCode?: string;
    villageCode?: string;
    latitude?: number;
    longitude?: number;
    coordinates?: { latitude?: number; longitude?: number };
    formatted_address?: string;
    place_id?: string;
    geometry?: {
      location?:
        | {
            lat?: number | (() => number);
            lng?: number | (() => number);
          }
        | null;
    };
    addressComponents?: Array<{ long_name?: string; types?: string[] }>;
    address_components?: Array<{ long_name?: string; types?: string[] }>;
  }) => {
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
      !formData.formattedAddress.trim();

    if (isInitialDefaultReverseGeocode) {
      return;
    }

    const findComponent = (type: string) =>
      addressComponents.find((component) =>
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
      province: null,
      district: null,
      commune: null,
      village: null,
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
        console.error("Failed to normalize reverse geocode payload", error);
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
        console.error("Failed to complete typed detected address hierarchy", error);
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
        console.error("Failed to complete reverse geocoded address hierarchy", error);
      }
    }

    const normalizedLatitude = normalizedResolved.latitude;
    const normalizedLongitude = normalizedResolved.longitude;

    if (shouldPreferTypedDetectedAddress) {
      lastResolvedAddressKeyRef.current = `address:${typedDetectedAddress.toLowerCase()}`;
      addressResolutionSourceRef.current = "formattedAddress";
    } else if (normalizedLatitude != null && normalizedLongitude != null) {
      if (shouldPreserveManualCoordinates) {
        normalizedResolved = {
          ...normalizedResolved,
          latitude: currentLatitude,
          longitude: currentLongitude,
        };
        lastResolvedAddressKeyRef.current = `coords:${currentLatitude.toFixed(6)}:${currentLongitude.toFixed(6)}`;
      } else {
        lastResolvedAddressKeyRef.current = `coords:${normalizedLatitude.toFixed(6)}:${normalizedLongitude.toFixed(6)}`;
      }
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
    const isDefaultCoordinates =
      hasValidCoordinates &&
      Math.abs(latitude - DEFAULT_ADDRESS_LATITUDE) < 0.000001 &&
      Math.abs(longitude - DEFAULT_ADDRESS_LONGITUDE) < 0.000001;

    const payload = shouldResolveFromDetectedAddress
      ? { formattedAddress: trimmedAddress }
      : !hasAddressResolutionInteractionRef.current &&
        isDefaultCoordinates &&
        trimmedAddress.length === 0
      ? null
      : hasValidCoordinates
      ? { latitude, longitude }
      : trimmedAddress.length >= 6
      ? { formattedAddress: trimmedAddress }
      : null;

    if (!payload) {
      setIsResolvingAddress(false);
      lastResolvedAddressKeyRef.current = "";
      return;
    }

    const isCoordinatePayload =
      "latitude" in payload &&
      "longitude" in payload &&
      typeof payload.latitude === "number" &&
      typeof payload.longitude === "number";
    const resolutionKey = isCoordinatePayload
      ? `coords:${payload.latitude.toFixed(6)}:${payload.longitude.toFixed(6)}`
      : `address:${trimmedAddress.toLowerCase()}`;

    if (lastResolvedAddressKeyRef.current === resolutionKey) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = activeResolveRequestRef.current + 1;
      activeResolveRequestRef.current = requestId;
      setIsResolvingAddress(true);

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

        const nextLatitude = nextResolved.latitude;
        const nextLongitude = nextResolved.longitude;

        if (
          nextLatitude != null &&
          nextLongitude != null &&
          !shouldResolveFromDetectedAddress
        ) {
          addressResolutionSourceRef.current = "coordinates";
          lastResolvedAddressKeyRef.current = `coords:${nextLatitude.toFixed(6)}:${nextLongitude.toFixed(6)}`;
        } else {
          if (shouldResolveFromDetectedAddress) {
            addressResolutionSourceRef.current = "formattedAddress";
          }
          lastResolvedAddressKeyRef.current = resolutionKey;
        }

        applyResolvedAddress(nextResolved);
      } catch (error) {
        if (activeResolveRequestRef.current === requestId) {
          console.error("Failed to resolve property address", error);
        }
      } finally {
        if (activeResolveRequestRef.current === requestId) {
          setIsResolvingAddress(false);
        }
      }
    }, hasValidCoordinates ? 400 : 700);

    return () => window.clearTimeout(timeoutId);
  }, [
    applyResolvedAddress,
    completeResolvedHierarchyFromDetectedAddress,
    formData.formattedAddress,
    formData.latitude,
    formData.longitude,
  ]);

  // Get selected property type details
  const selectedPropertyType = useMemo(() => {
    return propertyTypes.find(
      (pt) => pt.propertyTypeId === parseInt(formData.propertyTypeId)
    );
  }, [formData.propertyTypeId, propertyTypes]);

  const availableBuildingSubtypes = useMemo(() => {
    return selectedPropertyType?.buildingSubtypes || [];
  }, [selectedPropertyType]);

  const availableUnitTypes = useMemo(() => {
    return getUnitTypeOptions(formData.propertyTypeId);
  }, [formData.propertyTypeId]);

  const handlePhotoUpload = (
    field: keyof typeof photos,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

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
      const file = files[0];
      setPhotos((prev) => ({ ...prev, [field]: file }));

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview((prev) => ({
          ...prev,
          [field]: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
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
    } else {
      setPhotos((prev) => ({ ...prev, [field]: null }));
      setPhotoPreview((prev) => ({ ...prev, [field]: "" }));
    }
  };

  // Reset subtype and current use when property type changes
  useEffect(() => {
    if (formData.propertyTypeId) {
      setFormData((prev) => ({
        ...prev,
        propertySubtypeId: "",
        currentUseId: "",
      }));
    }
  }, [formData.propertyTypeId]);

  // Determine property characteristics
  const isLandProperty = useMemo(() => {
    return (
      selectedPropertyType?.recordType.recordTypeId === 1 ||
      selectedPropertyType?.recordType.recordTypeId === 3
    );
  }, [selectedPropertyType]);

  const isBuildingProperty = useMemo(() => {
    return (
      selectedPropertyType?.recordType.recordTypeId === 2 ||
      selectedPropertyType?.recordType.recordTypeId === 3
    );
  }, [selectedPropertyType]);

  // Enhanced logic for land with building and only building
  const isLandAndBuilding = useMemo(() => {
    return selectedPropertyType?.recordType.recordTypeId === 3;
  }, [selectedPropertyType]);

  const isOnlyBuilding = useMemo(() => {
    return selectedPropertyType?.recordType.recordTypeId === 2;
  }, [selectedPropertyType]);

  const isAgricultural = useMemo(() => {
    return (
      selectedPropertyType?.propertyTypeId === 2 ||
      selectedPropertyType?.propertyTypeId === 5
    );
  }, [selectedPropertyType]);

  const requiresDirectUnits = useMemo(() => {
    // Property types 3 and 4 are Residential Building and Commercial Building
    return formData.propertyTypeId === "3" || formData.propertyTypeId === "4";
  }, [formData.propertyTypeId]);

  // Initialize building automatically for direct unit entry with one default unit
  useEffect(() => {
    if (requiresDirectUnits && formData.buildings.length === 0) {
      // Create building with one default unit in a single state update
      setFormData((prev) => ({
        ...prev,
        buildings: [
          {
            buildingName: "",
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
            totalUnits: "1",
            units: [
              {
                unitNo: "0001",
                unitType: "",
                floorNo: "1",
                floorAreaSqm: "",
                totalAreaSqm: "",
                numberOfBedrooms: "1",
                numberOfBathrooms: "1",
                hasKitchen: true,
                hasLivingRoom: true,
                hasParkingSpace: false,
                constructedYear: new Date().getFullYear().toString(),
                usefulLife: "",
                effectiveAge: "",
                costPerSqm: "",
                replacementCostPerSqm: "",
                totalBuildingCost: "",
                physical_condition: "",
                managementFee: "",
                viewType: "",
              },
            ],
          },
        ],
      }));
      // Initialize empty image arrays
      setPhotos((prev) => ({
        ...prev,
        buildingImages: [[]],
      }));
      setPhotoPreview((prev) => ({
        ...prev,
        buildingImages: [[]],
      }));
    }
  }, [requiresDirectUnits]);

  // Initialize building automatically for regular building properties (without direct units)
  useEffect(() => {
    if (
      isBuildingProperty &&
      !requiresDirectUnits &&
      formData.buildings.length === 0
    ) {
      // Create building with empty units array
      setFormData((prev) => ({
        ...prev,
        buildings: [
          {
            buildingName: "",
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
            usefulLife: "50", // Default to 50 years (backend requirement: must be >0)
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
        buildingImages: [[]],
      }));
      setPhotoPreview((prev) => ({
        ...prev,
        buildingImages: [[]],
      }));
    }
  }, [isBuildingProperty, requiresDirectUnits]);

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
        clearFieldErrors("latitude", "longitude");
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
        clearFieldErrors("latitude", "longitude");
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
    clearFieldErrors(field as keyof PropertyFormData);
  };
  const addBuilding = () => {
    setFormData((prev) => ({
      ...prev,
      buildings: [
        ...prev.buildings,
        {
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
          usefulLife: "50", // Default to 50 years (backend requirement: must be >0)
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
    setPhotos((prev) => ({
      ...prev,
      buildingImages: prev.buildingImages.filter((_, i) => i !== index),
    }));
    setPhotoPreview((prev) => ({
      ...prev,
      buildingImages: prev.buildingImages.filter((_, i) => i !== index),
    }));
    setPhotoPreview((prev) => ({
      ...prev,
      buildingImages: prev.buildingImages.filter((_, i) => i !== index),
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
                  unitNo: `${String(b.units.length + 1).padStart(4, "0")}`,
                  unitType: "",
                  floorNo: "1",
                  floorAreaSqm: "",
                  totalAreaSqm: "",
                  numberOfBedrooms: "1",
                  numberOfBathrooms: "1",
                  hasKitchen: true,
                  hasLivingRoom: true,
                  hasParkingSpace: false,
                  constructedYear: new Date().getFullYear().toString(),
                  usefulLife: "",
                  effectiveAge: "",
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

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const normalizedTransactionType = normalizeTransactionType(
        formData.transactionType
      );

      // Utility function to convert null to undefined
      const cleanNullValues = (obj: any): any => {
        if (obj === null) return undefined;
        if (typeof obj === "number" && Number.isNaN(obj)) return undefined;
        if (obj === "") return undefined;
        if (Array.isArray(obj)) {
          return obj.map(cleanNullValues);
        }
        if (typeof obj === "object" && obj !== null) {
          const cleaned: any = {};
          for (const key in obj) {
            const value = cleanNullValues(obj[key]);
            if (value !== undefined) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        }
        return obj;
      };

      // Validation grouped by tab so submit can focus the user on the right section.
      const errorsByTab: Record<PropertyTab, string[]> = {
        basic: [],
        details: [],
        address: [],
        documents: [],
        source: [],
        transaction: [],
      };
      const nextFieldErrors: PropertyFieldErrorMap = {};
      const pushValidationError = (
        tab: PropertyTab,
        message: string,
        field?: keyof PropertyFormData,
      ) => {
        errorsByTab[tab].push(message);
        if (field && !nextFieldErrors[field]) {
          nextFieldErrors[field] = message;
        }
      };

      // Required fields validation
      if (!formData.propertyTypeId) {
        pushValidationError("basic", t("propertyTypeRequired"), "propertyTypeId");
      }
      if (!formData.currentUseId) {
        pushValidationError("basic", t("currentUseRequired"), "currentUseId");
      }
      if (!formData.titleDeedType) {
        pushValidationError("documents", t("titleDeedTypeRequired"), "titleDeedType");
      }
      // Title document validation
      if (!formData.totalSizeByTitleDeed) {
        pushValidationError("documents", t("totalSizeByTitleDeedRequired"), "totalSizeByTitleDeed");
      }
      if (formData.totalSizeByTitleDeed) {
        const size = parseFloat(formData.totalSizeByTitleDeed);
        if (isNaN(size) || size <= 0) {
          pushValidationError("documents", "Total size by title deed must be a positive number", "totalSizeByTitleDeed");
        } else if (size < 10) {
          pushValidationError("documents", "Total size by title deed must be at least 10 m²", "totalSizeByTitleDeed");
        } else if (size > 1000000) {
          pushValidationError("documents", "Total size by title deed cannot exceed 1,000,000 m²", "totalSizeByTitleDeed");
        }
      }

      if (!formData.provinceId) {
        pushValidationError("address", t("provinceRequired"), "provinceId");
      }
      if (!formData.districtId) {
        pushValidationError("address", t("districtRequired"), "districtId");
      }
      if (!formData.communeId) {
        pushValidationError("address", t("communeRequired"), "communeId");
      }

      // Coordinates validation
      if (formData.latitude) {
        const lat = parseFloat(formData.latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          pushValidationError("address", "Latitude must be between -90 and 90", "latitude");
        }
      }
      if (formData.longitude) {
        const lng = parseFloat(formData.longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          pushValidationError("address", "Longitude must be between -180 and 180", "longitude");
        }
      }

      // Land dimensions validation
      if (isOnlyBuilding) {
        // For only building, land fields should be empty or ignored
        if (
          formData.widthMeters ||
          formData.lengthMeters ||
          formData.landAreaSqm
        ) {
          pushValidationError(
            "details",
            "Land fields should not be filled for building-only property"
          );
        }
      } else if (isLandProperty) {
        // For land-based properties, land dimensions are optional but must be positive if provided
        if (formData.widthMeters) {
          const width = parseFloat(formData.widthMeters);
          if (isNaN(width) || width <= 0) {
            pushValidationError("details", "Width must be a positive number");
          }
        }
        if (formData.lengthMeters) {
          const length = parseFloat(formData.lengthMeters);
          if (isNaN(length) || length <= 0) {
            pushValidationError("details", "Length must be a positive number");
          }
        }
        if (formData.landAreaSqm) {
          const area = parseFloat(formData.landAreaSqm);
          if (isNaN(area) || area <= 0) {
            pushValidationError("details", "Land area must be a positive number");
          }
        }
      }

      // Building dimensions validation
      if (isBuildingProperty) {
        if (formData.totalFloors) {
          const floors = parseInt(formData.totalFloors);
          if (isNaN(floors) || floors <= 0 || floors > 200) {
            pushValidationError("details", "Total floors must be between 1 and 200");
          }
        }
        if (formData.builtYear) {
          const year = parseInt(formData.builtYear);
          const currentYear = new Date().getFullYear();
          if (isNaN(year) || year < 1900 || year > currentYear + 5) {
            pushValidationError(
              "details",
              `Built year must be between 1900 and ${currentYear + 5}`
            );
          }
        }
        if (formData.buildingAreaSqm) {
          const area = parseFloat(formData.buildingAreaSqm);
          if (isNaN(area) || area <= 0) {
            pushValidationError("details", "Building area must be a positive number");
          }
        }
        if (formData.floorAreaSqm) {
          const area = parseFloat(formData.floorAreaSqm);
          if (isNaN(area) || area <= 0) {
            pushValidationError("details", "Floor area must be a positive number");
          }
        }
        if (formData.bedrooms) {
          const beds = parseInt(formData.bedrooms);
          if (isNaN(beds) || beds < 0 || beds > 100) {
            pushValidationError("details", "Bedrooms must be between 0 and 100");
          }
        }
        if (formData.bathrooms) {
          const baths = parseInt(formData.bathrooms);
          if (isNaN(baths) || baths < 0 || baths > 100) {
            pushValidationError("details", "Bathrooms must be between 0 and 100");
          }
        }
      }

      // Building + Unit type validation
      if (isBuildingProperty) {
        const totalUnits = formData.buildings.reduce(
          (sum, building) => sum + building.units.length,
          0
        );

        if (requiresDirectUnits && totalUnits === 0) {
          pushValidationError(
            "details",
            "At least one unit is required for this property type."
          );
        }

        formData.buildings.forEach((building, buildingIndex) => {
          if (!requiresDirectUnits && !building.buildingSubtypeId?.trim()) {
            pushValidationError(
              "details",
              `Building ${buildingIndex + 1}: Construction type is required`
            );
          }

          building.units.forEach((unit, unitIndex) => {
            if (!unit.unitType?.trim()) {
              pushValidationError(
                "details",
                `Building ${buildingIndex + 1}, Unit ${
                  unitIndex + 1
                }: Unit type is required`
              );
            }
          });
        });
      }

      // Data source validation
      if (!formData.sourceType) {
        pushValidationError("source", t("sourceTypeRequired"), "sourceType");
      }
      if (!formData.phoneNumber?.trim()) {
        pushValidationError("source", t("phoneNumberRequired"), "phoneNumber");
      }
      if (formData.phoneNumber) {
        // Basic phone validation (adjust pattern as needed)
        const phonePattern = /^[\d\s\-\+\(\)]+$/;
        if (!phonePattern.test(formData.phoneNumber)) {
          pushValidationError("source", "Phone number contains invalid characters", "phoneNumber");
        }
      }

      // Transaction validation - All fields are required

      // Transaction Type validation
      if (!normalizedTransactionType) {
        pushValidationError("transaction", t("transactionTypeRequired"));
      }

      // Transaction Date validation
      if (!formData.transactionDate || formData.transactionDate.trim() === "") {
        pushValidationError("transaction", t("transactionDateRequired"));
      }

      // Total Price validation
      if (!formData.totalPrice || !formData.totalPrice.trim()) {
        pushValidationError("transaction", t("totalPriceRequired"));
      } else {
        const totalPrice = parseFloat(formData.totalPrice);
        if (isNaN(totalPrice) || totalPrice <= 0) {
          pushValidationError("transaction", t("totalPricePositive"));
        }
      }

      // Validate building requirements only if transaction price is valid
      if (formData.totalPrice && formData.totalPrice.trim()) {
        const totalPrice = parseFloat(formData.totalPrice);
        if (!isNaN(totalPrice) && totalPrice > 0) {
          // Validation: Only require building data for property types that use residual method
          const propertyTypeId = parseInt(formData.propertyTypeId);
          const requiresBuildingForResidual =
            propertyTypeId === PROPERTY_TYPE_IDS.AGRICULTURAL_PROPERTY || // Type 5
            propertyTypeId === PROPERTY_TYPE_IDS.RESIDENTIAL_PROPERTY || // Type 6
            propertyTypeId === PROPERTY_TYPE_IDS.COMMERCIAL_PROPERTY || // Type 7
            propertyTypeId === PROPERTY_TYPE_IDS.INDUSTRIAL_PROPERTY || // Type 8
            propertyTypeId === PROPERTY_TYPE_IDS.SPECIALIZED_PROPERTY; // Type 9

          if (requiresBuildingForResidual) {
            // These property types need building data for residual method calculation
            if (formData.buildings.length > 0) {
              const invalidResidualBuildings = formData.buildings
                .map((building, buildingIndex) => {
                  const hasValidResidualInputs =
                    !!building.grossAreaSqm &&
                    parseFloat(building.grossAreaSqm) > 0 &&
                    !!building.replacementCostPerSqm &&
                    parseFloat(building.replacementCostPerSqm) > 0 &&
                    !!building.usefulLife &&
                    parseFloat(building.usefulLife) > 0;

                  return hasValidResidualInputs ? null : buildingIndex + 1;
                })
                .filter((value): value is number => value !== null);

              if (invalidResidualBuildings.length > 0) {
                pushValidationError(
                  "details",
                  `🏗️ Residual Method requires valid Gross Area, Replacement Cost per m², and Useful Life for every building. Missing in Building: ${invalidResidualBuildings.join(
                    ", "
                  )}.`
                );
              }
            } else {
              pushValidationError(
                "details",
                "🏗️ This property type with transaction requires at least one building with 'Replacement Cost per m²' for Residual Method calculation."
              );
            }
          }
          // For vacant land (Type 1-2) and building units (Type 3-4), no building validation needed
          // They use simple land area or unit floor area calculations
        }
      }

      const firstInvalidTab = PROPERTY_TABS.find(
        (tab) => errorsByTab[tab].length > 0
      );

      if (firstInvalidTab) {
        setFieldErrors(nextFieldErrors);
        [...new Set(errorsByTab[firstInvalidTab])]
          .slice(0, 5)
          .forEach((error) => toast.error(error));
        setCurrentTab(firstInvalidTab);
        setIsSubmitting(false);
        return;
      }

      setFieldErrors({});

      // ==========================================
      // 📦 BUILD PAYLOAD
      // ==========================================

      // Build payload
      const payload: any = {
        propertyName: formData.propertyName?.trim() || undefined,
        description: formData.description || undefined,
        propertyTypeId: parseInt(formData.propertyTypeId),
        propertySubtypeId: formData.propertySubtypeId
          ? parseInt(formData.propertySubtypeId)
          : undefined,
        currentUseId: parseInt(formData.currentUseId),
        status: formData.status,
        workflowStatus: formData.workflowStatus || undefined,
        propertyAddress: {
          // Required fields must be strings (not undefined) for backend validation
          provinceId: formData.provinceId,
          districtId: formData.districtId,
          communeId: formData.communeId,
          villageId: formData.villageId || undefined,

          street: formData.street || undefined,
          houseNo: formData.houseNo || undefined,
        },
        propertyLocation: {
          latitude: formData.latitude
            ? parseFloat(formData.latitude)
            : undefined,
          longitude: formData.longitude
            ? parseFloat(formData.longitude)
            : undefined,
          formattedAddress: formData.formattedAddress || undefined,
          placeId: formData.placeId || undefined,
          // Use stored GeoJSON polygon (captured immediately when shapes changed)
          // This preserves polygon data even if Google Maps objects lose reference
          polygon: polygonGeoJson || undefined,
        },
        titleDocument: {
          titleDeedType: formData.titleDeedType || undefined,
          titleDeedNo: formData.titleDeedNo || undefined,
          issuedYear: formData.issuedYear || undefined,
          parcelNo: formData.parcelNo || undefined,
          totalSizeByTitleDeed: formData.totalSizeByTitleDeed
            ? parseFloat(formData.totalSizeByTitleDeed)
            : undefined,
        },
        dataSource: {
          sourceType: formData.sourceType,
          contactName: formData.contactName || undefined,
          phoneNumber: formData.phoneNumber || undefined,
        },
      };

      // Clean all null values from payload
      const cleanedPayload = cleanNullValues(payload);

      // Add land data for land-based properties
      if (isLandProperty) {
        cleanedPayload.land = cleanNullValues({
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
        });
      } else if (isOnlyBuilding) {
        // Do not include land for building-only
        delete cleanedPayload.land;
      }

      // Add agriculture data
      if (isAgricultural) {
        cleanedPayload.agricultureLand = cleanNullValues({
          typeofTree: formData.typeofTree || undefined,
          numberOfTrees: formData.numberOfTrees
            ? parseInt(formData.numberOfTrees)
            : undefined,
          ageOfTrees: formData.ageOfTrees
            ? parseInt(formData.ageOfTrees)
            : undefined,
        });
      }

      // Add buildings data
      // For Property Types 3 & 4 (Residential/Commercial Buildings), send units WITHOUT building parent
      // For other types, send buildings WITH units
      if (formData.buildings.length > 0) {
        const isDirectUnitType = requiresDirectUnits; // Property types 3 & 4

        cleanedPayload.building = formData.buildings.map((b) => {
          // Map units with all required fields including inheritance support
          const units =
            b.units.length > 0
              ? b.units.map((u) =>
                  cleanNullValues({
                    unitNo: u.unitNo,
                    unitType: u.unitType || undefined,
                    floorNo: u.floorNo ? parseInt(u.floorNo) : undefined,
                    floorAreaSqm: u.floorAreaSqm
                      ? parseFloat(u.floorAreaSqm)
                      : undefined,
                    totalAreaSqm: u.totalAreaSqm
                      ? parseFloat(u.totalAreaSqm)
                      : undefined,
                    numberOfBedrooms: u.numberOfBedrooms
                      ? parseInt(u.numberOfBedrooms)
                      : undefined,
                    numberOfBathrooms: u.numberOfBathrooms
                      ? parseInt(u.numberOfBathrooms)
                      : undefined,
                    hasKitchen: u.hasKitchen,
                    hasLivingRoom: u.hasLivingRoom,
                    hasParkingSpace: u.hasParkingSpace,
                    constructedYear: u.constructedYear
                      ? parseInt(u.constructedYear)
                      : undefined,
                    effectiveAge: u.effectiveAge
                      ? parseInt(u.effectiveAge)
                      : undefined,
                    usefulLife: u.usefulLife
                      ? parseInt(u.usefulLife)
                      : undefined,
                    costPerSqm: u.costPerSqm
                      ? parseFloat(u.costPerSqm)
                      : undefined,
                    replacementCostPerSqm: u.replacementCostPerSqm
                      ? parseFloat(u.replacementCostPerSqm)
                      : undefined,
                    totalBuildingCost: u.totalBuildingCost
                      ? parseFloat(u.totalBuildingCost)
                      : undefined,
                    physical_condition:
                      normalizePhysicalCondition(u.physical_condition) ||
                      undefined,
                    managementFee: u.managementFee || undefined,
                    viewType: u.viewType || undefined,
                  })
                )
              : [];

          // For direct unit types (3 & 4), return minimal building data as container
          // Backend will create units WITHOUT building record
          if (isDirectUnitType) {
            return cleanNullValues({
              // Send minimal building data - backend won't create building record
              // Only units will be created directly under property
              units: units.length > 0 ? units : undefined,
            });
          }

          // For other property types, include full building details
          // Backend will create building THEN units with buildingId link
          const building = cleanNullValues({
            buildingName: b.buildingName || undefined,
            buildingSubtypeId: b.buildingSubtypeId
              ? parseInt(b.buildingSubtypeId, 10)
              : undefined,
            width: b.width ? parseFloat(b.width) : undefined,
            length: b.length ? parseFloat(b.length) : undefined,
            numberOfStorey: b.numberOfStorey
              ? parseInt(b.numberOfStorey)
              : undefined,
            grossAreaSqm: b.grossAreaSqm
              ? parseFloat(b.grossAreaSqm)
              : undefined,
            bedroom: b.bedroom ? parseInt(b.bedroom) : undefined,
            bathroom: b.bathroom ? parseInt(b.bathroom) : undefined,
            livingroom: b.livingroom ? parseInt(b.livingroom) : undefined,
            kitchen: b.kitchen ? parseInt(b.kitchen) : undefined,
            diningroom: b.diningroom ? parseInt(b.diningroom) : undefined,
            totalRoom: b.totalRoom ? parseInt(b.totalRoom) : undefined,
            parkingSpace: b.parkingSpace ? parseInt(b.parkingSpace) : undefined,
            constructionYear: b.constructionYear
              ? parseInt(b.constructionYear)
              : undefined,
            effectiveAge: b.effectiveAge ? parseInt(b.effectiveAge) : undefined,
            usefulLife: b.usefulLife ? parseInt(b.usefulLife) : undefined,
            costPerSqm: b.costPerSqm ? parseFloat(b.costPerSqm) : undefined,
            replacementCostPerSqm: b.replacementCostPerSqm
              ? parseFloat(b.replacementCostPerSqm)
              : undefined,
            totalBuildingCost: b.totalBuildingCost
              ? parseFloat(b.totalBuildingCost)
              : undefined,
            viewType: b.viewType || undefined,
            status: b.status,
            percentageOfConstruction: toConstructionPercentageNumber(
              b.percentageOfConstruction
            ),
            totalUnits: units.length,
            units: units.length > 0 ? units : undefined,
          });

          return building;
        });
      }

      const totalPriceValue = parseFloat(formData.totalPrice);
      cleanedPayload.transaction = cleanNullValues({
        transactionType: normalizedTransactionType ?? "SALE",
        transactionDate: formData.transactionDate,
        totalPrice: totalPriceValue,
      });

      // ==========================================
      // 📤 PREPARE FORMDATA FOR FILE UPLOADS
      // ==========================================
      const formDataToSend = new FormData();
      // Add all JSON fields directly to FormData
      Object.keys(cleanedPayload).forEach((key) => {
        if (
          typeof cleanedPayload[key] === "object" &&
          cleanedPayload[key] !== null
        ) {
          // For nested objects, stringify them
          const jsonValue = JSON.stringify(cleanedPayload[key]);
          formDataToSend.append(key, jsonValue);
        } else if (
          cleanedPayload[key] !== null &&
          cleanedPayload[key] !== undefined
        ) {
          formDataToSend.append(key, cleanedPayload[key].toString());
        }
      });

      // Add property photos
      if (photos.frontSide)
        formDataToSend.append("frontSide", photos.frontSide);
      if (photos.inside) formDataToSend.append("inside", photos.inside);
      if (photos.leftSide) formDataToSend.append("leftSide", photos.leftSide);
      if (photos.rightSide)
        formDataToSend.append("rightSide", photos.rightSide);
      if (photos.opposite) formDataToSend.append("opposite", photos.opposite);
      if (photos.buildingImage)
        formDataToSend.append("buildingImage", photos.buildingImage);

      // Add gallery photos
      photos.gallery.forEach((file) => {
        formDataToSend.append(`gallery`, file);
      });

      // Add building images
      photos.buildingImages.forEach((buildingFiles, buildingIndex) => {
        buildingFiles.forEach((file) => {
          formDataToSend.append(`buildingImage${buildingIndex}`, file);
        });
      });

      // Add title document photos
      if (photos.coverPhoto)
        formDataToSend.append("coverPhoto", photos.coverPhoto);
      if (photos.backSidePhoto)
        formDataToSend.append("backSidePhoto", photos.backSidePhoto);

      // ==========================================
      // 🚀 CALL API & HANDLE RESPONSE
      // ==========================================

      const result = await createProperty.mutateAsync(formDataToSend);

      // Navigate to property detail page after a brief delay
      const propertyId = result.propertyId ?? result.id;
      setTimeout(() => {
        if (propertyId) {
          router.push(`/dashboard/property/${propertyId}?from=create`);
        } else {
          router.push("/dashboard/property");
        }
      }, 2000);
    } catch {
      // Error toast is already handled in useCreateProperty.onError
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <PropertyPageHeader
        title={t("addNewProperty")}
        subtitle={t("completeAllFields")}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitButtonText={t("saveProperty")}
        savingText={t("saving")}
      />
      {/* Content */}
      <div className="max-w-8xl mx-auto px-4 pb-8 pt-6">
        <Tabs
          value={currentTab}
          onValueChange={(value) => setCurrentTab(value as PropertyTab)}
          className="space-y-6"
        >
          <div className="sticky top-[77px] z-40 bg-background/95border-b shadow-sm rounded-md backdrop-blur  supports-[backdrop-filter]:bg-background/60">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basic" 
              className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
              >{t("basicInfo")}</TabsTrigger>
              <TabsTrigger value="details" className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground">{t("advancedInfo")}</TabsTrigger>
              <TabsTrigger value="address" className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground">{t("propertyAddress")}</TabsTrigger>
              <TabsTrigger value="documents" className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground">
                {t("certificateOfOwnership")}
              </TabsTrigger>
              <TabsTrigger value="source" className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground">{t("dataSource")}</TabsTrigger>
              <TabsTrigger value="transaction" className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground">{t("transaction")}</TabsTrigger>
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
                description: formData.description,
              }}
              propertyTypes={propertyTypes}
              onInputChange={handleInputChange}
              onReset={resetBasicTab}
              canSelectStatus={canSelectStatus}
              canSelectWorkflowStatus={canSelectWorkflowStatus}
              showWorkflowStatus={canSelectWorkflowStatus}
              fieldErrors={fieldErrors}
              onClearFieldError={(field) =>
                clearFieldErrors(field as keyof PropertyFormData)
              }
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
                {t("clearTab")}
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
                        {t("addBuildingDetails")}{" "}
                        {selectedPropertyType?.propertyName}
                      </p>
                    </div>
                    <Button
                      onClick={addBuilding}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
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
                        {t("addIndividualUnits")}{" "}
                        {selectedPropertyType?.propertyName}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        // Ensure we have a default building container
                        if (formData.buildings.length === 0) {
                          addBuilding();
                        }
                        addUnit(0);
                      }}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Unit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Show only units, no building details */}
                  {formData.buildings[0]?.units.map((unit, unitIndex) => (
                    <PropertyUnitCard
                      key={unitIndex}
                      unit={unit}
                      index={unitIndex}
                      onUpdate={(field, val) => {
                        updateUnit(0, unitIndex, field, val);
                        if (field === 'floorAreaSqm') autoCalculateUnitCost(0, unitIndex);
                      }}
                      onRemove={() => removeUnit(0, unitIndex)}
                      totalSizeByTitleDeed={formData.totalSizeByTitleDeed}
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
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add First Unit
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {/* Property Photos Section */}
            <PhotoUploadTab
            photos={photos}
            photoPreview={photoPreview}
            onPhotoUpload={handlePhotoUpload}
            onRemovePhoto={removePhoto}
            t={t}
          />

          
          </TabsContent>

          {/* Address Tab - Continuing in next message due to length */}
          <TabsContent value="address" className="space-y-6">
            <AddressTab
              formData={formData}
              addressCodes={addressCodes}
              resolvedAddressItems={resolvedAddressItems}
              onInputChange={handleInputChange}
              onAddressChange={handleAddressChange}
              onCoordinatesChange={handleMapCoordinatesChange}
              onReverseGeocode={handleReverseGeocode}
              isReverseGeocoding={isResolvingAddress}
              onShapesChange={handleShapesChange}
              shapes={shapes}
              disableBoundaryPinUpdate={true}
              enableShapeDrawing={true}
              showMap={true}
              mapHeight="700px"
              requiredCoordinates={true}
              fieldErrors={fieldErrors}
              t={t}
              onReset={resetAddressTab}
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
              fieldErrors={fieldErrors}
              onClearFieldError={clearFieldErrors}
            />
          </TabsContent>

          {/* Data Source Tab */}
          <TabsContent value="source" className="space-y-6">
            <DataSourceTab
              formData={formData}
              onInputChange={handleInputChange}
              onReset={resetSourceTab}
              fieldErrors={fieldErrors}
              onClearFieldError={(field) =>
                clearFieldErrors(field as keyof PropertyFormData)
              }
              t={t}
              tc={tc}
            />
          </TabsContent>
          {/* Transaction Tab */}
          <TabsContent value="transaction" className="space-y-6">
            <TransactionTab
              formData={formData}
              onInputChange={handleInputChange}
              onReset={resetTransactionTab}
              fieldErrors={fieldErrors}
              onClearFieldError={(field) =>
                clearFieldErrors(field as keyof PropertyFormData)
              }
              t={t}
              tc={tc}
            />
          </TabsContent>
        </Tabs>

        {/* Navigation Footer */}
        <PropertyNavigationFooter
          currentTab={currentTab}
          isSubmitting={isSubmitting}
          onPrevious={() => {
            const currentIndex = PROPERTY_TABS.indexOf(currentTab);
            if (currentIndex > 0) {
              setCurrentTab(PROPERTY_TABS[currentIndex - 1]);
            }
          }}
          onNext={() => {
            const currentIndex = PROPERTY_TABS.indexOf(currentTab);
            if (currentIndex < PROPERTY_TABS.length - 1) {
              setCurrentTab(PROPERTY_TABS[currentIndex + 1]);
            }
          }}
          onSubmit={handleSubmit}
          translations={{
            previous: tc("previous"),
            next: tc("next"),
            createProperty: "Create Property",
          }}
        />
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
              }
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog.onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
