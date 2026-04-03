"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import {
  Building2,
  ClipboardList,
  FileText,
  DollarSign,
  Calendar,
  Receipt,
  User,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { PropertyPageHeader } from "@/components/property/PropertyPageHeader";
import { PropertyNavigationFooter } from "@/components/property/PropertyNavigationFooter";
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

import { useCreatePropertyValuation } from "@/hooks/propertyValuation/usePropertyValuation";
import { propertyValuationBaseSchema } from "@/hooks/propertyValuation/propertyValuation.schema";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";

import type {
  CreatePropertyForValuationInput,
  CreatePropertyValuationInput,
  DataSourceInput,
  PropertyAddressInput,
  TitleDocumentInput,
  GeoJsonPolygon,
  PropertyLocationInput,
} from "@/hooks/propertyValuation/propertyValuation.types";
import { AddressTab } from "@/components/property/AddressTab";
import { DEFAULT_ADDRESS_CODES } from "@/constants/propertyConstants";
import { AddressCodes } from "@/hooks/property/property.types";
import { DrawnShape } from "@/types/googleMap.types";
import { convertShapesToGeoJson, logPolygonInfo } from "@/utils/geoJsonConverter";
import { useAuth  } from "@/hooks/auth/useAuth";
import { getErrorMessage } from "@/lib/utils";
import { PREPARED_FOR_OPTIONS } from "@/constants/preparedForOptions";
import { propertyAddressService } from "@/hooks/propertyAddress/propertyAddress.service";
import {
  ensureResolvedAddressHierarchy,
  completeResolvedHierarchyFromDetectedAddress,
  type ResolvedAddressDraft,
} from "@/utils/propertyAddressResolution";
import type { ResolvedAddressHierarchyItems } from "@/types/propertyAddress.types";

// ============================================
// ✅ CONSTANTS
// ============================================

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

// Validate date string format and value (must be before schema)
const isValidDateString = (value?: string | Date): boolean => {
  if (!value) return true; // Empty is OK (optional)
  
  // If it's already a Date object, check if valid
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return false;
    const year = value.getFullYear();
    return year >= 1900 && year <= 2100;
  }
  
  // String validation
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === "") return true;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(trimmed)) return false;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return false;
    // Check year is reasonable (1900-2100)
    const year = date.getFullYear();
    return year >= 1900 && year <= 2100;
  }
  
  return false;
};

const valuationFormSchema = propertyValuationBaseSchema.extend({
  valuationPdf: z.any().optional(),
  formattedAddress: z.string().optional(),
  placeId: z.string().optional(),
  geolocationLink: z.string().optional(),
  polygon: z.any().optional(),
  status: z.enum(PROPERTY_VALUATION_STATUS, {
    required_error: "Property valuation status is required",
  }),
  // property fields (flatten)
  propertyName: z.string().optional(),
  propertyTypeId: z.number().optional(),
  propertySubtypeId: z.number().optional(),
  currentUseId: z.number().optional(),
  propertyStatus: z.string().optional(),
  description: z.string().optional(),
  inspectorName: z.string().optional(),
  perposeOfValuation: z.string().optional(),
  preparedFor: z.string().optional(),
  // address codes
  provinceId: z.string().optional(),
  districtId: z.string().optional(),
  communeId: z.string().optional(),
  villageId: z.string().optional(),
  street: z.string().optional(),
  houseNo: z.string().optional(),
  // coords
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  // title doc
  titleDeedType: z.string().optional(),
  titleDeedNo: z.string().optional(),
  issuedYear: z.string().optional(),
  parcelNo: z.string().optional(),
  totalSizeByTitleDeed: z.string().optional(),
  // data source
  sourceType: z.string().optional(),
  contactName: z.string().optional(),
  phoneNumber: z.string().optional(),
  // workflow status (force allowed values)
  workflowStatus: z.enum(WORKFLOW_STATUS).default("DRAFT").optional(),
}).superRefine((data, ctx) => {
  // Validate date fields
  const dateFields = [
    { name: 'dateOfInspection', value: data.dateOfInspection },
    { name: 'valuationDate', value: data.valuationDate },
    { name: 'dateOfReport', value: data.dateOfReport },
  ];
  
  for (const field of dateFields) {
    if (field.value && !isValidDateString(field.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid date format. Please enter a valid date (YYYY-MM-DD)',
        path: [field.name],
      });
    }
  }
});

// ForcedSale <= MarketValue
const withForcedSaleValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (values) =>
      values.marketValue === undefined ||
      values.forcedSaleValue === undefined ||
      values.forcedSaleValue <= values.marketValue,
    {
      message: "Forced sale value cannot exceed market value",
      path: ["forcedSaleValue"],
    }
  );

// Manual-only mode: require propertyTypeId
const manualSchema = withForcedSaleValidation(
  valuationFormSchema.refine((values) => values.propertyTypeId !== undefined, {
    message: "Property type is required",
    path: ["propertyTypeId"],
  })
);

type ManualFormValues = z.infer<typeof manualSchema>;

type ConfirmDialogState = {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
};

// ============================================
// 🔧 UTILS
// ============================================

const parseNumberInput = (value: string) => {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const parseIntegerInput = (value: string) => {
  if (value.trim() === "") return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
};

const parseCoordinatePairInput = (
  value: string
): { latitude: number; longitude: number } | null => {
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
    latitude: Number.parseFloat(latitude.toFixed(6)),
    longitude: Number.parseFloat(longitude.toFixed(6)),
  };
};

const trimValue = (value?: string) => {
  const v = value?.trim();
  return v ? v : undefined;
};

const validateAndTrimDate = (value?: string): string | undefined => {
  if (!value || value.trim() === "") return undefined;
  if (!isValidDateString(value)) return undefined;
  return value.trim();
};

