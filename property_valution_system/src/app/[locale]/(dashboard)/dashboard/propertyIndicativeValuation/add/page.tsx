"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldErrors, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { getApiErrorDescription, getApiErrorMessage } from "@/utils/helpers";
import { PropertyPageHeader } from "@/components/property/PropertyPageHeader";
import { PropertyNavigationFooter } from "@/components/property/PropertyNavigationFooter";
import { IndicativeValuationFinancialPanel } from "@/components/property/IndicativeValuationFinancialPanel";
import { AddressTab } from "@/components/property/AddressTab";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
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
import { useAuth } from "@/hooks/auth/useAuth";
import { useUsers } from "@/hooks/user/useUser";
import { useCreateIndicativeValuation } from "@/hooks/indicativeValuation/useIndicativeValuation";
import { indicativeValuationApi } from "@/hooks/indicativeValuation/indicativeValuation.api";
import {
  calculateIndicativeMetrics,
  createComponentDraft,
  parseNullableNumber,
  type IndicativeComponentDraftValue,
} from "@/hooks/indicativeValuation/indicativeValuation.form";
import type { GeoJsonPolygon } from "@/hooks/propertyValuation/propertyValuation.types";
import { DEFAULT_ADDRESS_CODES } from "@/constants/propertyConstants";
import type { AddressCodes } from "@/hooks/property/property.types";
import type { DrawnShape } from "@/types/googleMap.types";
import { convertShapesToGeoJson, logPolygonInfo } from "@/utils/geoJsonConverter";
import { PREPARED_FOR_OPTIONS } from "@/constants/preparedForOptions";
import { propertyAddressService } from "@/hooks/propertyAddress/propertyAddress.service";
import {
  ensureResolvedAddressHierarchy,
  completeResolvedHierarchyFromDetectedAddress,
  type ResolvedAddressDraft,
} from "@/utils/propertyAddressResolution";
import type { ResolvedAddressHierarchyItems } from "@/types/propertyAddress.types";
import {
  Building2,
  ClipboardList,
  Image as ImageIcon,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  WalletCards,
} from "lucide-react";

const WORKFLOW_STATUS = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
] as const;

const PROPERTY_VALUATION_STATUS = [
  "ACTIVE",
  "SUPERSEDED",
  "EXPIRED",
  "CANCELLED",
] as const;

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

const DEFAULT_NOTE =
  "All information such as land size, building size, location and pictures/images and so on are provided by the bank/client, they are the subjects to be inspected. We, CAMTOP Property Group disclaim all responsibility and will accept no liability to any party";

const requiredText = (message: string) => z.string().trim().min(1, message);

const schema = z.object({
  currency: z.string().min(3).max(3).default("USD"),
  status: z.enum(PROPERTY_VALUATION_STATUS, {
    required_error: "Indicative valuation status is required",
  }),
  workflowStatus: z.enum(WORKFLOW_STATUS, {
    required_error: "Workflow status is required",
  }),
  instructedBy: requiredText("Instructed By is required"),
  contactName: z.string().optional(),
  contactTel: z.string().optional(),
  accessValue: z.string().optional(),
  feeRate: z.string().optional(),
  discount: z.string().optional(),
  valuerId: z.string().optional(),
  inspectorName: z.string().optional(),
  indicationDate: requiredText("Indication Date is required"),
  instructionDate: requiredText("Instruction Date is required"),
  intendedUse: requiredText("Intended Use is required"),
  forcedSalePercent: z.string().optional(),
  note: z.string().optional().default(DEFAULT_NOTE),
  internalNotes: z.string().optional(),
});

type FormInputValues = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;
type TabKey = "introduction" | "property" | "valuation";
type ConfirmDialogState = {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
};
const invalidFieldTabMap = {
  workflowStatus: "introduction",
  status: "introduction",
  instructedBy: "introduction",
  instructionDate: "introduction",
  indicationDate: "introduction",
  intendedUse: "introduction",
} as const satisfies Partial<Record<keyof FormInputValues, TabKey>>;
type ComponentDraft = IndicativeComponentDraftValue;
type NewPropertyDraft = {
  propertyTypeId: string;
  propertySubtypeId: string;
  currentUseId: string;
  propertyName: string;
  description: string;
  provinceId: string;
  districtId: string;
  communeId: string;
  villageId: string;
  street: string;
  houseNo: string;
  latitude: string;
  longitude: string;
  formattedAddress: string;
  placeId: string;
  geolocationLink: string;
};
type PropertyPhotoField = "frontSide" | "inside";
type PropertyPhotoFiles = Record<PropertyPhotoField, File | null>;
type PropertyPhotoPreviews = Record<PropertyPhotoField, string>;

const parseOptionalNumber = (value?: string | number) => {
  if (value === undefined || value === null) return undefined;
  const normalized = typeof value === "string" ? value.trim() : String(value);
  if (!normalized) return undefined;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const parseValidatedCoordinate = (
  value: string,
  min: number,
  max: number,
) => {
  const numeric = parseOptionalNumber(value);
  if (numeric === undefined || numeric < min || numeric > max) return undefined;
  return numeric;
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

const normalizeOptionalText = (value?: string | null) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const hasFilledValue = (value?: string | null) => Boolean(value?.trim());

const renderRequiredLabel = (label: string) => (
  <>
    {label} <span className="text-destructive">*</span>
  </>
);

const buildPropertyAddressInput = (property: NewPropertyDraft) => {
  if (!property.provinceId || !property.districtId || !property.communeId) return undefined;

  return {
    provinceId: property.provinceId,
    districtId: property.districtId,
    communeId: property.communeId,
    villageId: normalizeOptionalText(property.villageId) ?? null,
    street: normalizeOptionalText(property.street) ?? null,
    houseNo: normalizeOptionalText(property.houseNo) ?? null,
    titleAddress: null,
    accessRoads: null,
    neighborLocation: null,
  };
};

const buildLocationInput = (
  property: NewPropertyDraft,
  shapes: DrawnShape[],
  polygonGeoJson: GeoJsonPolygon | null,
) => {
  const latitude = parseOptionalNumber(property.latitude);
  const longitude = parseOptionalNumber(property.longitude);
  const hasLatLng = latitude !== undefined && longitude !== undefined;
  const polygon =
    polygonGeoJson ?? (shapes.length > 0 ? convertShapesToGeoJson(shapes) : null);

  if (polygon) {
    logPolygonInfo(polygon, "Indicative Property Location");
  }

  if (
    !hasLatLng &&
    !normalizeOptionalText(property.formattedAddress) &&
    !normalizeOptionalText(property.placeId) &&
    !normalizeOptionalText(property.geolocationLink) &&
    !polygon
  ) {
    return undefined;
  }

  return {
    latitude: hasLatLng ? latitude : undefined,
    longitude: hasLatLng ? longitude : undefined,
    formattedAddress: normalizeOptionalText(property.formattedAddress),
    placeId: normalizeOptionalText(property.placeId),
    geolocationLink: normalizeOptionalText(property.geolocationLink),
    polygon,
  };
};

const getPolygonCenter = (
  polygon: GeoJsonPolygon | null,
): { latitude: number; longitude: number } | null => {
  const ring = polygon?.coordinates?.[0];
  if (!ring?.length) return null;

  let latSum = 0;
  let lngSum = 0;
  let count = 0;

  ring.forEach((point) => {
    const lng = Number(point?.[0]);
    const lat = Number(point?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    latSum += lat;
    lngSum += lng;
    count += 1;
  });

  if (!count) return null;
  return { latitude: latSum / count, longitude: lngSum / count };
};

const toIndicativeFormData = (
  input: Record<string, unknown>,
  files: PropertyPhotoFiles,
) => {
  const formData = new FormData();

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === "property") return;
    formData.append(key, value instanceof Date ? value.toISOString() : String(value));
  });

  if (input.property) {
    formData.append("property", JSON.stringify(input.property));
  }

  if (files.frontSide) {
    formData.append("frontSide", files.frontSide);
  }

  if (files.inside) {
    formData.append("inside", files.inside);
  }

  return formData;
};

