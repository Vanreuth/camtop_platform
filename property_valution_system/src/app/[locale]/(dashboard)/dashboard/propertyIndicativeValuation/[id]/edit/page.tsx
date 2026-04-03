"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { PropertyPageHeader } from "@/components/property/PropertyPageHeader";
import { PropertyNavigationFooter } from "@/components/property/PropertyNavigationFooter";
import { AddressTab } from "@/components/property/AddressTab";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { useAuth } from "@/hooks/auth/useAuth";
import { useUsers } from "@/hooks/user/useUser";
import {
  indicativeValuationKeys,
  useIndicativeValuation,
  useUpdateIndicativeValuation,
} from "@/hooks/indicativeValuation/useIndicativeValuation";
import { indicativeValuationApi } from "@/hooks/indicativeValuation/indicativeValuation.api";
import type { GeoJsonPolygon } from "@/hooks/propertyValuation/propertyValuation.types";
import { DEFAULT_ADDRESS_CODES } from "@/constants/propertyConstants";
import type { AddressCodes } from "@/hooks/property/property.types";
import type { DrawnShape } from "@/types/googleMap.types";
import { convertShapesToGeoJson, logPolygonInfo } from "@/utils/geoJsonConverter";
import { PREPARED_FOR_OPTIONS } from "@/constants/preparedForOptions";
import { propertyAddressService } from "@/hooks/propertyAddress/propertyAddress.service";
import {
  ensureResolvedAddressHierarchy,
  getAddressEntityCode,
  toResolvedAddressItem,
  completeResolvedHierarchyFromDetectedAddress,
  type ResolvedAddressDraft,
} from "@/utils/propertyAddressResolution";
import type { ResolvedAddressHierarchyItems } from "@/types/propertyAddress.types";
import {
  Building2,
  ClipboardList,
  DollarSign,
  Image as ImageIcon,
  Loader2,
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
const INTENDED_USE_VALUES = [
  "MORTGAGE_LOAN",
  "SALE_PURCHASE",
  "INSURANCE",
  "FINANCIAL_REPORTING",
  "INVESTMENT_ANALYSIS",
  "TAXATION",
  "COURT_DISPUTE",
  "OTHER",
] as const;

const schema = z.object({
  currency: z.string().min(3).max(3).default("USD"),
  status: z.enum(PROPERTY_VALUATION_STATUS).default("ACTIVE"),
  workflowStatus: z.enum(WORKFLOW_STATUS).default("APPROVED"),
  instructedBy: z.string().optional(),
  contactName: z.string().optional(),
  contactTel: z.string().optional(),
  chargeFee: z.string().optional(),
  valuerId: z.string().optional(),
  inspectorName: z.string().optional(),
  indicationDate: z.string().optional(),
  instructionDate: z.string().optional(),
  intendedUse: z.string().optional(),
  forcedSalePercent: z.string().optional(),
  note: z.string().optional(),
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
type ComponentDraft = {
  localId: string;
  id?: number;
  componentType: "LAND" | "BUILDING" | "OTHER";
  description: string;
  area: string;
  minRate: string;
  maxRate: string;
};
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

const toNumber = (value?: string) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseOptionalNumber = (value?: string) => {
  if (!value || !value.trim()) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const parseNullableNumber = (value?: string) => {
  if (!value || !value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const normalizeOptionalText = (value?: string | null) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeSelectValue = (value?: string | null) => normalizeOptionalText(value) ?? "";

const normalizePreparedForValue = (value?: string | null) => {
  const normalized = normalizeSelectValue(value);
  if (!normalized) return "";

  const matchedOption = PREPARED_FOR_OPTIONS.find(
    (option) => option.toLowerCase() === normalized.toLowerCase(),
  );
  return matchedOption ?? normalized;
};

const normalizeIntendedUseValue = (value?: string | null) => {
  const normalized = normalizeSelectValue(value);
  if (!normalized) return "";

  const canonicalValue = normalized.replace(/[\s-]+/g, "_").toUpperCase();
  return INTENDED_USE_VALUES.includes(canonicalValue as (typeof INTENDED_USE_VALUES)[number])
    ? canonicalValue
    : normalized;
};

const prependUnknownSelectOption = <T extends string>(
  options: readonly T[],
  value?: string | null,
) => {
  const normalized = normalizeSelectValue(value);
  if (!normalized || options.includes(normalized as T)) {
    return [...options];
  }

  return [normalized, ...options];
};

const prependUnknownOption = <T extends { value: string; label: string }>(
  options: readonly T[],
  value?: string | null,
) => {
  const normalized = normalizeSelectValue(value);
  if (!normalized || options.some((option) => option.value === normalized)) {
    return [...options];
  }

  return [{ value: normalized, label: normalized } as T, ...options];
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
    logPolygonInfo(polygon, "Indicative Edit Property Location");
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

const toDateInput = (value?: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatMoney = (value: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
};

const createComponentDraft = (
  componentType: "LAND" | "BUILDING" | "OTHER" = "LAND",
  description?: string,
): ComponentDraft => ({
  localId: `${componentType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  componentType,
  description:
    description ??
    (componentType === "LAND"
      ? "Land"
      : componentType === "BUILDING"
        ? "Building"
        : "Other"),
  area: "",
  minRate: "",
  maxRate: "",
});

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

const getAddressCodeValue = (
  nested?: {
    code?: string | number | null;
    provinceId?: string | number | null;
    districtId?: string | number | null;
    communeId?: string | number | null;
    villageId?: string | number | null;
  } | null,
  fallback?: string | number | null,
) => {
  const nestedCode = getAddressEntityCode(nested);
  if (nestedCode) return nestedCode;
  if (fallback !== undefined && fallback !== null && fallback !== "") {
    return String(fallback);
  }
  return "";
};

const buildPropertyDraftFromValuation = (valuation: any): NewPropertyDraft => ({
  propertyTypeId: valuation?.property?.propertyType?.propertyTypeId
    ? String(valuation.property.propertyType.propertyTypeId)
    : "",
  propertySubtypeId: valuation?.property?.propertySubtype?.propertySubtypeId
    ? String(valuation.property.propertySubtype.propertySubtypeId)
    : "",
  currentUseId: valuation?.property?.currentUse?.useId
    ? String(valuation.property.currentUse.useId)
    : valuation?.property?.currentUseId
      ? String(valuation.property.currentUseId)
      : "",
  propertyName: valuation?.property?.propertyName ?? "",
  description: valuation?.property?.description ?? "",
  provinceId: getAddressCodeValue(
    valuation?.property?.propertyAddress?.province,
    valuation?.property?.propertyAddress?.provinceId,
  ),
  districtId: getAddressCodeValue(
    valuation?.property?.propertyAddress?.district,
    valuation?.property?.propertyAddress?.districtId,
  ),
  communeId: getAddressCodeValue(
    valuation?.property?.propertyAddress?.commune,
    valuation?.property?.propertyAddress?.communeId,
  ),
  villageId: getAddressCodeValue(
    valuation?.property?.propertyAddress?.village,
    valuation?.property?.propertyAddress?.villageId,
  ),
  street: valuation?.property?.propertyAddress?.street ?? "",
  houseNo: valuation?.property?.propertyAddress?.houseNo ?? "",
  latitude:
    valuation?.property?.propertyLocation?.latitude != null
      ? String(valuation.property.propertyLocation.latitude)
      : "",
  longitude:
    valuation?.property?.propertyLocation?.longitude != null
      ? String(valuation.property.propertyLocation.longitude)
      : "",
  formattedAddress: valuation?.property?.propertyLocation?.formattedAddress ?? "",
  placeId: valuation?.property?.propertyLocation?.placeId ?? "",
  geolocationLink: valuation?.property?.propertyLocation?.geolocationLink ?? "",
});

export default function EditPropertyIndicativeValuationPage() {
  const params = useParams<{ id: string }>();
  const valuationId = Number(params.id);
  const t = useTranslations("indicativeValuation");
  const tc = useTranslations("common");
  const tp = useTranslations("properties");
  const router = useRouter();
  const queryClient = useQueryClient();
  const propertyTypes = usePropertyTypes();
  const { user, hasHierarchyLevel } = useAuth();
  const updateMutation = useUpdateIndicativeValuation();
  const { data: valuation, isLoading, isError } = useIndicativeValuation(
    valuationId,
    Number.isFinite(valuationId),
  );
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
      workflowStatus: "APPROVED",
      instructedBy: "",
      contactName: "",
      contactTel: "",
      chargeFee: "",
      valuerId: user?.id ? String(user.id) : "",
      inspectorName: "",
      indicationDate: "",
      instructionDate: "",
      intendedUse: "",
      forcedSalePercent: "",
      note: "",
      internalNotes: "",
    },
  });

  const { data: userListResult } = useUsers(
    { page: 1, limit: 100 },
    { enabled: canAssignValuer },
  );

  const valuers = userListResult?.users ?? [];
  const instructedByValue = form.watch("instructedBy");
  const intendedUseValue = form.watch("intendedUse");
  const normalizedInitialInstructedBy = useMemo(
    () => normalizePreparedForValue(valuation?.instructedBy ?? valuation?.preparedFor),
    [valuation?.instructedBy, valuation?.preparedFor],
  );
  const normalizedInitialIntendedUse = useMemo(
    () => normalizeIntendedUseValue(valuation?.intendedUse ?? valuation?.purposeOfValuation),
    [valuation?.intendedUse, valuation?.purposeOfValuation],
  );

  useEffect(() => {
    if (!valuation) return;

    form.reset({
      currency: valuation.currency ?? "USD",
      status: valuation.status ?? "ACTIVE",
      workflowStatus: valuation.workflowStatus ?? "APPROVED",
      instructedBy: normalizedInitialInstructedBy,
      contactName: valuation.contactName ?? "",
      contactTel: valuation.contactTel ?? "",
      chargeFee: valuation.chargeFee != null ? String(valuation.chargeFee) : "",
      valuerId: valuation.valuerId ? String(valuation.valuerId) : user?.id ? String(user.id) : "",
      inspectorName: valuation.inspectorName ?? "",
      indicationDate: toDateInput(valuation.indicationDate ?? valuation.valuationDate),
      instructionDate: toDateInput(valuation.instructionDate ?? valuation.dateOfInspection),
      intendedUse: normalizedInitialIntendedUse,
      forcedSalePercent:
        valuation.forcedSalePercent != null ? String(valuation.forcedSalePercent) : "",
      note: valuation.note ?? "",
      internalNotes: valuation.internalNotes ?? "",
    });

    const nextComponents =
      valuation.indicativeComponents?.length
        ? valuation.indicativeComponents.map((component, index) => ({
            localId: `existing-${component.id}-${index}`,
            id: component.id,
            componentType: component.componentType ?? "LAND",
            description:
              component.description ??
              (component.componentType === "BUILDING"
                ? "Building"
                : component.componentType === "OTHER"
                  ? "Other"
                  : "Land"),
            area: component.area !== undefined ? String(Number(component.area)) : "",
            minRate: component.minRate !== undefined ? String(Number(component.minRate)) : "",
            maxRate: component.maxRate !== undefined ? String(Number(component.maxRate)) : "",
          }))
        : [createComponentDraft("LAND")];

    setComponents(nextComponents);
    const nextProperty = buildPropertyDraftFromValuation(valuation);
    setNewProperty(nextProperty);
    setAddressCodes({
      provinceId: nextProperty.provinceId || null,
      districtId: nextProperty.districtId || null,
      communeId: nextProperty.communeId || null,
      villageId: nextProperty.villageId || null,
    });
    setResolvedAddressItems({
      province: toResolvedAddressItem(valuation.property?.propertyAddress?.province),
      district: toResolvedAddressItem(valuation.property?.propertyAddress?.district),
      commune: toResolvedAddressItem(valuation.property?.propertyAddress?.commune),
      village: toResolvedAddressItem(valuation.property?.propertyAddress?.village),
    });
  }, [form, normalizedInitialInstructedBy, normalizedInitialIntendedUse, user?.id, valuation]);

  useEffect(() => {
    if (!normalizedInitialInstructedBy) return;
    if (hasFilledValue(form.getValues("instructedBy"))) return;

    form.setValue("instructedBy", normalizedInitialInstructedBy, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [form, normalizedInitialInstructedBy]);

  useEffect(() => {
    if (!normalizedInitialIntendedUse) return;
    if (hasFilledValue(form.getValues("intendedUse"))) return;

    form.setValue("intendedUse", normalizedInitialIntendedUse, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [form, normalizedInitialIntendedUse]);

  const valuerIdValue = form.watch("valuerId");
  const currency = form.watch("currency") || "USD";
  const forcedSalePercentValue = toNumber(form.watch("forcedSalePercent"));

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
  const instructedByOptions = useMemo(
    () =>
      prependUnknownSelectOption(
        PREPARED_FOR_OPTIONS,
        normalizeSelectValue(instructedByValue) || normalizedInitialInstructedBy,
      ),
    [instructedByValue, normalizedInitialInstructedBy],
  );
  const availableIntendedUseOptions = useMemo(
    () =>
      prependUnknownOption(
        intendedUseOptions,
        normalizeSelectValue(intendedUseValue) || normalizedInitialIntendedUse,
      ),
    [intendedUseOptions, intendedUseValue, normalizedInitialIntendedUse],
  );
  const instructedBySelectValue =
    normalizeSelectValue(instructedByValue) || normalizedInitialInstructedBy || "__none";
  const intendedUseSelectValue =
    normalizeSelectValue(intendedUseValue) || normalizedInitialIntendedUse || "__none";

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

  const selectedValuer = valuers.find((valuer) => String(valuer.id) === valuerIdValue);
  const assignedValuerLabel =
    selectedValuer
      ? `${selectedValuer.firstName} ${selectedValuer.lastName}`.trim()
      : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() ||
        user?.username ||
        t("notAssigned");

  const photoEntries = [
    {
      key: "frontSide",
      label: t("fields.frontViewPhoto"),
      value: valuation?.property?.propertyPhotos?.frontSide,
    },
    {
      key: "inside",
      label: t("fields.insideViewPhoto"),
      value: valuation?.property?.propertyPhotos?.inside,
    },
  ];

  const componentRows = useMemo(
    () =>
      components.map((component) => {
        const area = toNumber(component.area);
        const minRate = toNumber(component.minRate);
        const maxRate = toNumber(component.maxRate);
        return {
          ...component,
          areaValue: area,
          minRateValue: minRate,
          maxRateValue: maxRate,
          minValue: area * minRate,
          maxValue: area * maxRate,
        };
      }),
    [components],
  );

  const totalMinMarketValue = useMemo(
    () => componentRows.reduce((sum, component) => sum + component.minValue, 0),
    [componentRows],
  );
  const totalMaxMarketValue = useMemo(
    () => componentRows.reduce((sum, component) => sum + component.maxValue, 0),
    [componentRows],
  );
  const forcedSaleValue = useMemo(
    () => totalMaxMarketValue * (forcedSalePercentValue / 100),
    [forcedSalePercentValue, totalMaxMarketValue],
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
        logPolygonInfo(geoJson, "Indicative Edit Shape Changed");
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
          latitude: shouldPreserveManualCoordinates ? prev.latitude : String(resolved.latitude),
        }),
        ...(resolved.longitude != null && {
          longitude: shouldPreserveManualCoordinates ? prev.longitude : String(resolved.longitude),
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
          console.error("Failed to resolve indicative edit address", error);
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

  const removeComponent = (localId: string, index: number) => {
    if (index === 0) {
      toast.error(t("errors.primaryComponentLocked"));
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
            instructedBy: "",
            chargeFee: valuation?.chargeFee != null ? String(valuation.chargeFee) : "",
            instructionDate: "",
            indicationDate: toDateInput(valuation?.indicationDate ?? valuation?.valuationDate),
            intendedUse: "",
            note: "",
          });
        }

        if (tab === "valuation") {
          form.reset({
            ...values,
            currency: valuation?.currency ?? "USD",
            status: valuation?.status ?? "ACTIVE",
            workflowStatus: valuation?.workflowStatus ?? "APPROVED",
            contactName: valuation?.contactName ?? "",
            contactTel: valuation?.contactTel ?? "",
            valuerId: valuation?.valuerId
              ? String(valuation.valuerId)
              : defaultValuerId,
            inspectorName: "",
            forcedSalePercent: "",
            internalNotes: "",
          });
          setComponents(
            valuation?.indicativeComponents?.length
              ? valuation.indicativeComponents.map((component, index) => ({
                  localId: `existing-reset-${component.id}-${index}`,
                  id: component.id,
                  componentType: component.componentType ?? "LAND",
                  description:
                    component.description ??
                    (component.componentType === "BUILDING"
                      ? "Building"
                      : component.componentType === "OTHER"
                        ? "Other"
                        : "Land"),
                  area: component.area !== undefined ? String(Number(component.area)) : "",
                  minRate:
                    component.minRate !== undefined ? String(Number(component.minRate)) : "",
                  maxRate:
                    component.maxRate !== undefined ? String(Number(component.maxRate)) : "",
                }))
              : [createComponentDraft("LAND")],
          );
        }

        if (tab === "property") {
          const nextProperty = buildPropertyDraftFromValuation(valuation);
          setNewProperty(nextProperty);
          setShapes([]);
          setPolygonGeoJson(null);
          hadPolygonDrawnRef.current = false;
          setAddressCodes({
            provinceId: nextProperty.provinceId || null,
            districtId: nextProperty.districtId || null,
            communeId: nextProperty.communeId || null,
            villageId: nextProperty.villageId || null,
          });
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

  const onSubmit = form.handleSubmit(async (values) => {
    const primaryComponent = componentRows[0];
    if (!primaryComponent) {
      toast.error(t("errors.componentRequired"));
      setActiveTab("valuation");
      return;
    }

    if (
      !hasFilledValue(values.instructedBy) ||
      !hasFilledValue(values.intendedUse) ||
      !hasFilledValue(values.instructionDate) ||
      !hasFilledValue(values.indicationDate)
    ) {
      toast.error(t("errors.pdfFieldsRequired"));
      setActiveTab("introduction");
      return;
    }

    if (!newProperty.propertyTypeId) {
      toast.error(t("errors.propertyTypeRequired"));
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

    const invalidComponent = componentRows.find((component) => {
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

    await updateMutation.mutateAsync({
      id: valuationId,
      data: {
        propertyId: valuation?.propertyId,
        property: {
          propertyTypeId: Number(newProperty.propertyTypeId),
          propertySubtypeId: parseOptionalNumber(newProperty.propertySubtypeId),
          currentUseId: parseOptionalNumber(newProperty.currentUseId),
          propertyName: normalizeOptionalText(newProperty.propertyName),
          description: normalizeOptionalText(newProperty.description),
          propertyAddress: buildPropertyAddressInput(newProperty),
          propertyLocation: buildLocationInput(newProperty, shapes, polygonGeoJson),
        },
        currency: values.currency as any,
        status: values.status as any,
        workflowStatus: values.workflowStatus as any,
        instructedBy: normalizeOptionalText(values.instructedBy),
        contactName: normalizeOptionalText(values.contactName),
        contactTel: normalizeOptionalText(values.contactTel),
        chargeFee: parseNullableNumber(values.chargeFee),
        valuerId: Number(values.valuerId || user?.id || 0) || undefined,
        inspectorName: normalizeOptionalText(values.inspectorName),
        indicationDate: values.indicationDate || undefined,
        instructionDate: values.instructionDate || undefined,
        intendedUse: normalizeOptionalText(values.intendedUse),
        forcedSalePercent: parseNullableNumber(values.forcedSalePercent),
        note: normalizeOptionalText(values.note),
        internalNotes: normalizeOptionalText(values.internalNotes),
        componentType: primaryComponent.componentType,
        description: normalizeOptionalText(primaryComponent.description),
        area: parseOptionalNumber(primaryComponent.area),
        unit: "sqm",
        minRate: primaryComponent.minRateValue,
        maxRate: primaryComponent.maxRateValue,
      },
    });

    const existingExtraIds = (valuation?.indicativeComponents ?? [])
      .slice(1)
      .map((component) => component.id);
    const currentExtraIds = componentRows
      .slice(1)
      .map((component) => component.id)
      .filter((id): id is number => typeof id === "number");
    const removedIds = existingExtraIds.filter((id) => !currentExtraIds.includes(id));

    for (const component of componentRows.slice(1)) {
      const payload = {
        componentType: component.componentType,
        description: normalizeOptionalText(component.description),
        area: parseOptionalNumber(component.area),
        unit: "sqm",
        minRate: component.minRateValue,
        maxRate: component.maxRateValue,
      };

      if (component.id) {
        await indicativeValuationApi.updateIndicativeComponent(
          valuationId,
          component.id,
          payload,
        );
      } else {
        await indicativeValuationApi.createIndicativeComponent(valuationId, payload);
      }
    }

    for (const componentId of removedIds) {
      await indicativeValuationApi.deleteIndicativeComponent(valuationId, componentId);
    }

    await queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.detail(valuationId) });
    await queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.lists() });

    router.push(`/dashboard/propertyIndicativeValuation/${valuationId}`);
  });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("loading")}
        </div>
      </div>
    );
  }

  if (isError || !valuation) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-sm text-destructive">{t("loadError")}</p>
          <Button onClick={() => router.push("/dashboard/propertyIndicativeValuation")}>
            {tc("back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard
      maxHierarchyLevel={3}
      requiredPermissions={["property:read"]}
      requireAllPermissions
      redirectTo="/dashboard"
    >
      <div className="min-h-dvh bg-gradient-to-br from-background via-background to-muted/20">
        <PropertyPageHeader
          title={`${t("actions.edit")} ${t("detailsTitle")}`}
          subtitle="Update the indicative valuation sheet and keep its value range aligned."
          isSubmitting={updateMutation.isPending}
          onSubmit={onSubmit}
          submitButtonText="Save Changes"
          savingText={t("updating")}
          onBack={() => router.push(`/dashboard/propertyIndicativeValuation/${valuationId}`)}
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
              <form onSubmit={onSubmit} className="mt-6 space-y-6">
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
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <FormField
                          control={form.control}
                          name="instructedBy"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{renderRequiredLabel(t("fields.instructedBy"))}</FormLabel>
                              <Select
                                value={instructedBySelectValue}
                                onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
                                disabled={updateMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder={t("fields.instructedByPlaceholder")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none">{tc("none")}</SelectItem>
                                  {instructedByOptions.map((option) => (
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
                                value={intendedUseSelectValue}
                                onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
                                disabled={updateMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder={t("fields.intendedUsePlaceholder")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none">{tc("none")}</SelectItem>
                                  {availableIntendedUseOptions.map((option) => (
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
                          name="chargeFee"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("fields.chargeFee")}</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="h-11"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  disabled={updateMutation.isPending}
                                  placeholder={t("fields.chargeFeePlaceholder")}
                                />
                              </FormControl>
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
                                  disabled={updateMutation.isPending}
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
                                  disabled={updateMutation.isPending}
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
                            disabled={updateMutation.isPending}
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
                            disabled={!newProperty.propertyTypeId || updateMutation.isPending}
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
                            disabled={!newProperty.propertyTypeId || updateMutation.isPending}
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

                      <div className="space-y-2">
                        <FormLabel>{tp("propertyName")}</FormLabel>
                        <Input
                          className="h-11"
                          disabled={updateMutation.isPending}
                          placeholder={tp("propertyNamePlaceholder")}
                          value={newProperty.propertyName}
                          onChange={(event) => updateNewProperty("propertyName", event.target.value)}
                        />
                      </div>

                      <div className="rounded-2xl border bg-muted/20 p-5">
                        <div className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
                          <ImageIcon className="h-4 w-4 text-primary" />
                          {tp("propertyPhotos")}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {photoEntries.map((photo) => (
                            <div
                              key={photo.key}
                              className="rounded-2xl border-2 border-dashed bg-background p-4"
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <FormLabel>{photo.label}</FormLabel>
                                <span className="text-xs text-muted-foreground">Current photo</span>
                              </div>

                              {photo.value ? (
                                <div className="overflow-hidden rounded-2xl border bg-muted/10">
                                  <img
                                    src={photo.value}
                                    alt={photo.label}
                                    className="h-40 w-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed bg-muted/20 text-center text-sm text-muted-foreground">
                                  {tc("noData")}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <FormLabel>{tp("description")}</FormLabel>
                        <Textarea
                          rows={4}
                          disabled={updateMutation.isPending}
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

                    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.currency")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={updateMutation.isPending}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="USD" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="KHR">KHR</SelectItem>
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
                            <FormLabel>{t("fields.workflowStatus")}</FormLabel>
                            <Select
                              value={field.value ?? "APPROVED"}
                              onValueChange={field.onChange}
                              disabled={!canSelectStatus || updateMutation.isPending}
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
                                Workflow status is locked to `Approved` for valuers.
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
                            <FormLabel>{t("fields.indicativeValuationStatus")}</FormLabel>
                            <Select
                              value={field.value ?? "ACTIVE"}
                              onValueChange={field.onChange}
                              disabled={!canSelectStatus || updateMutation.isPending}
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
                                disabled={updateMutation.isPending}
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
                                disabled={updateMutation.isPending}
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
                                disabled={updateMutation.isPending}
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
                                disabled={updateMutation.isPending}
                                placeholder={t("fields.contactTelPlaceholder")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="forcedSalePercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.forcedSalePercent")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="h-11"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                disabled={updateMutation.isPending}
                                placeholder="0"
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
                          <FormItem className="md:col-span-2 xl:col-span-3">
                            <FormLabel>{renderRequiredLabel(t("fields.note"))}</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                disabled={updateMutation.isPending}
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
                          <FormItem className="md:col-span-2 xl:col-span-3">
                            <FormLabel>{t("fields.internalNotes")}</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                disabled={updateMutation.isPending}
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

                      <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                        {t("summary.areaUnit")}
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
                                  onClick={() => removeComponent(component.localId, index)}
                                  disabled={index === 0}
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
                                    disabled={updateMutation.isPending}
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
                                    disabled={updateMutation.isPending}
                                    required
                                    value={component.description}
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
                                    disabled={updateMutation.isPending}
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
                                    disabled={updateMutation.isPending}
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
                                    disabled={updateMutation.isPending}
                                    required
                                    value={component.maxRate}
                                    onChange={(event) =>
                                      updateComponent(component.localId, "maxRate", event.target.value)
                                    }
                                    placeholder="12"
                                  />
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border bg-primary/5 p-4">
                                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {t("fields.minValue")}
                                  </div>
                                  <div className="mt-2 text-lg font-semibold">
                                    {formatMoney(component.minValue, currency)}
                                  </div>
                                </div>
                                <div className="rounded-2xl border bg-primary/5 p-4">
                                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {t("fields.maxValue")}
                                  </div>
                                  <div className="mt-2 text-lg font-semibold">
                                    {formatMoney(component.maxValue, currency)}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <Separator />

                      <div className="grid gap-4 md:grid-cols-4">
                        <Card className="border-primary/10 bg-primary/5">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <DollarSign className="h-4 w-4 text-primary" />
                              {t("summary.totalMin")}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-semibold">
                              {formatMoney(totalMinMarketValue, currency)}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-primary/10 bg-primary/5">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <DollarSign className="h-4 w-4 text-primary" />
                              {t("summary.totalMax")}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-semibold">
                              {formatMoney(totalMaxMarketValue, currency)}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-primary/10 bg-primary/5">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <DollarSign className="h-4 w-4 text-primary" />
                              {t("summary.totalRange")}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-lg font-semibold">
                              {`${formatMoney(totalMinMarketValue, currency)} - ${formatMoney(totalMaxMarketValue, currency)}`}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-primary/10 bg-primary/5">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <DollarSign className="h-4 w-4 text-primary" />
                              {t("fields.forcedSaleValue")}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-sm text-muted-foreground">
                              {t("summary.forcedSalePercentOfTotalMax", {
                                percent: forcedSalePercentValue.toFixed(2),
                              })}
                            </div>
                            <div className="mt-2 text-lg font-semibold">
                              {formatMoney(forcedSaleValue, currency)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </form>
            </Form>
          </Tabs>

          <PropertyNavigationFooter
            currentTab={activeTab}
            isSubmitting={updateMutation.isPending}
            onPrevious={goPrevious}
            onNext={goNext}
            onSubmit={onSubmit}
            isFirstStep={currentStepIndex === 0}
            isLastStep={currentStepIndex === stepItems.length - 1}
            stepLabel={`${currentStepIndex + 1}/${stepItems.length}`}
            savingText={t("updating")}
            translations={{
              previous: tc("previous"),
              next: tc("next"),
              createProperty: "Save Changes",
            }}
          />
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
      </div>
    </PermissionGuard>
  );
}