const buildPropertyAddressInput = (values: ManualFormValues): PropertyAddressInput | undefined => {
  const provinceId = trimValue(values.provinceId);
  const districtId = trimValue(values.districtId);
  const communeId = trimValue(values.communeId);

  if (!provinceId || !districtId || !communeId) return undefined;

  return {
    provinceId,
    districtId,
    communeId,
    villageId: trimValue(values.villageId) ?? null,
    street: trimValue(values.street) ?? null,
    houseNo: trimValue(values.houseNo) ?? null,
    titleAddress: null,
    accessRoads: null,
    neighborLocation: null,
  };
};

const buildTitleDocumentInput = (values: ManualFormValues): TitleDocumentInput | undefined => {
  const titleDeedType = trimValue(values.titleDeedType);
  if (!titleDeedType) return undefined;

  return {
    titleDeedType,
    titleDeedNo: trimValue(values.titleDeedNo) ?? null,
    issuedYear: trimValue(values.issuedYear) ?? null,
    parcelNo: trimValue(values.parcelNo) ?? null,
    totalSizeByTitleDeed: values.totalSizeByTitleDeed
      ? Number(values.totalSizeByTitleDeed)
      : null,
    coverPhotoUrl: undefined,
    backSidePhotoUrl: undefined,
  };
};

const buildDataSourceInput = (values: ManualFormValues): DataSourceInput => {
  const sourceType = (trimValue(values.sourceType) ?? "OWNERSHIP") as any;
  return {
    sourceType,
    contactName: trimValue(values.contactName),
    phoneNumber: trimValue(values.phoneNumber),
  };
};

const buildLocationInput = (
  values: ManualFormValues, 
  shapes: DrawnShape[],
  cachedPolygonGeoJson: GeoJsonPolygon | null
): PropertyLocationInput | undefined => {
  const lat = values.latitude;
  const lng = values.longitude;

  const polygonGeoJson =
    cachedPolygonGeoJson ?? (shapes.length > 0 ? convertShapesToGeoJson(shapes) : null);

  // ✅ NEW: Log for debugging
  if (polygonGeoJson) {
    logPolygonInfo(polygonGeoJson, "Building Location Input");
  }

  const hasLatLng = typeof lat === "number" && typeof lng === "number";
  const formattedAddress = trimValue(values.formattedAddress);
  const placeId = trimValue(values.placeId);
  const geolocationLink = trimValue(values.geolocationLink);

  if (!hasLatLng && !formattedAddress && !polygonGeoJson && !placeId && !geolocationLink) return undefined;

  return {
    latitude: hasLatLng ? lat : undefined,
    longitude: hasLatLng ? lng : undefined,
    formattedAddress: formattedAddress,
    placeId,
    geolocationLink,
    polygon: polygonGeoJson, // ✅ NEW: Use converted GeoJSON
  };
};

const getPolygonCenter = (
  polygon: GeoJsonPolygon | null
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

const buildValuationPayload = (values: ManualFormValues) => ({
  valuationNo: trimValue(values.valuationNo),
  status: values.status,
  landValue: values.landValue ?? undefined,
  buildingValue: values.buildingValue ?? undefined,
  marketValue: values.marketValue ?? undefined,
  forcedSaleValue: values.forcedSaleValue ?? undefined,
  pricePerSqm: values.pricePerSqm ?? undefined,
  dateOfInspection: validateAndTrimDate(values.dateOfInspection),
  valuationMethod: trimValue(values.valuationMethod),
  currency: trimValue(values.currency),
  valuationDate: validateAndTrimDate(values.valuationDate),
  dateOfReport: validateAndTrimDate(values.dateOfReport),
  valuerId: values.valuerId ?? undefined,
  inspectorName: trimValue(values.inspectorName),
  workflowStatus: (values.workflowStatus ?? "DRAFT") as any,
  purposeOfValuation: trimValue(values.purposeOfValuation),
  note: trimValue(values.note),
  internalNotes: trimValue(values.internalNotes),
  preparedFor: trimValue(values.preparedFor),
  valuationPdf: values.valuationPdf instanceof File ? values.valuationPdf : undefined,
});

const toFormData = (input: CreatePropertyValuationInput) => {
  const fd = new FormData();

  Object.entries(input).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "property") return;
    if (k === "valuationPdf") return;

    fd.append(k, v instanceof Date ? v.toISOString() : String(v));
  });

  if (input.property) fd.append("property", JSON.stringify(input.property));
  if (input.valuationPdf instanceof File) fd.append("valuationPdf", input.valuationPdf);

  return fd;
};

// ---- API error -> RHF errors + toast ----

type ApiValidationError = { path?: string; message?: string };
type ApiErrorShape = {
  message?: string;
  errors?: ApiValidationError[];
};

const getApiErrorPayload = (err: any): ApiErrorShape | null => {
  const data = err?.response?.data ?? err?.data ?? null;
  if (!data) return null;
  return {
    message: data?.message ?? data?._responseMessage,
    errors: Array.isArray(data?.errors) ? data.errors : undefined,
  };
};

const applyApiErrorsToForm = (form: ReturnType<typeof useForm<ManualFormValues>>, err: any) => {
  const payload = getApiErrorPayload(err);
  if (!payload) return;

  if (payload.message) toast.error(payload.message);

  if (payload.errors?.length) {
    payload.errors.slice(0, 5).forEach((e) => {
      const p = (e.path ?? "").toString();
      const m = e.message ?? "Invalid value";
      toast.error(`${p ? `${p}: ` : ""}${m}`);
      if (p) {
        form.setError(p as any, { type: "server", message: m });
      }
    });
  }
};

// ============================================
// ✅ DEFAULTS
// ============================================