const defaultNewPropertyDraft = (): NewPropertyDraft => ({
  propertyTypeId: "",
  propertySubtypeId: "",
  currentUseId: "",
  propertyName: "",
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
  geolocationLink: "",
});
const defaultPropertyPhotoFiles = (): PropertyPhotoFiles => ({
  frontSide: null,
  inside: null,
});
const defaultPropertyPhotoPreviews = (): PropertyPhotoPreviews => ({
  frontSide: "",
  inside: "",
});

export default function AddPropertyIndicativeValuationPage() {
  const t = useTranslations("indicativeValuation");
  const tc = useTranslations("common");
  const tp = useTranslations("properties");
  const router = useRouter();
  const propertyTypes = usePropertyTypes();
  const { user, hasHierarchyLevel } = useAuth();
  const createMutation = useCreateIndicativeValuation();
  const canAssignValuer = hasHierarchyLevel(2);
  const canSelectStatus = hasHierarchyLevel(2);

  const [activeTab, setActiveTab] = useState<TabKey>("introduction");
  const [components, setComponents] = useState<ComponentDraft[]>([
    createComponentDraft("LAND"),
  ]);
  const [newProperty, setNewProperty] = useState<NewPropertyDraft>(defaultNewPropertyDraft);
  const [shapes, setShapes] = useState<DrawnShape[]>([]);
  const [polygonGeoJson, setPolygonGeoJson] = useState<GeoJsonPolygon | null>(null);
  const [addressCodes, setAddressCodes] = useState<AddressCodes>(DEFAULT_ADDRESS_CODES);
  const [resolvedAddressItems, setResolvedAddressItems] =
    useState<ResolvedAddressHierarchyItems>(EMPTY_RESOLVED_ADDRESS_ITEMS);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const hadPolygonDrawnRef = useRef(false);
  const lastResolvedAddressKeyRef = useRef("");
  const activeResolveRequestRef = useRef(0);
  const preserveTypedDetectedAddressRef = useRef(false);
  const resolvedCanonicalAddressRef = useRef("");
  const hasAddressResolutionInteractionRef = useRef(false);
  const addressResolutionSourceRef = useRef<"coordinates" | "formattedAddress">(
    "coordinates"
  );
  const [propertyPhotoFiles, setPropertyPhotoFiles] = useState<PropertyPhotoFiles>(
    defaultPropertyPhotoFiles,
  );
  const [propertyPhotoPreviews, setPropertyPhotoPreviews] = useState<PropertyPhotoPreviews>(
    defaultPropertyPhotoPreviews,
  );
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const form = useForm<FormInputValues, any, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: "USD",
      status: "ACTIVE",
      workflowStatus: "DRAFT",
      instructedBy: "",
      contactName: "",
      contactTel: "",
      accessValue: "",
      feeRate: "",
      discount: "",
      valuerId: user?.id ? String(user.id) : "",
      inspectorName: "",
      indicationDate: new Date().toISOString().slice(0, 10),
      instructionDate: "",
      intendedUse: "",
      forcedSalePercent: "",
      note: DEFAULT_NOTE,
      internalNotes: "",
    },
  });

  const { data: userListResult } = useUsers(
    { page: 1, limit: 100 },
    { enabled: canAssignValuer },
  );

  const valuers = userListResult?.users ?? [];
  const valuerIdValue = form.watch("valuerId");
  const currency = form.watch("currency") || "USD";
  const accessValueInput = form.watch("accessValue");
  const feeRateInput = form.watch("feeRate");
  const discountInput = form.watch("discount");
  const forcedSalePercentInput = form.watch("forcedSalePercent");

  const selectedValuer = valuers.find(
    (valuer) => String(valuer.id) === valuerIdValue,
  );

  const selectedPropertyType = useMemo(
    () =>
      propertyTypes.find(
        (propertyType: any) =>
          propertyType.propertyTypeId === Number(newProperty.propertyTypeId || 0),
      ),
    [newProperty.propertyTypeId, propertyTypes],
  );

  const availableSubtypes = selectedPropertyType?.subtypes ?? [];
  const availableCurrentUses = selectedPropertyType?.currentUses ?? [];
  const workflowStatusOptions = useMemo(
    () => [
      { value: "DRAFT", label: t("statusLabels.DRAFT") },
      { value: "PENDING_REVIEW", label: t("statusLabels.PENDING_REVIEW") },
      { value: "APPROVED", label: t("statusLabels.APPROVED") },
      { value: "REJECTED", label: t("statusLabels.REJECTED") },
      { value: "ARCHIVED", label: t("statusLabels.ARCHIVED") },
    ],
    [t],
  );

  useEffect(() => {
    if (!canSelectStatus) {
      form.setValue("workflowStatus", "DRAFT");
      form.setValue("status", "ACTIVE");
    }
  }, [canSelectStatus, form]);
  const businessStatusOptions = useMemo(
    () => [
      { value: "ACTIVE", label: t("businessStatus.ACTIVE") },
      { value: "SUPERSEDED", label: t("businessStatus.SUPERSEDED") },
      { value: "EXPIRED", label: t("businessStatus.EXPIRED") },
      { value: "CANCELLED", label: t("businessStatus.CANCELLED") },
    ],
    [t],
  );
  const intendedUseOptions = useMemo(
    () => [
      { value: "MORTGAGE_LOAN", label: t("intendedUseOptions.MORTGAGE_LOAN") },
      { value: "SALE_PURCHASE", label: t("intendedUseOptions.SALE_PURCHASE") },
      { value: "INSURANCE", label: t("intendedUseOptions.INSURANCE") },
      {
        value: "FINANCIAL_REPORTING",
        label: t("intendedUseOptions.FINANCIAL_REPORTING"),
      },
      {
        value: "INVESTMENT_ANALYSIS",
        label: t("intendedUseOptions.INVESTMENT_ANALYSIS"),
      },
      { value: "TAXATION", label: t("intendedUseOptions.TAXATION") },
      { value: "COURT_DISPUTE", label: t("intendedUseOptions.COURT_DISPUTE") },
      { value: "OTHER", label: t("intendedUseOptions.OTHER") },
    ],
    [t],
  );

  const photoFields = useMemo(
    () => [
      { field: "frontSide", label: t("fields.frontViewPhoto") },
      { field: "inside", label: t("fields.insideViewPhoto") },
    ] as const,
    [t],
  );

  const {
    componentRows,
    totalMinMarketValue,
    totalMaxMarketValue,
    automaticAccessValue,
    feeRateValue,
    discountValue,
    forcedSalePercentValue,
    maxChargeFeeValue,
    forcedSaleValue,
    accessValueRangeLabel,
    chargeFeeRangeLabel,
  } = useMemo(
    () =>
      calculateIndicativeMetrics({
        components,
        accessValueInput,
        feeRateInput,
        discountInput,
        forcedSalePercentInput,
        currency,
      }),
    [accessValueInput, components, currency, discountInput, feeRateInput, forcedSalePercentInput],
  );

  const stepItems = useMemo(
    () => [
      {
        key: "introduction" as const,
        label: t("steps.introduction"),
        description: t("steps.introductionDescription"),
        icon: ClipboardList,
      },
      {
        key: "property" as const,
        label: t("steps.property"),
        description: t("steps.propertyDescription"),
        icon: Building2,
      },
      {
        key: "valuation" as const,
        label: t("steps.indicativeValuation"),
        description: t("steps.indicativeValuationDescription"),
        icon: WalletCards,
      },
    ],
    [t],
  );

  const currentStepIndex = stepItems.findIndex((item) => item.key === activeTab);

  const assignedValuerLabel =
    selectedValuer
      ? `${selectedValuer.firstName} ${selectedValuer.lastName}`.trim()
      : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() ||
        user?.username ||
        t("notAssigned");

  const updateNewProperty = (field: keyof NewPropertyDraft, value: string) => {
    setNewProperty((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "propertyTypeId") {
        next.propertySubtypeId = "";
        next.currentUseId = "";
      }
      return next;
    });
  };

  const handleAddressInputChange = useCallback(
    (field: string, value: string) => {
      if (field === "formattedAddress") {
        const nextValue = String(value ?? "");
        const coordinatePair = parseCoordinatePairInput(nextValue);

        hasAddressResolutionInteractionRef.current = nextValue.trim().length > 0;
        preserveTypedDetectedAddressRef.current = !coordinatePair && nextValue.trim().length > 0;
        addressResolutionSourceRef.current = coordinatePair ? "coordinates" : "formattedAddress";
        lastResolvedAddressKeyRef.current = "";

        if (coordinatePair) {
          setNewProperty((prev) => ({
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
          setNewProperty((prev) => ({
            ...prev,
            latitude: coordinatePair.latitude,
            longitude: coordinatePair.longitude,
          }));
          return;
        }
      }

      updateNewProperty(field as keyof NewPropertyDraft, value);
    },
    [],
  );

  const handleAddressChange = useCallback((codes: AddressCodes) => {
    setNewProperty((prev) => ({
      ...prev,
      provinceId: codes.provinceId ?? "",
      districtId: codes.districtId ?? "",
      communeId: codes.communeId ?? "",
      villageId: codes.villageId ?? "",
    }));
    setAddressCodes(codes);
    setResolvedAddressItems(EMPTY_RESOLVED_ADDRESS_ITEMS);
  }, []);

  const handleMapCoordinatesChange = useCallback((coords: { latitude: number; longitude: number }) => {
    hasAddressResolutionInteractionRef.current = true;
    preserveTypedDetectedAddressRef.current = false;
    addressResolutionSourceRef.current = "coordinates";
    setNewProperty((prev) => ({
      ...prev,
      latitude: coords.latitude.toFixed(6),
      longitude: coords.longitude.toFixed(6),
    }));
  }, []);

  const handleShapesChange = useCallback((nextShapes: DrawnShape[]) => {
    setShapes(nextShapes);

    if (nextShapes.length > 0) {
      const geoJson = convertShapesToGeoJson(nextShapes);
      if (geoJson) {
        logPolygonInfo(geoJson, "Indicative Shape Changed");
        setPolygonGeoJson(geoJson);
        hadPolygonDrawnRef.current = true;
        const center = getPolygonCenter(geoJson);
        if (center) {
          setNewProperty((prev) => ({
            ...prev,
            latitude: center.latitude.toFixed(6),
            longitude: center.longitude.toFixed(6),
          }));
        }
      }
      return;
    }

    if (hadPolygonDrawnRef.current && polygonGeoJson) {
      return;
    }

    setPolygonGeoJson(null);
  }, [polygonGeoJson]);

  const applyResolvedAddress = useCallback((resolved: ResolvedAddressDraft) => {
    const hasResolvedHierarchy = Boolean(
      resolved.provinceId ||
        resolved.districtId ||
        resolved.communeId ||
        resolved.villageId
    );

    resolvedCanonicalAddressRef.current =
      resolved.resolvedFormattedAddress?.trim() ?? "";

    setNewProperty((prev) => {
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
          latitude: shouldPreserveManualCoordinates ? prev.latitude : resolved.latitude.toFixed(6),
        }),
        ...(resolved.longitude != null && {
          longitude: shouldPreserveManualCoordinates ? prev.longitude : resolved.longitude.toFixed(6),
        }),
        ...(resolved.formattedAddress &&
          (!preserveTypedDetectedAddressRef.current ||
            !prev.formattedAddress.trim()) && {
            formattedAddress: resolved.formattedAddress,
          }),
        ...(resolved.placeId && { placeId: resolved.placeId }),
        ...(resolved.googleMapLink && { geolocationLink: resolved.googleMapLink }),
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
  }, []);

  useEffect(() => {
    const nextCodes: AddressCodes = {
      provinceId: pickFirstNonEmpty(
        newProperty.provinceId,
        addressCodes.provinceId,
        resolvedAddressItems.province?.code
      ),
      districtId: pickFirstNonEmpty(
        newProperty.districtId,
        addressCodes.districtId,
        resolvedAddressItems.district?.code
      ),
      communeId: pickFirstNonEmpty(
        newProperty.communeId,
        addressCodes.communeId,
        resolvedAddressItems.commune?.code
      ),
      villageId: pickFirstNonEmpty(
        newProperty.villageId,
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

    setNewProperty((prev) => {
      const nextProperty = {
        ...prev,
        provinceId: pickFirstNonEmpty(prev.provinceId, nextCodes.provinceId) ?? "",
        districtId: pickFirstNonEmpty(prev.districtId, nextCodes.districtId) ?? "",
        communeId: pickFirstNonEmpty(prev.communeId, nextCodes.communeId) ?? "",
        villageId: pickFirstNonEmpty(prev.villageId, nextCodes.villageId) ?? "",
      };

      if (
        nextProperty.provinceId === prev.provinceId &&
        nextProperty.districtId === prev.districtId &&
        nextProperty.communeId === prev.communeId &&
        nextProperty.villageId === prev.villageId
      ) {
        return prev;
      }

      return nextProperty;
    });
  }, [
    addressCodes.communeId,
    addressCodes.districtId,
    addressCodes.provinceId,
    addressCodes.villageId,
    newProperty.communeId,
    newProperty.districtId,
    newProperty.provinceId,
    newProperty.villageId,
    resolvedAddressItems.commune?.code,
    resolvedAddressItems.district?.code,
    resolvedAddressItems.province?.code,
    resolvedAddressItems.village?.code,
  ]);

  const handleReverseGeocode = useCallback(async (data: any) => {
    try {
      setIsReverseGeocoding(true);
      const typedDetectedAddress = newProperty.formattedAddress.trim();
      const shouldPreferTypedDetectedAddress =
        preserveTypedDetectedAddressRef.current &&
        addressResolutionSourceRef.current === "formattedAddress" &&
        typedDetectedAddress.length >= 6;
      const currentLatitude = Number.parseFloat(newProperty.latitude);
      const currentLongitude = Number.parseFloat(newProperty.longitude);
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
        !newProperty.latitude &&
        !newProperty.longitude &&
        !newProperty.formattedAddress.trim();

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
        googleMapLink: data.googleMapLink ?? null,
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
      }

      normalizedResolved = await ensureResolvedAddressHierarchy(normalizedResolved);

      const shouldCompleteFromResolvedAddress = !(
        normalizedResolved.provinceId &&
        normalizedResolved.districtId &&
        normalizedResolved.communeId
      );

      if (shouldPreferTypedDetectedAddress) {
        normalizedResolved = await completeResolvedHierarchyFromDetectedAddress(
          {
            ...normalizedResolved,
            formattedAddress: typedDetectedAddress,
          },
          typedDetectedAddress
        );
      } else if (
        shouldCompleteFromResolvedAddress &&
        normalizedResolved.formattedAddress?.trim()
      ) {
        normalizedResolved = await completeResolvedHierarchyFromDetectedAddress(
          normalizedResolved,
          normalizedResolved.formattedAddress.trim()
        );
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
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [applyResolvedAddress, newProperty.formattedAddress, newProperty.latitude, newProperty.longitude]);

  useEffect(() => {
    if (!hasAddressResolutionInteractionRef.current) {
      return;
    }

    const latitude = Number.parseFloat(newProperty.latitude);
    const longitude = Number.parseFloat(newProperty.longitude);
    const hasValidCoordinates =
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180;
    const trimmedAddress = newProperty.formattedAddress.trim();
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
          console.error("Failed to resolve indicative add address", error);
        }
      } finally {
        if (activeResolveRequestRef.current === requestId) {
          setIsReverseGeocoding(false);
        }
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [applyResolvedAddress, newProperty.formattedAddress, newProperty.latitude, newProperty.longitude]);

  const resetAddressTab = useCallback(() => {
    setNewProperty((prev) => ({
      ...prev,
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
      geolocationLink: "",
    }));
    setShapes([]);
    setPolygonGeoJson(null);
    hadPolygonDrawnRef.current = false;
    setAddressCodes(DEFAULT_ADDRESS_CODES);
    setResolvedAddressItems(EMPTY_RESOLVED_ADDRESS_ITEMS);
    setIsReverseGeocoding(false);
    lastResolvedAddressKeyRef.current = "";
    activeResolveRequestRef.current = 0;
    preserveTypedDetectedAddressRef.current = false;
    resolvedCanonicalAddressRef.current = "";
    hasAddressResolutionInteractionRef.current = false;
    addressResolutionSourceRef.current = "coordinates";
    toast.success("Address information cleared");
  }, []);

  const updateComponent = (
    localId: string,
    field: keyof Omit<ComponentDraft, "localId" | "id">,
    value: string,
  ) => {
    setComponents((prev) =>
      prev.map((component) =>
        component.localId === localId ? { ...component, [field]: value } : component,
      ),
    );
  };

  const handlePropertyPhotoUpload = (field: PropertyPhotoField, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setPropertyPhotoFiles((prev) => ({ ...prev, [field]: file }));

    const reader = new FileReader();
    reader.onloadend = () => {
      setPropertyPhotoPreviews((prev) => ({
        ...prev,
        [field]: typeof reader.result === "string" ? reader.result : "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const removePropertyPhoto = (field: PropertyPhotoField) => {
    setPropertyPhotoFiles((prev) => ({ ...prev, [field]: null }));
    setPropertyPhotoPreviews((prev) => ({ ...prev, [field]: "" }));
  };

  const handleComponentTypeChange = (
    localId: string,
    nextType: ComponentDraft["componentType"],
  ) => {
    setComponents((prev) =>
      prev.map((component) => {
        if (component.localId !== localId) return component;

        const previousDefault =
          component.componentType === "LAND"
            ? "Land"
            : component.componentType === "BUILDING"
              ? "Building"
              : "Other";
        const nextDefault =
          nextType === "LAND" ? "Land" : nextType === "BUILDING" ? "Building" : "Other";

        return {
          ...component,
          componentType: nextType,
          description:
            !component.description || component.description === previousDefault
              ? nextDefault
              : component.description,
        };
      }),
    );
  };

  const addComponent = (componentType: "LAND" | "BUILDING" | "OTHER") => {
    setComponents((prev) => [...prev, createComponentDraft(componentType)]);
  };

  const removeComponent = (localId: string) => {
    if (components.length <= 1) {
      toast.error(t("errors.componentRequired"));
      return;
    }
    setComponents((prev) => prev.filter((component) => component.localId !== localId));
  };

  const resetTab = (tab: TabKey) => {
    const values = form.getValues();
    const defaultValuerId = user?.id ? String(user.id) : "";

    setConfirmDialog({
      isOpen: true,
      title: `${tc("clear")} ${stepItems.find((item) => item.key === tab)?.label ?? ""}`,
      description: tc("clearData"),
      onConfirm: () => {
        if (tab === "introduction") {
          form.reset({
            ...values,
            status: "ACTIVE",
            workflowStatus: "DRAFT",
            instructedBy: "",
            indicationDate: new Date().toISOString().slice(0, 10),
            instructionDate: "",
            intendedUse: "",
            note: DEFAULT_NOTE,
          });
        }

        if (tab === "property") {
          setNewProperty(defaultNewPropertyDraft());
          setShapes([]);
          setPolygonGeoJson(null);
          hadPolygonDrawnRef.current = false;
          setAddressCodes(DEFAULT_ADDRESS_CODES);
          setResolvedAddressItems(EMPTY_RESOLVED_ADDRESS_ITEMS);
          setPropertyPhotoFiles(defaultPropertyPhotoFiles());
          setPropertyPhotoPreviews(defaultPropertyPhotoPreviews());
        }

        if (tab === "valuation") {
          form.reset({
            ...values,
            contactName: "",
            contactTel: "",
            accessValue: "",
            feeRate: "",
            discount: "",
            valuerId: defaultValuerId,
            inspectorName: "",
            forcedSalePercent: "",
            internalNotes: "",
          });
          setComponents([createComponentDraft("LAND")]);
        }

        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const goPrevious = () => {
    if (currentStepIndex <= 0) return;
    setActiveTab(stepItems[currentStepIndex - 1].key);
  };

  const goNext = () => {
    if (currentStepIndex >= stepItems.length - 1) return;
    setActiveTab(stepItems[currentStepIndex + 1].key);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const primaryComponent = componentRows[0];
    if (!primaryComponent) {
      toast.error(t("errors.componentRequired"));
      setActiveTab("valuation");
      return;
    }

    const provinceId = pickFirstNonEmpty(newProperty.provinceId, addressCodes.provinceId);
    const districtId = pickFirstNonEmpty(newProperty.districtId, addressCodes.districtId);
    const communeId = pickFirstNonEmpty(newProperty.communeId, addressCodes.communeId);
    const latitude = parseValidatedCoordinate(newProperty.latitude, -90, 90);
    const longitude = parseValidatedCoordinate(newProperty.longitude, -180, 180);

    const propertyErrors: string[] = [];

    if (!newProperty.propertyTypeId) {
      propertyErrors.push(t("errors.propertyTypeRequired"));
    }

    if (!provinceId) {
      propertyErrors.push(t("errors.provinceRequired"));
    }

    if (!districtId) {
      propertyErrors.push(t("errors.districtRequired"));
    }

    if (!communeId) {
      propertyErrors.push(t("errors.communeRequired"));
    }

    if (!hasFilledValue(newProperty.latitude) || !hasFilledValue(newProperty.longitude)) {
      propertyErrors.push(t("errors.coordinatesRequired"));
    } else if (latitude === undefined || longitude === undefined) {
      propertyErrors.push(t("errors.coordinatesInvalid"));
    }

    if (propertyErrors.length > 0) {
      [...new Set(propertyErrors)].slice(0, 5).forEach((message) => toast.error(message));
      setActiveTab("property");
      return;
    }

    if (
      !hasFilledValue(values.contactName) ||
      !hasFilledValue(values.contactTel) ||
      !hasFilledValue(values.note)
    ) {
      toast.error(t("errors.pdfFieldsRequired"));
      setActiveTab("valuation");
      return;
    }

    const primaryIndicationErrors: string[] = [];

    if (!primaryComponent.description.trim()) {
      primaryIndicationErrors.push(t("errors.primaryIndicationDescriptionRequired"));
    }

    if (!primaryComponent.area) {
      primaryIndicationErrors.push(t("errors.primaryIndicationAreaRequired"));
    }

    if (!primaryComponent.minRate) {
      primaryIndicationErrors.push(t("errors.primaryIndicationMinRateRequired"));
    }

    if (!primaryComponent.maxRate) {
      primaryIndicationErrors.push(t("errors.primaryIndicationMaxRateRequired"));
    }

    if (primaryIndicationErrors.length > 0) {
      [...new Set(primaryIndicationErrors)].slice(0, 5).forEach((message) => toast.error(message));
      setActiveTab("valuation");
      return;
    }

    const invalidComponent = componentRows.slice(1).find((component) => {
      const requiresArea =
        component.componentType === "BUILDING" ||
        component.componentType === "OTHER" ||
        component.componentType === "LAND";

      return (
        !component.description.trim() ||
        !component.minRate ||
        !component.maxRate ||
        (requiresArea && !component.area)
      );
    });

    if (invalidComponent) {
      toast.error(t("errors.componentFieldsRequired"));
      setActiveTab("valuation");
      return;
    }

    const propertyDraftForPayload = {
      ...newProperty,
      provinceId: provinceId ?? "",
      districtId: districtId ?? "",
      communeId: communeId ?? "",
      latitude: latitude?.toFixed(6) ?? newProperty.latitude,
      longitude: longitude?.toFixed(6) ?? newProperty.longitude,
    };

    const payload = {
      currency: "USD",
      ...(canSelectStatus
        ? {
            status: values.status,
            workflowStatus: values.workflowStatus,
          }
        : {}),
      instructedBy: normalizeOptionalText(values.instructedBy),
      contactName: normalizeOptionalText(values.contactName),
      contactTel: normalizeOptionalText(values.contactTel),
      accessValue: parseNullableNumber(values.accessValue),
      feeRate: parseNullableNumber(values.feeRate),
      discount: parseNullableNumber(values.discount),
      chargeFee: maxChargeFeeValue > 0 ? maxChargeFeeValue : null,
      valuerId: Number(values.valuerId || user?.id || 0) || undefined,
      inspectorName: normalizeOptionalText(values.inspectorName),
      indicationDate: normalizeOptionalText(values.indicationDate),
      instructionDate: normalizeOptionalText(values.instructionDate),
      intendedUse: normalizeOptionalText(values.intendedUse),
      forcedSalePercent: parseNullableNumber(values.forcedSalePercent),
      note: normalizeOptionalText(values.note),
      internalNotes: normalizeOptionalText(values.internalNotes),
      componentType: primaryComponent.componentType,
      description: normalizeOptionalText(primaryComponent.description),
      area: parseOptionalNumber(primaryComponent.area),
      minRate: primaryComponent.minRateValue,
      maxRate: primaryComponent.maxRateValue,
      property: {
        propertyTypeId: Number(propertyDraftForPayload.propertyTypeId),
        propertySubtypeId: parseOptionalNumber(propertyDraftForPayload.propertySubtypeId),
        currentUseId: parseOptionalNumber(propertyDraftForPayload.currentUseId),
        propertyName: normalizeOptionalText(propertyDraftForPayload.propertyName),
        description: normalizeOptionalText(propertyDraftForPayload.description),
        propertyAddress: buildPropertyAddressInput(propertyDraftForPayload),
        propertyLocation: buildLocationInput(propertyDraftForPayload, shapes, polygonGeoJson),
      },
    };

    const request =
      propertyPhotoFiles.frontSide || propertyPhotoFiles.inside
        ? toIndicativeFormData(payload, propertyPhotoFiles)
        : payload;

    let result: Awaited<ReturnType<typeof indicativeValuationApi.createIndicativeValuation>> | null =
      null;

    try {
      result = await createMutation.mutateAsync(request);
    } catch (error) {
      const description = getApiErrorDescription(error) ?? "";

      if (
        description.includes("property.") ||
        description.includes("propertyId")
      ) {
        setActiveTab("property");
      } else if (
        description.includes("workflowStatus") ||
        description.includes("status") ||
        description.includes("instructedBy") ||
        description.includes("instructionDate") ||
        description.includes("indicationDate") ||
        description.includes("intendedUse") ||
        description.includes("note")
      ) {
        setActiveTab("introduction");
      } else if (
        description.includes("contactName") ||
        description.includes("contactTel") ||
        description.includes("accessValue") ||
        description.includes("feeRate") ||
        description.includes("discount") ||
        description.includes("valuerId") ||
        description.includes("componentType") ||
        description.includes("description") ||
        description.includes("area") ||
        description.includes("minRate") ||
        description.includes("maxRate") ||
        description.includes("internalNotes")
      ) {
        setActiveTab("valuation");
      }

      return;
    }

    if (!result) {
      return;
    }

    if (componentRows.length > 1) {
      try {
        for (const component of componentRows.slice(1)) {
          await indicativeValuationApi.createIndicativeComponent(result.valuationId, {
            componentType: component.componentType,
            description: normalizeOptionalText(component.description),
            area: parseOptionalNumber(component.area),
            minRate: component.minRateValue,
            maxRate: component.maxRateValue,
          });
        }
      } catch (error) {
        toast.error(
          getApiErrorMessage(error, "Failed to create one of the indicative components"),
          {
            description: getApiErrorDescription(error),
          },
        );
        setActiveTab("valuation");
        return;
      }
    }

    router.push(`/dashboard/propertyIndicativeValuation/${result.valuationId}`);
  }, (errors: FieldErrors<FormInputValues>) => {
    const orderedInvalidFields = Object.keys(invalidFieldTabMap).filter(
      (field) => Boolean(errors[field as keyof FormInputValues]),
    ) as Array<keyof typeof invalidFieldTabMap>;

    if (!orderedInvalidFields.length) {
      toast.error(t("errors.pdfFieldsRequired"));
      return;
    }

    const messageByField = {
      workflowStatus: t("errors.workflowStatusRequired"),
      status: t("errors.indicativeValuationStatusRequired"),
      instructedBy: t("errors.instructedByRequired"),
      instructionDate: t("errors.instructionDateRequired"),
      indicationDate: t("errors.indicationDateRequired"),
      intendedUse: t("errors.intendedUseRequired"),
    } as const;

    const messages = orderedInvalidFields
      .map((field) => messageByField[field] ?? errors[field as keyof FormInputValues]?.message)
      .filter((message): message is string => typeof message === "string" && message.trim().length > 0);

    [...new Set(messages)].slice(0, 5).forEach((message) => toast.error(message));

    setActiveTab("introduction");
    form.setFocus(orderedInvalidFields[0] as keyof FormInputValues);
  });

  return (
    <PermissionGuard
      maxHierarchyLevel={3}
      requiredPermissions={["property:read"]}
      requireAllPermissions
      redirectTo="/dashboard"
    >
      <div className="min-h-dvh bg-gradient-to-br from-background via-background to-muted/20">
        <PropertyPageHeader
          title={t("createTitle")}
          subtitle={t("createDescription")}
          isSubmitting={createMutation.isPending}
          onSubmit={handleSubmit}
          submitButtonText={t("createAction")}
          savingText={t("creating")}
          onBack={() => router.push("/dashboard/propertyIndicativeValuation")}
          backButtonAriaLabel={tc("back")}
        />

        <div className="mx-auto max-w-7xl px-4 pb-10 pt-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
            <div className="sticky top-[77px] z-40 rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <TabsList className="grid w-full grid-cols-3">
                {stepItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger
                      key={item.key}
                      value={item.key}
                      className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <Form {...form}>
              <form onSubmit={handleSubmit} className="mt-6 space-y-6">

                <TabsContent value="introduction" className="space-y-6">
                  <Card className="shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            {t("sections.introduction")}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {t("sections.introductionDescription")}
                          </CardDescription>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => resetTab("introduction")}
                          className="flex items-center gap-2 text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {tc("clear")}
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                     

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <FormField
                          control={form.control}
                          name="instructedBy"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{renderRequiredLabel(t("fields.instructedBy"))}</FormLabel>
                              <Select
                                value={field.value?.trim() ? field.value : "__none"}
                                onValueChange={(value) => {
                                  field.onChange(value === "__none" ? "" : value);
                                  form.clearErrors("instructedBy");
                                }}
                                disabled={createMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder={t("fields.instructedByPlaceholder")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none">{tc("none")}</SelectItem>
                                  {PREPARED_FOR_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="intendedUse"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{renderRequiredLabel(t("fields.intendedUse"))}</FormLabel>
                              <Select
                                value={field.value?.trim() ? field.value : "__none"}
                                onValueChange={(value) => {
                                  field.onChange(value === "__none" ? "" : value);
                                  form.clearErrors("intendedUse");
                                }}
                                disabled={createMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue
                                      placeholder={t("fields.intendedUsePlaceholder")}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none">{tc("none")}</SelectItem>
                                  {intendedUseOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="workflowStatus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{renderRequiredLabel(t("fields.workflowStatus"))}</FormLabel>
                              <Select
                                value={field.value ?? "DRAFT"}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  form.clearErrors("workflowStatus");
                                }}
                                disabled={!canSelectStatus || createMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className={`h-11 ${!canSelectStatus ? "bg-muted/50" : "bg-background"}`}>
                                    <SelectValue placeholder={t("fields.workflowStatusPlaceholder")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {workflowStatusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!canSelectStatus ? (
                                <FormDescription className="text-xs text-muted-foreground">
                                  Workflow status is locked to `Draft` for valuers.
                                </FormDescription>
                              ) : null}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{renderRequiredLabel(t("fields.indicativeValuationStatus"))}</FormLabel>
                              <Select
                                value={field.value ?? "ACTIVE"}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  form.clearErrors("status");
                                }}
                                disabled={!canSelectStatus || createMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className={`h-11 ${!canSelectStatus ? "bg-muted/50" : "bg-background"}`}>
                                    <SelectValue placeholder={t("fields.indicativeValuationStatusPlaceholder")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {businessStatusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!canSelectStatus ? (
                                <FormDescription className="text-xs text-muted-foreground">
                                  Business status is locked to `Active` for valuers.
                                </FormDescription>
                              ) : null}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                       <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <FormField
                          control={form.control}
                          name="instructionDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{renderRequiredLabel(t("fields.instructionDate"))}</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="h-11"
                                  disabled={createMutation.isPending}
                                  onChange={(event) => {
                                    field.onChange(event);
                                    form.clearErrors("instructionDate");
                                  }}
                                  type="date"
                                  required
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="indicationDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{renderRequiredLabel(t("fields.indicationDate"))}</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="h-11"
                                  disabled={createMutation.isPending}
                                  onChange={(event) => {
                                    field.onChange(event);
                                    form.clearErrors("indicationDate");
                                  }}
                                  type="date"
                                  required
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="property" className="space-y-6">
                  <AddressTab
                    formData={{
                      provinceId: newProperty.provinceId,
                      districtId: newProperty.districtId,
                      communeId: newProperty.communeId,
                      villageId: newProperty.villageId,
                      street: newProperty.street,
                      houseNo: newProperty.houseNo,
                      latitude: newProperty.latitude,
                      longitude: newProperty.longitude,
                      formattedAddress: newProperty.formattedAddress,
                    }}
                    addressCodes={addressCodes}
                    resolvedAddressItems={resolvedAddressItems}
                    onInputChange={handleAddressInputChange}
                    onAddressChange={handleAddressChange}
                    onCoordinatesChange={handleMapCoordinatesChange}
                    onReverseGeocode={handleReverseGeocode}
                    onShapesChange={handleShapesChange}
                    isReverseGeocoding={isReverseGeocoding}
                    shapes={shapes}
                    existingPolygon={polygonGeoJson}
                    disableBoundaryPinUpdate={false}
                    enableShapeDrawing={true}
                    showMap={true}
                    mapHeight="600px"
                    requiredCoordinates
                    onReset={resetAddressTab}
                    t={tp}
                  />

                  <Card className="shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <Building2 className="h-5 w-5 text-primary" />
                            {t("sections.subjectProperty")}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {t("sections.propertyDescription")}
                          </CardDescription>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => resetTab("property")}
                          className="flex items-center gap-2 text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {tc("clear")}
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2">
                          <FormLabel>{renderRequiredLabel(tp("propertyType"))}</FormLabel>
                          <Select
                            value={newProperty.propertyTypeId}
                            onValueChange={(value) => updateNewProperty("propertyTypeId", value)}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={tp("propertyTypePlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {propertyTypes.map((propertyType: any) => (
                                <SelectItem
                                  key={propertyType.propertyTypeId}
                                  value={String(propertyType.propertyTypeId)}
                                >
                                  {propertyType.propertyName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <FormLabel>{tp("propertySubtype")}</FormLabel>
                          <Select
                            value={newProperty.propertySubtypeId}
                            onValueChange={(value) => updateNewProperty("propertySubtypeId", value)}
                            disabled={!newProperty.propertyTypeId}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={tp("propertySubtypePlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSubtypes.map((subtype: any) => (
                                <SelectItem
                                  key={subtype.propertySubtypeId}
                                  value={String(subtype.propertySubtypeId)}
                                >
                                  {subtype.subtypeName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <FormLabel>{tp("currentUse")}</FormLabel>
                          <Select
                            value={newProperty.currentUseId}
                            onValueChange={(value) => updateNewProperty("currentUseId", value)}
                            disabled={!newProperty.propertyTypeId}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={tp("chooseUsage")} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCurrentUses.map((useItem: any) => (
                                <SelectItem key={useItem.useId} value={String(useItem.useId)}>
                                  {useItem.currentUse?.useName ?? useItem.useName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                        <div className="rounded-2xl border bg-muted/20 p-5">
                        <div className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
                          <ImageIcon className="h-4 w-4 text-primary" />
                          {tp("propertyPhotos")}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {photoFields.map(({ field, label }) => {
                            const previewUrl = propertyPhotoPreviews[field];
                            const selectedFile = propertyPhotoFiles[field];

                            return (
                              <div
                                key={field}
                                className="rounded-2xl border-2 border-dashed bg-background p-4"
                              >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <FormLabel>{label}</FormLabel>
                                  {selectedFile ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removePropertyPhoto(field)}
                                      className="h-8 px-2 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>

                                <div className="space-y-3">
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    className="h-11"
                                    onChange={(event) =>
                                      handlePropertyPhotoUpload(field, event.target.files)
                                    }
                                  />

                                  {previewUrl ? (
                                    <div className="overflow-hidden rounded-2xl border bg-muted/10">
                                      <img
                                        src={previewUrl}
                                        alt={label}
                                        className="h-40 w-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed bg-muted/20 text-center text-sm text-muted-foreground">
                                      Upload an image file to preview this photo
                                    </div>
                                  )}

                                  {selectedFile ? (
                                    <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <FormLabel>{tp("description")}</FormLabel>
                        <Textarea
                          rows={4}
                          placeholder={tp("propertyDescriptionPlaceholder")}
                          value={newProperty.description}
                          onChange={(event) => updateNewProperty("description", event.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="valuation" className="space-y-6">
                  <Card className="shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <Receipt className="h-5 w-5 text-primary" />
                            {t("sections.indicativeValuation")}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {t("sections.indicativeValuationDescription")}
                          </CardDescription>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => resetTab("valuation")}
                          className="flex items-center gap-2 text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {tc("clear")}
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <FormField
                        control={form.control}
                        name="valuerId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.valuer")}</FormLabel>
                            {canAssignValuer ? (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={createMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder={t("fields.valuerPlaceholder")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {valuers.map((valuer) => (
                                    <SelectItem key={valuer.id} value={String(valuer.id)}>
                                      {valuer.firstName} {valuer.lastName} ({valuer.username})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <FormControl>
                                <Input className="h-11" value={assignedValuerLabel} readOnly />
                              </FormControl>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="inspectorName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.inspectorName")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="h-11"
                                disabled={createMutation.isPending}
                                placeholder={t("fields.inspectorNamePlaceholder")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{renderRequiredLabel(t("fields.contactName"))}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="h-11"
                                required
                                disabled={createMutation.isPending}
                                placeholder={t("fields.contactNamePlaceholder")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contactTel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{renderRequiredLabel(t("fields.contactTel"))}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="h-11"
                                required
                                disabled={createMutation.isPending}
                                placeholder={t("fields.contactTelPlaceholder")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                       <FormField
                          control={form.control}
                          name="note"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2 xl:col-span-4">
                              <FormLabel>{renderRequiredLabel(t("fields.note"))}</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  disabled={createMutation.isPending}
                                  rows={5}
                                  required
                                  placeholder={t("fields.notePlaceholder")}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                      <FormField
                        control={form.control}
                        name="internalNotes"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2 xl:col-span-4">
                            <FormLabel>{t("fields.internalNotes")}</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                disabled={createMutation.isPending}
                                rows={4}
                                placeholder={t("fields.internalNotesPlaceholder")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                    </CardContent>
                  </Card>

                  <Card className="shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <Receipt className="h-5 w-5 text-primary" />
                            {t("sections.components")}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {t("sections.componentsDescription")}
                          </CardDescription>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => resetTab("valuation")}
                          className="flex items-center gap-2 text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {tc("clear")}
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                     

                      <div className="flex flex-wrap gap-3">
                        <Button type="button" variant="outline" onClick={() => addComponent("LAND")}>
                          <Plus className="mr-2 h-4 w-4" />
                          {t("actions.addLand")}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => addComponent("BUILDING")}>
                          <Plus className="mr-2 h-4 w-4" />
                          {t("actions.addBuilding")}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => addComponent("OTHER")}>
                          <Plus className="mr-2 h-4 w-4" />
                          {t("actions.addOther")}
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {componentRows.map((component, index) => (
                          <Card key={component.localId} className="border-primary/10">
                            <CardHeader className="pb-4">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <CardTitle className="text-base">
                                    {index === 0 ? t("component.primary") : `${t("component.additional")} ${index}`}
                                  </CardTitle>
                                  <CardDescription>
                                    {index === 0
                                      ? t("component.primaryDescription")
                                      : t("component.additionalDescription", {
                                          type: t(`componentTypeOptions.${component.componentType}`),
                                        })}
                                  </CardDescription>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeComponent(component.localId)}
                                  disabled={components.length <= 1}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {tc("delete")}
                                </Button>
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-6">
                              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                <div className="space-y-2">
                                  <FormLabel>{t("fields.componentType")}</FormLabel>
                                  <Select
                                    value={component.componentType}
                                    onValueChange={(value) =>
                                      handleComponentTypeChange(
                                        component.localId,
                                        value as ComponentDraft["componentType"],
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-11">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="LAND">{t("componentTypeOptions.LAND")}</SelectItem>
                                      <SelectItem value="BUILDING">{t("componentTypeOptions.BUILDING")}</SelectItem>
                                      <SelectItem value="OTHER">{t("componentTypeOptions.OTHER")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <FormLabel>{renderRequiredLabel(t("fields.description"))}</FormLabel>
                                  <Input
                                    className="h-11"
                                    value={component.description}
                                    required
                                    onChange={(event) =>
                                      updateComponent(component.localId, "description", event.target.value)
                                    }
                                    placeholder={t("fields.descriptionPlaceholder")}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <FormLabel>{renderRequiredLabel(t("fields.area"))}</FormLabel>
                                  <Input
                                    className="h-11"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={component.area}
                                    onChange={(event) =>
                                      updateComponent(component.localId, "area", event.target.value)
                                    }
                                    placeholder="20634"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <FormLabel>{renderRequiredLabel(t("fields.minRate"))}</FormLabel>
                                  <Input
                                    className="h-11"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={component.minRate}
                                    onChange={(event) =>
                                      updateComponent(component.localId, "minRate", event.target.value)
                                    }
                                    placeholder="11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <FormLabel>{renderRequiredLabel(t("fields.maxRate"))}</FormLabel>
                                  <Input
                                    className="h-11"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={component.maxRate}
                                    onChange={(event) =>
                                      updateComponent(component.localId, "maxRate", event.target.value)
                                    }
                                    placeholder="12"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <IndicativeValuationFinancialPanel
                        control={form.control}
                        disabled={createMutation.isPending}
                        currency={currency}
                        totalMinMarketValue={totalMinMarketValue}
                        totalMaxMarketValue={totalMaxMarketValue}
                        accessValueRangeLabel={accessValueRangeLabel}
                        chargeFeeRangeLabel={chargeFeeRangeLabel}
                        forcedSaleValue={forcedSaleValue}
                        feeRateValue={feeRateValue}
                        discountValue={discountValue}
                        forcedSalePercentValue={forcedSalePercentValue}
                        automaticAccessValue={automaticAccessValue}
                        t={t}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </form>
            </Form>
          </Tabs>

          <PropertyNavigationFooter
            currentTab={activeTab}
            isSubmitting={createMutation.isPending}
            onPrevious={goPrevious}
            onNext={goNext}
            onSubmit={handleSubmit}
            isFirstStep={currentStepIndex === 0}
            isLastStep={currentStepIndex === stepItems.length - 1}
            stepLabel={`${currentStepIndex + 1}/${stepItems.length}`}
            savingText={t("creating")}
            translations={{
              previous: tc("previous"),
              next: tc("next"),
              createProperty: t("createAction"),
            }}
          />
        </div>
      </div>

      <AlertDialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>
              {tc("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGuard>
  );
}
