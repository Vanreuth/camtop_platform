"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  Building2,
  ClipboardList,
  DollarSign,
  Calendar,
  FileText,
  RotateCcw,
  AlertCircle,
  Receipt,
  User
} from "lucide-react";

import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { PropertyPageHeader } from "@/components/property/PropertyPageHeader";
import { PropertyNavigationFooter } from "@/components/property/PropertyNavigationFooter";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { AddressTab } from "@/components/property/AddressTab";
import { DEFAULT_ADDRESS_CODES } from "@/constants/propertyConstants";
import type { AddressCodes } from "@/hooks/property/property.types";

import { DrawnShape } from "@/types/googleMap.types";
import { convertShapesToGeoJson, logPolygonInfo } from "@/utils/geoJsonConverter";
import { getErrorMessage } from "@/lib/utils";
import { PREPARED_FOR_OPTIONS } from "@/constants/preparedForOptions";

import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { usePropertyValuation, useUpdatePropertyValuation } from "@/hooks/propertyValuation/usePropertyValuation";
import { useAuth } from "@/hooks/auth/useAuth";
import type { GeoJsonPolygon } from "@/hooks/propertyValuation/propertyValuation.types";
import { propertyAddressService } from "@/hooks/propertyAddress/propertyAddress.service";
import {
  ensureResolvedAddressHierarchy,
  getAddressEntityCode,
  toResolvedAddressItem,
  completeResolvedHierarchyFromDetectedAddress,
  type ResolvedAddressDraft,
} from "@/utils/propertyAddressResolution";
import type { ResolvedAddressHierarchyItems } from "@/types/propertyAddress.types";

// ------------------------------------
// ✅ Types
// ------------------------------------
type ConfirmDialogState = {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
};

// ... (Keep Schema, Utils, and Payload Builders exactly as they were) ...
// ------------------------------------
// ✅ Schema (valuation + property flatten)
// ------------------------------------
import { propertyValuationBaseSchema } from "@/hooks/propertyValuation/propertyValuation.schema";

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

const editSchema = propertyValuationBaseSchema.extend({
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
  purposeOfValuation: z.string().optional(),
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
  totalSizeByTitleDeed: z.coerce.number().optional(),

  landValue: z.coerce.number().optional(),
 buildingValue: z.coerce.number().optional(),
 marketValue: z.coerce.number().optional(),
 forcedSaleValue: z.coerce.number().optional(),
 pricePerSqm: z.coerce.number().optional(),
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
  // ForcedSale <= MarketValue
  if (
    data.marketValue !== undefined &&
    data.forcedSaleValue !== undefined &&
    data.forcedSaleValue > data.marketValue
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Forced sale value cannot exceed market value',
      path: ['forcedSaleValue'],
    });
  }
});

type EditValues = z.infer<typeof editSchema>;

// ------------------------------------
// ✅ Utils
// ------------------------------------
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

const optionalNumber = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  return v;
}, z.coerce.number().optional());

export const schema = z.object({
  landValue: optionalNumber,
  buildingValue: optionalNumber,
  marketValue: optionalNumber,
  forcedSaleValue: optionalNumber,
  pricePerSqm: optionalNumber,
});


const toDateInput = (value?: string | Date | null) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10); // ✅ YYYY-MM-DD
};


const trimValue = (value?: string | Date | null) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  const v = value?.trim();
  return v ? v : undefined;
};