const defaults: ManualFormValues = {
  // valuation
  valuationNo: "",
  valuationMethod: "",
  currency: "USD",
  status: "ACTIVE",
  landValue: undefined,
  buildingValue: undefined,
  marketValue: undefined,
  forcedSaleValue: undefined,
  pricePerSqm: undefined,
  dateOfInspection: "",
  valuationDate: "",
  dateOfReport: "",
  valuerId: undefined,
  inspectorName: "",
  purposeOfValuation: "",
  note: "",
  internalNotes: "",
  preparedFor: "",
  valuationPdf: undefined,

  // property
  propertyName: "",
  propertyTypeId: undefined,
  propertySubtypeId: undefined,
  currentUseId: undefined,
  propertyStatus: "ACTIVE",
  description: "",

  // address
  provinceId: "",
  districtId: "",
  communeId: "",
  villageId: "",
  street: "",
  houseNo: "",
  latitude: undefined,
  longitude: undefined,
  formattedAddress: "",
  placeId: "",
  geolocationLink: "",
  polygon: undefined,

  // title doc
  titleDeedType: "",
  titleDeedNo: "",
  issuedYear: "",
  parcelNo: "",
  totalSizeByTitleDeed: "",

  // source
  sourceType: "OWNERSHIP",
  contactName: "",
  phoneNumber: "",
} as any;

// ============================================
// ✅ PAGE (MANUAL ONLY)
// ============================================