const normalizePolygon = (raw: unknown): GeoJsonPolygon | null => {
  if (!raw) return null;

  let candidate: unknown = raw;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  if (
    typeof candidate === "object" &&
    candidate !== null &&
    (candidate as GeoJsonPolygon).type === "Polygon" &&
    Array.isArray((candidate as GeoJsonPolygon).coordinates)
  ) {
    return candidate as GeoJsonPolygon;
  }

  return null;
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


const buildPropertyNested = (
  values: EditValues,
  shapes: DrawnShape[],
  cachedPolygonGeoJson: GeoJsonPolygon | null
) => {
  const shapePolygon = shapes.length ? convertShapesToGeoJson(shapes) : null;
  const fallbackPolygon = normalizePolygon(values.polygon);
  const polygonGeoJson = cachedPolygonGeoJson ?? shapePolygon ?? fallbackPolygon;
  if (polygonGeoJson) logPolygonInfo(polygonGeoJson, "Edit Property Location");

  const hasLatLng =
    typeof values.latitude === "number" && typeof values.longitude === "number";
  const hasAnyLocation =
    hasLatLng ||
    !!trimValue(values.formattedAddress) ||
    !!trimValue(values.placeId) ||
    !!trimValue(values.geolocationLink) ||
    !!polygonGeoJson;

  return {
    propertyName: trimValue(values.propertyName),
    propertyTypeId: values.propertyTypeId,
    propertySubtypeId: values.propertySubtypeId ?? undefined,
    currentUseId: values.currentUseId ?? undefined,
    status: trimValue(values.propertyStatus),
    description: trimValue(values.description),

    propertyAddress:
      trimValue(values.provinceId) &&
      trimValue(values.districtId) &&
      trimValue(values.communeId)
        ? {
            provinceId: trimValue(values.provinceId)!,
            districtId: trimValue(values.districtId)!,
            communeId: trimValue(values.communeId)!,
            villageId: trimValue(values.villageId) ?? null,
            street: trimValue(values.street) ?? null,
            houseNo: trimValue(values.houseNo) ?? null,
          }
        : undefined,

    propertyLocation: hasAnyLocation
      ? {
          latitude: hasLatLng ? values.latitude : undefined,
          longitude: hasLatLng ? values.longitude : undefined,
          formattedAddress: trimValue(values.formattedAddress),
          placeId: trimValue(values.placeId),
          geolocationLink: trimValue(values.geolocationLink),
          polygon: polygonGeoJson ?? null,
        }
      : undefined,

    titleDocument: trimValue(values.titleDeedType)
      ? {
          titleDeedType: trimValue(values.titleDeedType)!,
          titleDeedNo: trimValue(values.titleDeedNo) ?? null,
          issuedYear: trimValue(values.issuedYear) ?? null,
          parcelNo: trimValue(values.parcelNo) ?? null,
          totalSizeByTitleDeed: values.totalSizeByTitleDeed
            ? Number(values.totalSizeByTitleDeed)
            : null,
        }
      : undefined,

    dataSource: {
      sourceType: (trimValue(values.sourceType) ?? "OWNERSHIP") as any,
      contactName: trimValue(values.contactName),
      phoneNumber: trimValue(values.phoneNumber),
    },
  };
};

const buildValuationBase = (values: EditValues) => ({
  valuationNo: trimValue(values.valuationNo),
  valuationMethod: trimValue(values.valuationMethod),
  currency: trimValue(values.currency) ?? "USD",
  status: values.status,
  
  // FIX: Explicitly ignore workflowStatus from form if it's 'REJECTED' to allow backend to reset it
  workflowStatus: values.workflowStatus === "REJECTED" ? undefined : (values.workflowStatus as any),

  landValue: values.landValue ?? undefined,
  buildingValue: values.buildingValue ?? undefined,
  marketValue: values.marketValue ?? undefined,
  forcedSaleValue: values.forcedSaleValue ?? undefined,
  pricePerSqm: values.pricePerSqm ?? undefined,

  dateOfInspection: trimValue(values.dateOfInspection),
  valuationDate: trimValue(values.valuationDate),
  dateOfReport: trimValue(values.dateOfReport),

  valuerId: values.valuerId ?? undefined,
  inspectorName: trimValue(values.inspectorName),

  purposeOfValuation: trimValue(values.purposeOfValuation),
  preparedFor: trimValue(values.preparedFor),
  note: trimValue(values.note),
  internalNotes: trimValue(values.internalNotes),
});

const toFormDataUpdate = (payload: any) => {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "property") return;
    if (k === "valuationPdf") return;
    fd.append(k, String(v));
  });
  if (payload.property) fd.append("property", JSON.stringify(payload.property));
  if (payload.valuationPdf instanceof File) fd.append("valuationPdf", payload.valuationPdf);
  return fd;
};

// Validate date string format and value (must be before schema)
const isValidDateString = (value?: string | Date): boolean => {
  if (!value) return true; // Empty is OK (optional)
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return false;
    const year = value.getFullYear();
    return year >= 1900 && year <= 2100;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === "") return true;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(trimmed)) return false;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return false;
    const year = date.getFullYear();
    return year >= 1900 && year <= 2100;
  }
  return false;
};