export default function AddPropertyValuationPage() {
  const t = useTranslations("propertyValuation");
  const tp = useTranslations("properties");
  const tc = useTranslations("common");

  const router = useRouter();
  const createMutation = useCreatePropertyValuation();
  const propertyTypes = usePropertyTypes();
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
  const { hasHierarchyLevel} = useAuth();
  const canSelectStatus = hasHierarchyLevel(2);

  const [currentTab, setCurrentTab] = useState<
    "introduction" | "property" | "valuation"
  >("introduction");

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const isSubmitting = createMutation.isPending;

  const methodOptions = useMemo(
    () => [
      { value: "SALES_COMPARISON_APPROACH", label: t("methodLabels.SALES_COMPARISON") },
      { value: "INCOME_APPROACH", label: t("methodLabels.INCOME_APPROACH") },
      { value: "COST_APPROACH", label: t("methodLabels.COST_APPROACH") },
      { value: " SALES_AND_COST_APPROACH", label: t("methodLabels.SALES_AND_COST") },
    ],
    [t]
  );

  const workflowStatusOptions = useMemo(
    () => [
      { value: "DRAFT", label: t("statusLabels.DRAFT") },
      { value: "PENDING_REVIEW", label: t("statusLabels.PENDING_REVIEW") },
      { value: "APPROVED", label: t("statusLabels.APPROVED") },
      { value: "REJECTED", label: t("statusLabels.REJECTED") },
      { value: "ARCHIVED", label: t("statusLabels.ARCHIVED") },
    ],
    [t]
  );

  const currencyOptions = useMemo(
    () => [
      { value: "USD", label: "USD" },
      { value: "KHR", label: "KHR" },
    ],
    []
  );

  const propertyValuationStatusOptions = useMemo(
    () => [
      { value: "ACTIVE", label: t("active") },
      { value: "SUPERSEDED", label: t("superseded") },
      { value: "EXPIRED", label: t("expired") },
      { value: "CANCELLED", label: t("cancelled") },
    ],
    [t]
  );

  const sourceTypeOptions = useMemo(
    () => [
      { value: "OWNERSHIP", label: tc("sourceType.ownership") },
      { value: "AGENCY", label: tc("sourceType.agent") },
      { value: "AUTHORITY", label: tc("sourceType.authority") },
      { value: "BANK", label: tc("sourceType.bank") },
      { value: "OTHER", label: tc("sourceType.other") },
    ],
    [tc]
  );

  const purposeOfValuationOptions = useMemo(
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
    [t]
  );

  const titleDeedTypeOptions = useMemo(
    () => [
      { value: "HARD", label: tp("hardTitle") },
      { value: "SOFT", label: tp("softTitle") },
      { value: "STRATA", label: tp("strataTitle") },
      { value: "LMAP", label: tp("lmap") },
    ],
    []
  );
  const form = useForm<ManualFormValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });

  // property-type dependent options
  const selectedPropertyTypeId = form.watch("propertyTypeId");
  const selectedPropertyType = useMemo(() => {
    return propertyTypes.find((pt: any) => pt.propertyTypeId === selectedPropertyTypeId);
  }, [propertyTypes, selectedPropertyTypeId]);

  const availableSubtypes = selectedPropertyType?.subtypes ?? [];
  const availableCurrentUses = selectedPropertyType?.currentUses ?? [];

  useEffect(() => {
    if (selectedPropertyTypeId) {
      form.setValue("propertySubtypeId", undefined);
      form.setValue("currentUseId", undefined);
    }
  }, [form, selectedPropertyTypeId]);

  // Address handlers for AddressTab
  const handleInputChange = useCallback((field: string, value: string) => {
    if (field === "formattedAddress") {
      const nextValue = String(value ?? "");
      const coordinatePair = parseCoordinatePairInput(nextValue);

      hasAddressResolutionInteractionRef.current = nextValue.trim().length > 0;
      preserveTypedDetectedAddressRef.current = !coordinatePair && nextValue.trim().length > 0;
      addressResolutionSourceRef.current = coordinatePair ? "coordinates" : "formattedAddress";
      lastResolvedAddressKeyRef.current = "";

      if (coordinatePair) {
        form.setValue("formattedAddress", nextValue);
        form.setValue("latitude", coordinatePair.latitude);
        form.setValue("longitude", coordinatePair.longitude);
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
        form.setValue("latitude", coordinatePair.latitude);
        form.setValue("longitude", coordinatePair.longitude);
        return;
      }
    }

    form.setValue(field as any, value);
  }, [form]);

  const handleAddressChange = useCallback((codes: AddressCodes) => {
    form.setValue("provinceId", codes.provinceId ?? "");
    form.setValue("districtId", codes.districtId ?? "");
    form.setValue("communeId", codes.communeId ?? "");
    form.setValue("villageId", codes.villageId ?? "");
    setAddressCodes(codes);
    setResolvedAddressItems(EMPTY_RESOLVED_ADDRESS_ITEMS);
  }, [form]);

  const handleMapCoordinatesChange = useCallback((coords: { latitude: number; longitude: number }) => {
    hasAddressResolutionInteractionRef.current = true;
    preserveTypedDetectedAddressRef.current = false;
    addressResolutionSourceRef.current = "coordinates";
    form.setValue("latitude", Number.parseFloat(coords.latitude.toFixed(6)));
    form.setValue("longitude", Number.parseFloat(coords.longitude.toFixed(6)));
  }, [form]);

 const handleShapesChange = useCallback((newShapes: DrawnShape[]) => {
  setShapes(newShapes);

  if (newShapes.length > 0) {
      const geoJson = convertShapesToGeoJson(newShapes);
    if (geoJson) {
      logPolygonInfo(geoJson, "Shape Changed");
      setPolygonGeoJson(geoJson);
      hadPolygonDrawnRef.current = true;
      const center = getPolygonCenter(geoJson);
      if (center) {
        form.setValue("latitude", Number.parseFloat(center.latitude.toFixed(6)));
        form.setValue("longitude", Number.parseFloat(center.longitude.toFixed(6)));
      }
    }
    return;
  }

  if (hadPolygonDrawnRef.current && polygonGeoJson) {
    return;
  }

  setPolygonGeoJson(null);
}, [form, polygonGeoJson]);

  useEffect(() => {
    if (shapes.length === 0 || !window.google?.maps) return;

    const actualShapes = shapes.filter((shape) => shape.id !== "temp-polygon");
    if (actualShapes.length === 0) return;

    const shape = actualShapes[0];
    let centerLat: number | null = null;
    let centerLng: number | null = null;

    if (shape.shape instanceof google.maps.Polygon) {
      const path = shape.shape.getPath();
      const bounds = new google.maps.LatLngBounds();
      for (let i = 0; i < path.getLength(); i += 1) {
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
      form.setValue("latitude", Number.parseFloat(centerLat.toFixed(6)));
      form.setValue("longitude", Number.parseFloat(centerLng.toFixed(6)));
    }
  }, [form, shapes]);

  const applyResolvedAddress = useCallback((resolved: ResolvedAddressDraft) => {
    const currentFormattedAddress = form.getValues("formattedAddress");
    const currentStreet = form.getValues("street");
    const currentHouseNo = form.getValues("houseNo");
    const currentLatitudeValue = form.getValues("latitude");
    const currentLongitudeValue = form.getValues("longitude");
    const currentLatitude =
      typeof currentLatitudeValue === "number"
        ? currentLatitudeValue
        : Number.parseFloat(String(currentLatitudeValue ?? ""));
    const currentLongitude =
      typeof currentLongitudeValue === "number"
        ? currentLongitudeValue
        : Number.parseFloat(String(currentLongitudeValue ?? ""));
    const shouldPreserveManualCoordinates =
      addressResolutionSourceRef.current === "coordinates" &&
      Number.isFinite(currentLatitude) &&
      currentLatitude >= -90 &&
      currentLatitude <= 90 &&
      Number.isFinite(currentLongitude) &&
      currentLongitude >= -180 &&
      currentLongitude <= 180;
    const hasResolvedHierarchy = Boolean(
      resolved.provinceId ||
        resolved.districtId ||
        resolved.communeId ||
        resolved.villageId
    );

    resolvedCanonicalAddressRef.current =
      resolved.resolvedFormattedAddress?.trim() ?? "";

    if (resolved.latitude != null) {
      form.setValue(
        "latitude",
        shouldPreserveManualCoordinates
          ? currentLatitude
          : Number.parseFloat(resolved.latitude.toFixed(6))
      );
    }
    if (resolved.longitude != null) {
      form.setValue(
        "longitude",
        shouldPreserveManualCoordinates
          ? currentLongitude
          : Number.parseFloat(resolved.longitude.toFixed(6))
      );
    }
    if (
      resolved.formattedAddress &&
      (!preserveTypedDetectedAddressRef.current || !currentFormattedAddress?.trim())
    ) {
      form.setValue("formattedAddress", resolved.formattedAddress);
    }
    if (resolved.placeId) form.setValue("placeId", resolved.placeId);
    if (resolved.googleMapLink) form.setValue("geolocationLink", resolved.googleMapLink);
    if (resolved.street && !currentStreet) form.setValue("street", resolved.street);
    if (resolved.houseNumber && !currentHouseNo) form.setValue("houseNo", resolved.houseNumber);

    if (hasResolvedHierarchy) {
      const nextCodes: AddressCodes = {
        provinceId: resolved.provinceId ?? null,
        districtId: resolved.districtId ?? null,
        communeId: resolved.communeId ?? null,
        villageId: resolved.villageId ?? null,
      };
      setAddressCodes(nextCodes);
      setResolvedAddressItems({
        province: resolved.province ?? null,
        district: resolved.district ?? null,
        commune: resolved.commune ?? null,
        village: resolved.village ?? null,
      });
      form.setValue("provinceId", nextCodes.provinceId ?? "");
      form.setValue("districtId", nextCodes.districtId ?? "");
      form.setValue("communeId", nextCodes.communeId ?? "");
      form.setValue("villageId", nextCodes.villageId ?? "");
    }
  }, [form]);

  const watchedProvinceId = form.watch("provinceId") ?? "";
  const watchedDistrictId = form.watch("districtId") ?? "";
  const watchedCommuneId = form.watch("communeId") ?? "";
  const watchedVillageId = form.watch("villageId") ?? "";

  useEffect(() => {
    const nextCodes: AddressCodes = {
      provinceId: pickFirstNonEmpty(
        watchedProvinceId,
        addressCodes.provinceId,
        resolvedAddressItems.province?.code
      ),
      districtId: pickFirstNonEmpty(
        watchedDistrictId,
        addressCodes.districtId,
        resolvedAddressItems.district?.code
      ),
      communeId: pickFirstNonEmpty(
        watchedCommuneId,
        addressCodes.communeId,
        resolvedAddressItems.commune?.code
      ),
      villageId: pickFirstNonEmpty(
        watchedVillageId,
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

    if ((form.getValues("provinceId") ?? "") !== (nextCodes.provinceId ?? "")) {
      form.setValue("provinceId", nextCodes.provinceId ?? "");
    }

    if ((form.getValues("districtId") ?? "") !== (nextCodes.districtId ?? "")) {
      form.setValue("districtId", nextCodes.districtId ?? "");
    }

    if ((form.getValues("communeId") ?? "") !== (nextCodes.communeId ?? "")) {
      form.setValue("communeId", nextCodes.communeId ?? "");
    }

    if ((form.getValues("villageId") ?? "") !== (nextCodes.villageId ?? "")) {
      form.setValue("villageId", nextCodes.villageId ?? "");
    }
  }, [
    addressCodes.communeId,
    addressCodes.districtId,
    addressCodes.provinceId,
    addressCodes.villageId,
    form,
    resolvedAddressItems.commune?.code,
    resolvedAddressItems.district?.code,
    resolvedAddressItems.province?.code,
    resolvedAddressItems.village?.code,
    watchedCommuneId,
    watchedDistrictId,
    watchedProvinceId,
    watchedVillageId,
  ]);

  const handleReverseGeocode = useCallback(async (data: any) => {
    try {
      setIsReverseGeocoding(true);
      const currentFormattedAddress = form.getValues("formattedAddress");
      const typedDetectedAddress = String(currentFormattedAddress ?? "").trim();
      const shouldPreferTypedDetectedAddress =
        preserveTypedDetectedAddressRef.current &&
        addressResolutionSourceRef.current === "formattedAddress" &&
        typedDetectedAddress.length >= 6;
      const currentLatitudeValue = form.getValues("latitude");
      const currentLongitudeValue = form.getValues("longitude");
      const currentLatitude =
        typeof currentLatitudeValue === "number"
          ? currentLatitudeValue
          : Number.parseFloat(String(currentLatitudeValue ?? ""));
      const currentLongitude =
        typeof currentLongitudeValue === "number"
          ? currentLongitudeValue
          : Number.parseFloat(String(currentLongitudeValue ?? ""));
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
        !currentFormattedAddress?.trim() &&
        form.getValues("latitude") == null &&
        form.getValues("longitude") == null;

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
  }, [applyResolvedAddress, form]);

  const watchedLatitude = form.watch("latitude");
  const watchedLongitude = form.watch("longitude");
  const watchedFormattedAddress = form.watch("formattedAddress");

  useEffect(() => {
    if (!hasAddressResolutionInteractionRef.current) {
      return;
    }

    const latitude = typeof watchedLatitude === "number" ? watchedLatitude : Number.parseFloat(String(watchedLatitude ?? ""));
    const longitude = typeof watchedLongitude === "number" ? watchedLongitude : Number.parseFloat(String(watchedLongitude ?? ""));
    const hasValidCoordinates =
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180;
    const trimmedAddress = String(watchedFormattedAddress ?? "").trim();
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
          console.error("Failed to resolve valuation add address", error);
        }
      } finally {
        if (activeResolveRequestRef.current === requestId) {
          setIsReverseGeocoding(false);
        }
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [applyResolvedAddress, watchedFormattedAddress, watchedLatitude, watchedLongitude]);

  const resetAddressTab = useCallback(() => {
    form.setValue("provinceId", "");
    form.setValue("districtId", "");
    form.setValue("communeId", "");
    form.setValue("villageId", "");
    form.setValue("street", "");
    form.setValue("houseNo", "");
    form.setValue("latitude", undefined);
    form.setValue("longitude", undefined);
    form.setValue("formattedAddress", "");
    form.setValue("placeId", "");
    form.setValue("geolocationLink", "");
    form.setValue("polygon", undefined);
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
  }, [form]);

  // reset per-tab
  const resetTab = useCallback(
    (tab: typeof currentTab) => {
      const titles: Record<typeof currentTab, string> = {
        introduction: "Clear Introduction Information",
        property: "Clear Property Information",
        valuation: "Clear Valuation Details",
      };

      const descs: Record<typeof currentTab, string> = {
        introduction: "Clear introduction fields? This cannot be undone.",
        property: "Clear property fields? This cannot be undone.",
        valuation: "Clear valuation fields? This cannot be undone.",
      };

      setConfirmDialog({
        isOpen: true,
        title: titles[tab],
        description: descs[tab],
        onConfirm: () => {
          const v = form.getValues();

          if (tab === "property") {
            form.reset({
              ...v,
              propertyName: "",
              propertyTypeId: undefined,
              propertySubtypeId: undefined,
              currentUseId: undefined,
              propertyStatus: "ACTIVE",
              description: "",
            });
          }

          if (tab === "introduction") {
            form.reset({
              ...v,
              provinceId: "",
              districtId: "",
              communeId: "",
              villageId: "",
              street: "",
              houseNo: "",
              latitude: undefined,
              longitude: undefined,
              formattedAddress: "",
              placeId: "",
              geolocationLink: "",
              polygon: undefined,
            });
            setShapes([]);
            setPolygonGeoJson(null);
            hadPolygonDrawnRef.current = false;
            setAddressCodes(DEFAULT_ADDRESS_CODES);
            setResolvedAddressItems(EMPTY_RESOLVED_ADDRESS_ITEMS);
          }

          if (tab === "introduction") {
            form.reset({
              ...v,
              titleDeedType: "",
              titleDeedNo: "",
              issuedYear: "",
              parcelNo: "",
              totalSizeByTitleDeed: "",
            });
          }

          if (tab === "introduction") {
            form.reset({
              ...v,
              sourceType: "OWNERSHIP",
              contactName: "",
              phoneNumber: "",
            });
          }

          if (tab === "valuation") {
            form.reset({
              ...v,
              valuationNo: "",
              valuationMethod: "",
              currency: "USD",
              status: "ACTIVE",
              landValue: undefined,
              buildingValue: undefined,
              marketValue: undefined,
              forcedSaleValue: undefined,
              pricePerSqm: undefined,
              dateOfInspection: "",
              valuationDate: "",
              dateOfReport: "",
              valuerId: undefined,
              inspectorName: "",
              purposeOfValuation: "",
              note: "",
              internalNotes: "",
              preparedFor: "",
              valuationPdf: undefined,
            });
          }

          toast.success("Cleared");
          setConfirmDialog((p) => ({ ...p, isOpen: false }));
        },
      });
    },
    [form]
  );

  // submit
  const handleSubmit = useCallback(
    (values: ManualFormValues) => {
      if (!values.propertyTypeId) return;

      const propertyPayload: CreatePropertyForValuationInput = {
        propertyTypeId: values.propertyTypeId,
        propertySubtypeId: values.propertySubtypeId,
        currentUseId: values.currentUseId,
        propertyName: trimValue(values.propertyName),
        status: "ACTIVE",
        description: trimValue(values.description),

        propertyAddress: buildPropertyAddressInput(values),
        propertyLocation: buildLocationInput(values, shapes, polygonGeoJson),
        titleDocument: buildTitleDocumentInput(values),
        dataSource: buildDataSourceInput(values),
      };

      const payload: CreatePropertyValuationInput = {
        ...buildValuationPayload(values),
        property: propertyPayload,
      };

      // If file exists => FormData
      const request = payload.valuationPdf ? (toFormData(payload) as any) : payload;

      createMutation.mutate(request, {
        onSuccess: () => {
          toast.success(t("createdSuccess") ?? "Created successfully");
          router.push("/dashboard/propertyValuation");
        },
        onError: (err) => {
          applyApiErrorsToForm(form, err);
          // fallback
          if (!getApiErrorPayload(err)) {
            toast.error(getErrorMessage(err, "Failed to create valuation"));
          }
        },
      });
    },
    [createMutation, form, polygonGeoJson, router, shapes, t]
  );

  const onSubmitClick = useCallback(() => {
    form.handleSubmit(handleSubmit)();
  }, [form, handleSubmit]);

  const onBack = useCallback(() => {
    router.push("/dashboard/propertyValuation");
  }, [router]);

  // Prepare formData for AddressTab
  const addressTabFormData = useMemo(() => ({
    provinceId: watchedProvinceId,
    districtId: watchedDistrictId,
    communeId: watchedCommuneId,
    villageId: watchedVillageId,
    street: form.watch("street") ?? "",
    houseNo: form.watch("houseNo") ?? "",
    latitude: form.watch("latitude")?.toString() ?? "",
    longitude: form.watch("longitude")?.toString() ?? "",
    formattedAddress: form.watch("formattedAddress") ?? "",
  }), [
    watchedProvinceId,
    watchedDistrictId,
    watchedCommuneId,
    watchedVillageId,
    form.watch("street"),
    form.watch("houseNo"),
    form.watch("latitude"),
    form.watch("longitude"),
    form.watch("formattedAddress"),
  ]);

  return (
    <PermissionGuard maxHierarchyLevel={3} redirectTo="/dashboard">
      <div className="min-h-dvh bg-gradient-to-br from-background via-background to-muted/20">
        <PropertyPageHeader
          title={t("createTitle")}
          subtitle={t("createDescription")}
          isSubmitting={isSubmitting}
          onSubmit={onSubmitClick}
          submitButtonText={t("createValuation")}
          savingText={t("creating")}
          onBack={onBack}
          backButtonAriaLabel={tc("back")}
        />

        <div className="max-w-7xl mx-auto px-4 pb-10 pt-6">
          <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as any)}>
            <div className="sticky top-[77px] z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg shadow-sm border p-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="introduction"
                  className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
                >
                  Introduction
                </TabsTrigger>
                <TabsTrigger
                  value="property"
                  className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
                >
                  Subject Property
                </TabsTrigger>
                <TabsTrigger
                  value="valuation"
                  className="data-[state=active]:bg-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:text-primary-foreground"
                >
                  {t("valuation")}
                </TabsTrigger>
              </TabsList>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-6">
                <TabsContent value="introduction" className="space-y-6">
                  <Introduction
                    form={form}
                    t={t}
                    tc={tc}
                    purposeOfValuationOptions={purposeOfValuationOptions}
                    isSubmitting={isSubmitting}
                    onReset={() => resetTab("property")}
                  />
                </TabsContent>
                <TabsContent value="property" className="space-y-6 sticky top-20  ">
                  <AddressTab
                    formData={addressTabFormData}
                    addressCodes={addressCodes}
                    resolvedAddressItems={resolvedAddressItems}
                    onInputChange={handleInputChange}
                    onAddressChange={handleAddressChange}
                    onCoordinatesChange={handleMapCoordinatesChange}
                    onReverseGeocode={handleReverseGeocode}
                    onShapesChange={handleShapesChange}
                    isReverseGeocoding={isReverseGeocoding}
                    shapes={shapes}
                    existingPolygon={null}
                    disableBoundaryPinUpdate={false}
                    enableShapeDrawing={true}
                    showMap={true}
                    mapHeight="600px"
                    onReset={resetAddressTab}
                    t={tp}
                  />

                  <PropertyBasicInfoSection
                    form={form}
                    tp={tp}
                    tc={tc}
                    propertyTypes={propertyTypes}
                    availableSubtypes={availableSubtypes}
                    availableCurrentUses={availableCurrentUses}
                    isSubmitting={isSubmitting}
                    onReset={() => resetTab("property")}
                  />
                  <PropertyDataSourceSection
                    form={form}
                    tp={tp}
                    tc={tc}
                    sourceTypeOptions={sourceTypeOptions}
                    isSubmitting={isSubmitting}
                    onReset={() => resetTab("property")}
                  />
                  <PropertyDocumentsSection
                    form={form}
                    tp={tp}
                    tc={tc}
                    isSubmitting={isSubmitting}
                    titleDeedTypeOptions={titleDeedTypeOptions}
                    onReset={() => resetTab("property")}
                  />
                  
                </TabsContent>

                <TabsContent value="valuation" className="space-y-6">
                  <ValuationDetailsSection
                    form={form}
                    t={t}
                    methodOptions={methodOptions}
                    currencyOptions={currencyOptions}
                    workflowStatusOptions={workflowStatusOptions}
                    propertyValuationStatusOptions={propertyValuationStatusOptions}
                    isSubmitting={isSubmitting}
                    onReset={() => resetTab("valuation")}
                    canSelectStatus={canSelectStatus}
                  />
                </TabsContent>
              </form>
            </Form>
          </Tabs>

          <PropertyNavigationFooter
            currentTab={currentTab}
            isSubmitting={isSubmitting}
            onPrevious={() => {
              const tabs = ["introduction", "property","valuation"] as const;
              const idx = tabs.indexOf(currentTab);
              if (idx > 0) setCurrentTab(tabs[idx - 1]);
            }}
            onNext={() => {
              const tabs = ["introduction", "property","valuation"] as const;
              const idx = tabs.indexOf(currentTab);
              if (idx < tabs.length - 1) setCurrentTab(tabs[idx + 1]);
            }}
            onSubmit={onSubmitClick}
            translations={{
              previous: tc("previous"),
              next: tc("next"),
              createProperty: t("createValuation"),
            }}
          />
        </div>

        {/* Confirm Dialog */}
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
              <AlertDialogCancel onClick={() => setConfirmDialog((p) => ({ ...p, isOpen: false }))}>
                {tc("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDialog.onConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {tc("clearData")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
}

// ============================================
// SUB COMPONENTS
// ============================================
function Introduction({
  form,
  t,
  tc,
  purposeOfValuationOptions,
  isSubmitting,
  onReset,
}: any) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5 text-primary" />
             {t("introduction")}
            </CardTitle>
            <CardDescription className="mt-2">{t("introductionDescription")}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            {tc("clear")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="preparedFor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("prepareFor")}</FormLabel>
                <Select
                  value={field.value?.trim() ? field.value : "__none"}
                  onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select prepared for" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
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
            name="purposeOfValuation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("purposeOfValuation")}</FormLabel>
                <Select
                  value={field.value?.trim() ? field.value : "__none"}
                  onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t("purposeOfValuationPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none">{tc("none")}</SelectItem>
                    {purposeOfValuationOptions.map(
                      (option: { value: string; label: string }) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("note")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("notePlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    rows={3}
                    disabled={isSubmitting}
                    className="resize-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
      </CardContent>
    </Card>
  );
}

function PropertyBasicInfoSection({
  form,
  tp,
  tc,
  propertyTypes,
  availableSubtypes,
  availableCurrentUses,
  isSubmitting,
  onReset,
}: any) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5 text-primary" />
              {tp("basicInfo")}
            </CardTitle>
            <CardDescription className="mt-2">{tp("basicInfoDescription")}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            {tc("clear")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={form.control}
            name="propertyTypeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  {tp("propertyType")} <span className="text-destructive">*</span>
                </FormLabel>
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) => field.onChange(parseIntegerInput(v))}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={tp("propertyTypePlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {propertyTypes?.length ? (
                      propertyTypes.map((type: any) => (
                        <SelectItem key={type.propertyTypeId} value={String(type.propertyTypeId)}>
                          {type.propertyName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__empty" disabled>
                        {tc("noData")}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="propertySubtypeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tp("propertySubtype")}</FormLabel>
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) => field.onChange(parseIntegerInput(v))}
                  disabled={!form.watch("propertyTypeId") || isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue
                        placeholder={
                          form.watch("propertyTypeId")
                            ? tp("propertySubtypePlaceholder")
                            : tp("selectTypeFirst")
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableSubtypes?.length ? (
                      availableSubtypes.map((sub: any) => (
                        <SelectItem key={sub.propertySubtypeId} value={String(sub.propertySubtypeId)}>
                          {sub.subtypeName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__empty" disabled>
                        {tp("noSubtypesAvailable")}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentUseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tp("currentUse")}</FormLabel>
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) => field.onChange(parseIntegerInput(v))}
                  disabled={!form.watch("propertyTypeId") || isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue
                        placeholder={
                          form.watch("propertyTypeId") ? tp("chooseUsage") : tp("selectTypeFirst")
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableCurrentUses?.length ? (
                      availableCurrentUses.map((useItem: any) => (
                        <SelectItem key={useItem.useId} value={String(useItem.useId)}>
                          {useItem.currentUse?.useName ?? useItem.useName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__empty" disabled>
                        {tc("noData")}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{tp("propertyDescription")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={tp("propertyDescriptionPlaceholder")}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  rows={4}
                  disabled={isSubmitting}
                  className="resize-none"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

function PropertyDocumentsSection({
  form,
  tp,
  tc,
  isSubmitting,
  onReset,
  titleDeedTypeOptions,
}: any) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Receipt className="h-5 w-5 text-primary" />
              {tp("certificateOfOwnership") }<span className="text-red-500">*</span>
            </CardTitle>
            <CardDescription className="mt-2">{tp("documentsDescription")}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            {tc("clear")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="titleDeedType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tp("titleDeedType")}<span className="text-red-500">*</span></FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={tp("titleDeedTypePlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {titleDeedTypeOptions.map((op: any) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
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
            name="titleDeedNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tp("titleDeedNo")}<span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input
                    placeholder={tp("titleDeedNoPlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="totalSizeByTitleDeed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tp("totalSizeByTitleDeed")}<span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder={tp("totalSizeByTitleDeedPlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyDataSourceSection({
  form,
  tp,
  tc,
  sourceTypeOptions,
  isSubmitting,
  onReset,
}: any) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="h-5 w-5 text-primary" />
              {tp("dataSource")}
            </CardTitle>
            <CardDescription className="mt-2">{tp("dataSourceDescription")}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            {tc("clear")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="sourceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tp("sourceType")}</FormLabel>
                <Select
                  value={field.value ?? "OWNERSHIP"}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={tp("sourceTypePlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sourceTypeOptions.map((op: any) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
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
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tp("contactName")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={tp("contactNamePlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tp("phoneNumber")}</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder={tp("phoneNumberPlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ValuationDetailsSection({
  form,
  t,
  methodOptions,
  currencyOptions,
  workflowStatusOptions,
  propertyValuationStatusOptions,
  isSubmitting,
  onReset,
  canSelectStatus,
}: any) {
  const selectedFile = form.watch("valuationPdf");
  const selectedFileName = selectedFile instanceof File ? selectedFile.name : ""
  return (
    <div className="space-y-6">
      {/* Details */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardList className="h-5 w-5 text-primary" />
                {t("sectionDetails")}<span className="text-red-500">*</span>
              </CardTitle>
              <CardDescription className="mt-2">{t("sectionDetailsDescription")}</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              <RotateCcw className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-4">
          <FormField
            control={form.control}
            name="valuationNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ValuationNo<span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("valuationNoPlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="valuationMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("valuationMethod")}<span className="text-red-500">*</span></FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t("valuationMethodPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {methodOptions.map((op: any) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
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
                <FormLabel>{t("workflowStatus")}<span className="text-red-500">*</span></FormLabel>
                <Select
                  value={(field.value ?? "DRAFT") as string}
                  onValueChange={field.onChange}
              
                  disabled={!canSelectStatus || isSubmitting} 
                >
                  <FormControl>
                    {/* Visual cue: lighter background if editable, muted if disabled */}
                    <SelectTrigger className={`h-11 ${!canSelectStatus ? "bg-muted/50" : "bg-background"}`}>
                      <SelectValue placeholder={t("workflowStatusPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {workflowStatusOptions.map((op: any) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canSelectStatus && (
                    <FormDescription className="text-xs text-muted-foreground">
                        Workflow status is locked to 'Draft' for Valuers.
                    </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

           <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("propertyValuationStatus")}<span className="text-red-500">*</span>  </FormLabel>
                <Select
                  value={field.value ?? "ACTIVE"}
                  onValueChange={field.onChange}
                   disabled={!canSelectStatus || isSubmitting} 
                >
                  <FormControl>
                    <SelectTrigger className={`h-11 ${!canSelectStatus ? "bg-muted/50" : "bg-background"}`}>
                      <SelectValue placeholder={t("propertyValuationStatusPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {propertyValuationStatusOptions?.map((op: any) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canSelectStatus && (
                    <FormDescription className="text-xs text-muted-foreground">
                        Property valuation status is locked to 'Active' for Valuers.
                    </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

       {/* Dates */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-5 w-5 text-primary" />
            {t("sectionDates")}<span className="text-red-500">*</span>
          </CardTitle>
          <CardDescription>{t("sectionDatesDescription")}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-4 lg:grid-cols-4">
          {(["dateOfInspection", "valuationDate", "dateOfReport"] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(name)}<span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <FormField
            control={form.control}
            name="inspectorName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("inspectorName")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("inspectorNamePlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Values */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-5 w-5 text-primary" />
            {t("sectionValues")}
          </CardTitle>
          <CardDescription>{t("sectionValuesDescription")}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {(["landValue", "buildingValue", "marketValue", "forcedSaleValue", "pricePerSqm"] as const).map(
            (name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t(name)}
                      {name === "marketValue" && (
                        <span className="text-red-500"> *</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder={t(`${name}Placeholder`)}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(parseNumberInput(e.target.value))}
                        disabled={isSubmitting}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )
          )}
        </CardContent>
      </Card>

     

      {/* Notes + File */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            {t("sectionNotes")}
          </CardTitle>
          <CardDescription>{t("sectionNotesDescription")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
        

          <FormField
            control={form.control}
            name="internalNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("internalNotes")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("internalNotesPlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    rows={3}
                    disabled={isSubmitting}
                    className="resize-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="valuationPdf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("valuationPdf")}</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      field.onChange(f ?? undefined);
                    }}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </FormControl>
                <FormDescription>{t("valuationPdfHint")}</FormDescription>
                {selectedFileName ? (
                  <p className="text-xs text-muted-foreground">
                    {t("selectedFile", { name: selectedFileName })}
                  </p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