// ------------------------------------
// ✅ Page
// ------------------------------------
export default function EditPropertyValuationPage() {
  const t = useTranslations("propertyValuation");
  const tp = useTranslations("properties");
  const tc = useTranslations("common");
  const params = useParams() as { id?: string };
  const id = Number(params?.id || 0);
  const router = useRouter();

  const updateMutation = useUpdatePropertyValuation();
  const { data, isLoading, isError } = usePropertyValuation(id, !!id);
  const { hasHierarchyLevel } = useAuth();
  const canSelectStatus = hasHierarchyLevel(2);

  const propertyTypes = usePropertyTypes();
  const [shapes, setShapes] = useState<DrawnShape[]>([]);
  const [existingPolygon, setExistingPolygon] = useState<GeoJsonPolygon | null>(null);
  const [polygonGeoJson, setPolygonGeoJson] = useState<GeoJsonPolygon | null>(null);
  const hadPolygonDrawnRef = useRef(false);
  const initializedValuationIdRef = useRef<number | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [addressCodes, setAddressCodes] = useState<AddressCodes>(DEFAULT_ADDRESS_CODES);
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

  const [currentTab, setCurrentTab] = useState<"introduction" | "property" | "valuation">("introduction");

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const isSubmitting = updateMutation.isPending;

  // Options for dropdowns
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
      { value: "THB", label: "THB" },
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

  const titleDeedTypeOptions = useMemo(
    () => [
      { value: "HARD", label: "HARD" },
      { value: "SOFT", label: "SOFT" },
      { value: "LMAP", label: "LMAP" },
      { value: "STRATA", label: "STRATA" },
    ],
    []
  );

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      currency: "USD",
      workflowStatus: "DRAFT",
      status: "ACTIVE",
      // ... (other defaults)
      provinceId: "",
      districtId: "",
      communeId: "",
      villageId: "",
      street: "",
      houseNo: "",
      formattedAddress: "",
      placeId: "",
      geolocationLink: "",
    },
    mode: "onBlur",
  });

  useEffect(() => {
    initializedValuationIdRef.current = null;
  }, [id]);

  useEffect(() => {
    if (!data) return;

    const pv: any = data;
    const incomingValuationId = Number(pv?.valuationId ?? pv?.id ?? 0);
    if (incomingValuationId && initializedValuationIdRef.current === incomingValuationId) {
      return;
    }
    if (incomingValuationId) {
      initializedValuationIdRef.current = incomingValuationId;
    }

    const p: any = pv.property;

    // Reset form with data (addressCodes will be derived automatically)
    form.reset({
      // valuation
      valuationNo: pv.valuationNo ?? "",
      valuationMethod: pv.valuationMethod ?? "",
      currency: pv.currency ?? "USD",
      workflowStatus: pv.workflowStatus ?? "DRAFT",
      status: pv.status ?? "ACTIVE",

      landValue: pv.landValue ?? undefined,
      buildingValue: pv.buildingValue ?? undefined,
      marketValue: pv.marketValue ?? undefined,
      forcedSaleValue: pv.forcedSaleValue ?? undefined,
      pricePerSqm: pv.pricePerSqm ?? undefined,

      dateOfInspection: toDateInput(pv.dateOfInspection),
      valuationDate: toDateInput(pv.valuationDate),
      dateOfReport: toDateInput(pv.dateOfReport),

      valuerId: pv.valuerId ?? undefined,
      inspectorName: pv.inspectorName ?? "",
      purposeOfValuation: pv.purposeOfValuation ?? "",
      preparedFor: pv.preparedFor ?? "",
      note: pv.note ?? "",
      internalNotes: pv.internalNotes ?? "",

      valuationPdf: undefined,

      // property
      propertyName: p?.propertyName ?? "",
      propertyTypeId: p?.propertyTypeId ?? undefined,
      propertySubtypeId: p?.propertySubtypeId ?? undefined,
      currentUseId: p?.currentUseId ?? undefined,
      propertyStatus: p?.status ?? "",
      description: p?.description ?? "",

      // address
      provinceId: getAddressEntityCode(p?.propertyAddress?.province) ?? "",
      districtId: getAddressEntityCode(p?.propertyAddress?.district) ?? "",
      communeId: getAddressEntityCode(p?.propertyAddress?.commune) ?? "",
      villageId: getAddressEntityCode(p?.propertyAddress?.village) ?? "",
      street: p?.propertyAddress?.street ?? "",
      houseNo: p?.propertyAddress?.houseNo ?? "",

      // location
      latitude:
        p?.propertyLocation?.latitude !== null &&
        p?.propertyLocation?.latitude !== undefined
          ? Number(p.propertyLocation.latitude)
          : undefined,
      longitude:
        p?.propertyLocation?.longitude !== null &&
        p?.propertyLocation?.longitude !== undefined
          ? Number(p.propertyLocation.longitude)
          : undefined,
      formattedAddress: p?.propertyLocation?.formattedAddress ?? "",
      placeId: p?.propertyLocation?.placeId ?? "",
      geolocationLink: p?.propertyLocation?.geolocationLink ?? "",
      polygon: p?.propertyLocation?.polygon ?? undefined,

      // title doc
      titleDeedType: p?.titleDocument?.titleDeedType ?? "",
      titleDeedNo: p?.titleDocument?.titleDeedNo ?? "",
      issuedYear: p?.titleDocument?.issuedYear ?? "",
      parcelNo: p?.titleDocument?.parcelNo ?? "",
      totalSizeByTitleDeed: p?.titleDocument?.totalSizeByTitleDeed?.toString?.() ?? "",

      // data source
      sourceType: p?.dataSource?.sourceType ?? "OWNERSHIP",
      contactName: p?.dataSource?.contactName ?? "",
      phoneNumber: p?.dataSource?.phoneNumber ?? "",
    });

    // Sync addressCodes state immediately after form.reset()
    const provinceId = getAddressEntityCode(p?.propertyAddress?.province);
    const districtId = getAddressEntityCode(p?.propertyAddress?.district);
    const communeId = getAddressEntityCode(p?.propertyAddress?.commune);
    const villageId = getAddressEntityCode(p?.propertyAddress?.village);

    setAddressCodes({
      provinceId,
      districtId,
      communeId,
      villageId,
    });
    setResolvedAddressItems({
      province: toResolvedAddressItem(p?.propertyAddress?.province),
      district: toResolvedAddressItem(p?.propertyAddress?.district),
      commune: toResolvedAddressItem(p?.propertyAddress?.commune),
      village: toResolvedAddressItem(p?.propertyAddress?.village),
    });

    const rawPolygon = p?.propertyLocation?.polygon;
    const parsedPolygon = normalizePolygon(rawPolygon);

    if (parsedPolygon?.type === "Polygon" && parsedPolygon.coordinates?.length) {
      setExistingPolygon(parsedPolygon);
      setPolygonGeoJson(parsedPolygon);
      hadPolygonDrawnRef.current = false;
      logPolygonInfo(parsedPolygon, "Loaded Existing Polygon (Valuation)");
    } else {
      setExistingPolygon(null);
      setPolygonGeoJson(null);
      hadPolygonDrawnRef.current = false;
    }
  }, [data, form]);

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

  const watchedProvinceId = form.watch("provinceId");
  const watchedDistrictId = form.watch("districtId");
  const watchedCommuneId = form.watch("communeId");
  const watchedVillageId = form.watch("villageId");
  const watchedLatitude = form.watch("latitude");
  const watchedLongitude = form.watch("longitude");
  const watchedFormattedAddress = form.watch("formattedAddress");

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

  // Handlers
  const handleInputChange = useCallback(
    (field: string, value: string) => {
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
    },
    [form]
  );

  const handleAddressChange = useCallback(
    (codes: AddressCodes) => {
      // Update both addressCodes state and form values
      setAddressCodes(codes);
      setResolvedAddressItems(EMPTY_RESOLVED_ADDRESS_ITEMS);
      form.setValue("provinceId", codes.provinceId ?? "");
      form.setValue("districtId", codes.districtId ?? "");
      form.setValue("communeId", codes.communeId ?? "");
      form.setValue("villageId", codes.villageId ?? "");
    },
    [form]
  );

  const handleMapCoordinatesChange = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      hasAddressResolutionInteractionRef.current = true;
      preserveTypedDetectedAddressRef.current = false;
      addressResolutionSourceRef.current = "coordinates";
      form.setValue("latitude", Number.parseFloat(coords.latitude.toFixed(6)));
      form.setValue("longitude", Number.parseFloat(coords.longitude.toFixed(6)));
    },
    [form]
  );

  const handleShapesChange = useCallback(
    (newShapes: DrawnShape[]) => {
      setShapes(newShapes);

      if (newShapes.length > 0) {
        const geoJson = convertShapesToGeoJson(newShapes);
        if (geoJson) {
          setPolygonGeoJson(geoJson);
          hadPolygonDrawnRef.current = true;
          logPolygonInfo(geoJson, "Valuation Edit Polygon");
          const center = getPolygonCenter(geoJson);
          if (center) {
            form.setValue("latitude", center.latitude);
            form.setValue("longitude", center.longitude);
          }
        }
        return;
      }

      if (hadPolygonDrawnRef.current && polygonGeoJson) {
        return;
      }

      if (existingPolygon) {
        setPolygonGeoJson(existingPolygon);
      } else {
        setPolygonGeoJson(null);
      }
    },
    [existingPolygon, form, polygonGeoJson]
  );

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
        shouldPreserveManualCoordinates ? currentLatitude : resolved.latitude
      );
    }
    if (resolved.longitude != null) {
      form.setValue(
        "longitude",
        shouldPreserveManualCoordinates ? currentLongitude : resolved.longitude
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

  const handleReverseGeocode = useCallback(
    async (payload: any) => {
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
          payload.addressComponents ?? payload.address_components ?? [];
        const geometryLocation = payload.geometry?.location;
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
          : payload.latitude ?? payload.coordinates?.latitude ?? geometryLatitude ?? null;
        const resolvedLongitude = shouldPreserveManualCoordinates
          ? currentLongitude
          : payload.longitude ?? payload.coordinates?.longitude ?? geometryLongitude ?? null;
        const resolvedFormattedAddress =
          payload.formattedAddress ?? payload.formatted_address ?? null;
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
          placeId: payload.placeId ?? payload.place_id ?? null,
          googleMapLink: payload.googleMapLink ?? null,
          street: payload.street ?? findComponent("route") ?? null,
          houseNumber:
            payload.houseNumber ?? payload.streetNumber ?? findComponent("street_number") ?? null,
          provinceId: payload.provinceId ?? payload.provinceCode ?? null,
          districtId: payload.districtId ?? payload.districtCode ?? null,
          communeId: payload.communeId ?? payload.communeCode ?? null,
          villageId: payload.villageId ?? payload.villageCode ?? null,
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
    },
    [applyResolvedAddress, form]
  );

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
          console.error("Failed to resolve valuation edit address", error);
        }
      } finally {
        if (activeResolveRequestRef.current === requestId) {
          setIsReverseGeocoding(false);
        }
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [applyResolvedAddress, watchedFormattedAddress, watchedLatitude, watchedLongitude]);

  // Reset handler for address tab
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
    setExistingPolygon(null);
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

  // reset per-tab with confirmation
  const resetTab = useCallback(
    (tab: "introduction" | "property" | "address" | "documents" | "source" | "valuation") => {
      const titles: Record<typeof tab, string> = {
        introduction: "Clear Introduction",
        property: "Clear Property Information",
        address: "Clear Address Information",
        documents: "Clear Documents",
        source: "Clear Data Source",
        valuation: "Clear Valuation Details",
      };

      const descs: Record<typeof tab, string> = {
        introduction: "Clear introduction fields? This cannot be undone.",
        property: "Clear property fields? This cannot be undone.",
        address: "Clear address & location fields? This cannot be undone.",
        documents: "Clear document fields? This cannot be undone.",
        source: "Clear data source fields? This cannot be undone.",
        valuation: "Clear valuation fields? This cannot be undone.",
      };

      setConfirmDialog({
        isOpen: true,
        title: titles[tab],
        description: descs[tab],
        onConfirm: () => {
          const v = form.getValues();

          if (tab === "introduction") {
            form.reset({
              ...v,
              preparedFor: "",
              purposeOfValuation: "",
              note: "",
            });
          }

          if (tab === "property") {
            form.reset({
              ...v,
              propertyName: "",
              propertyTypeId: undefined,
              propertySubtypeId: undefined,
              currentUseId: undefined,
              description: "",
            });
          }

          if (tab === "address") {
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
            setExistingPolygon(null);
            setPolygonGeoJson(null);
            hadPolygonDrawnRef.current = false;
            setAddressCodes(DEFAULT_ADDRESS_CODES);
          }

          if (tab === "documents") {
            form.reset({
              ...v,
              titleDeedType: "",
              titleDeedNo: "",
              issuedYear: "",
              parcelNo: "",
              totalSizeByTitleDeed:undefined,
            });
          }

          if (tab === "source") {
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
              landValue: undefined,
              buildingValue: undefined,
              marketValue: undefined,
              forcedSaleValue: undefined,
              pricePerSqm: undefined,
              dateOfInspection: "",
              valuationDate: "",
              dateOfReport: "",
              inspectorName: "",
              internalNotes: "",
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

  // Submit
  const onSubmit = useCallback(
    async (values: EditValues) => {
      if (!id) return;

      const payload = {
        ...buildValuationBase(values),
        property: buildPropertyNested(values, shapes, polygonGeoJson), 
        valuationPdf: values.valuationPdf instanceof File ? values.valuationPdf : undefined,
      };

      const request = payload.valuationPdf ? (toFormDataUpdate(payload) as any) : payload;

      try {
        await updateMutation.mutateAsync({ id, data: request });
        toast.success("Updated successfully");
        router.push(`/dashboard/propertyValuation/${id}`);
      } catch (e: any) {
        toast.error(getErrorMessage(e, "Update failed"));
      }
    },
    [id, polygonGeoJson, router, shapes, updateMutation]
  );

  // Basic UI states
  if (!id) return <div className="min-h-dvh flex items-center justify-center">Invalid ID</div>;
  if (isLoading) return <div className="min-h-dvh flex items-center justify-center">Loading...</div>;
  if (isError || !data) return <div className="min-h-dvh flex items-center justify-center">Failed to load</div>;

  const currentWorkflowStatus = form.watch("workflowStatus");
  const isRejected = currentWorkflowStatus === "REJECTED";

  return (
    <PermissionGuard maxHierarchyLevel={3} redirectTo="/dashboard">
      <div className="min-h-dvh bg-gradient-to-br from-background via-background to-muted/20 overflow-x-visible overflow-y-auto">
        <PropertyPageHeader
          title="Edit Property Valuation"
          subtitle="Update valuation and subject property details"
          isSubmitting={isSubmitting}
          onSubmit={form.handleSubmit(onSubmit)}
          submitButtonText="Update"
          savingText="Updating..."
          onBack={() => router.push(`/dashboard/propertyValuation/${id}`)}
          backButtonAriaLabel="Back"
        />

        <div className="max-w-7xl mx-auto px-4 pb-10 pt-6 overflow-x-visible overflow-y-visible">
          {isRejected && (
            <Alert variant="destructive" className="mb-6 border-destructive/20 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>This valuation was rejected</AlertTitle>
              <AlertDescription>
                Making changes and saving will automatically reset the status to <strong>DRAFT</strong> so you can submit it again.
              </AlertDescription>
            </Alert>
          )}

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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
                
                {/* INTRODUCTION TAB */}
                <TabsContent value="introduction" className="space-y-6">
                  <IntroductionSection
                    form={form}
                    t={t}
                    isSubmitting={isSubmitting}
                    onReset={() => resetTab("introduction")}
                  />
                </TabsContent>

                {/* PROPERTY TAB */}
                <TabsContent value="property" className="space-y-6 overflow-x-visible overflow-y-visible">
                  <AddressTab 
                    formData={{
                      provinceId: form.watch("provinceId") ?? "",
                      districtId: form.watch("districtId") ?? "",
                      communeId: form.watch("communeId") ?? "",
                      villageId: form.watch("villageId") ?? "",
                      street: form.watch("street") ?? "",
                      houseNo: form.watch("houseNo") ?? "",
                      latitude: form.watch("latitude")?.toString() ?? "",
                      longitude: form.watch("longitude")?.toString() ?? "",
                      formattedAddress: form.watch("formattedAddress") ?? ""
                    }}
                    addressCodes={addressCodes}
                    resolvedAddressItems={resolvedAddressItems}
                    onInputChange={handleInputChange}
                    onAddressChange={handleAddressChange}
                    onCoordinatesChange={handleMapCoordinatesChange}
                    onReverseGeocode={handleReverseGeocode}
                    onShapesChange={handleShapesChange}
                    shapes={shapes}
                    existingPolygon={existingPolygon}
                    disableBoundaryPinUpdate={false}
                    enableShapeDrawing={true}
                    showMap={true}
                    isReverseGeocoding={isReverseGeocoding}
                    mapHeight="700px"
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

                  <PropertyDocumentsSection
                    form={form}
                    tp={tp}
                    tc={tc}
                    isSubmitting={isSubmitting}
                    titleDeedTypeOptions={titleDeedTypeOptions}
                    onReset={() => resetTab("documents")}
                  />

                  <PropertyDataSourceSection
                    form={form}
                    tp={tp}
                    tc={tc}
                    sourceTypeOptions={sourceTypeOptions}
                    isSubmitting={isSubmitting}
                    onReset={() => resetTab("source")}
                  />
                </TabsContent>

                {/* VALUATION TAB */}
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
                    parseNumberInput={parseNumberInput}
                  />
                </TabsContent>
              </form>
            </Form>
          </Tabs>

          {/* Footer Nav */}
          <PropertyNavigationFooter
            currentTab={currentTab as any}
            isSubmitting={isSubmitting}
            onPrevious={() => {
              const tabs = ["introduction", "property", "valuation"] as const;
              const idx = tabs.indexOf(currentTab);
              if (idx > 0) setCurrentTab(tabs[idx - 1]);
            }}
            onNext={() => {
              const tabs = ["introduction", "property", "valuation"] as const;
              const idx = tabs.indexOf(currentTab);
              if (idx < tabs.length - 1) setCurrentTab(tabs[idx + 1]);
            }}
            onSubmit={() => form.handleSubmit(onSubmit)()}
            translations={{
              previous: tc("previous"),
              next: tc("next"),
              createProperty: t("updateValuation") ?? "Update Valuation",
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

function IntroductionSection({ form, t, isSubmitting, onReset }: any) {
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
            Clear
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
                <FormLabel>{t("preparedFor")}</FormLabel>
                <Select
                  value={field.value?.trim() ? field.value : "__none"}
                  onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t("preparedForPlaceholder")} />
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
                <FormControl>
                  <Input
                    placeholder={t("purposeOfValuationPlaceholder")}
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
        <div className="grid gap-4 md:grid-cols-3">
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

        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="propertyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tp("propertyName")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={tp("propertyNamePlaceholder")}
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
              {tp("certificateOfOwnership")}
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
                <FormLabel>{tp("titleDeedType")}</FormLabel>
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
                <FormLabel>{tp("titleDeedNo")}</FormLabel>
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
                <FormLabel>{tp("totalSizeByTitleDeed")}</FormLabel>
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
  parseNumberInput,
}: any) {
  const selectedFile = form.watch("valuationPdf");
  const selectedFileName = selectedFile instanceof File ? selectedFile.name : "";

  return (
    <div className="space-y-6">
      {/* Details */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardList className="h-5 w-5 text-primary" />
                {t("sectionDetails")}
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

        <CardContent className="grid gap-4 md:grid-cols-5">
          <FormField
            control={form.control}
            name="valuationNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("valuationNo")}</FormLabel>
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
                <FormLabel>{t("valuationMethod")}</FormLabel>
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
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("currency")}</FormLabel>
                <Select value={field.value ?? "USD"} onValueChange={field.onChange} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {currencyOptions.map((op: any) => (
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
                <FormLabel>{t("workflowStatus")}</FormLabel>
                <Select
                  value={(field.value ?? "DRAFT") as string}
                  onValueChange={field.onChange}
                  disabled={!canSelectStatus || isSubmitting}
                >
                  <FormControl>
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
                {field.value === "REJECTED" && (
                  <FormDescription className="text-xs text-amber-600">
                    Will reset to Draft on save
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
                <FormLabel>
                  {t("propertyValuationStatus")}
                  <span className="text-red-500"> *</span>
                </FormLabel>
                <Select
                  value={field.value ?? ""}
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
            {t("sectionDates")}
          </CardTitle>
          <CardDescription>{t("sectionDatesDescription")}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-4">
          {(["dateOfInspection", "valuationDate", "dateOfReport"] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(name)}</FormLabel>
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
  {(
    ["landValue", "buildingValue", "marketValue", "forcedSaleValue", "pricePerSqm"] as const
  ).map((name) => (
    <FormField
      key={name}
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(name)}</FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              placeholder={t(`${name}Placeholder`)}
              value={field.value ?? ""}                 // ✅ always string/number
              onChange={(e) => field.onChange(parseNumberInput(e.target.value))} // ✅ number|undefined
              disabled={isSubmitting}
              className="h-11"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  ))}
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
