"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { usePropertiesLocation } from "@/hooks/property/useProperty";
import { useIndicativeValuations } from "@/hooks/indicativeValuation/useIndicativeValuation";
import { usePropertyValuations } from "@/hooks/propertyValuation/usePropertyValuation";
import PropertyLocationsMap from "@/components/PropertyLocationsMap";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyMapHeader } from "@/components/property/PropertyMapHeader";
import {
  PropertyMapAddressFilter,
  PropertyMapFilters,
} from "@/components/property/PropertyMapFilters";
import { PropertyMapLegend } from "@/components/property/PropertyMapLegend";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import type { PropertyLocationMarker } from "@/lib/mapHelpers";
import { PREPARED_FOR_OPTIONS } from "@/constants/preparedForOptions";

type PropertyLocationsPayload = {
  total?: number;
  locations?: PropertyLocationMarker[];
  properties?: { locations?: PropertyLocationMarker[] };
  property?: { locations?: PropertyLocationMarker[] };
};

const APPROVED_WORKFLOW_STATUS = "APPROVED";
const ACTIVE_RECORD_STATUS = "ACTIVE";
const ALL_FILTER_VALUE = "all";

type CoverageFilter =
  | "all"
  | "property_only"
  | "property_valuation_only"
  | "indicative_valuation_only";
type MapSearchMode = "none" | "circle" | "polygon" | "rectangle";

const normalizeComparableText = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

const arePropertyIdListsEqual = (
  current: number[] | null,
  next: number[] | null,
) => {
  if (current === next) return true;
  if (current === null || next === null) return current === next;
  if (current.length !== next.length) return false;

  return current.every((propertyId, index) => propertyId === next[index]);
};

const resolvePropertyLocations = (payload: unknown): PropertyLocationMarker[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as PropertyLocationMarker[];
  if (typeof payload !== "object") return [];

  const data = payload as PropertyLocationsPayload;
  if (Array.isArray(data.locations)) return data.locations;
  if (data.properties && Array.isArray(data.properties.locations)) {
    return data.properties.locations;
  }
  if (data.property && Array.isArray(data.property.locations)) {
    return data.property.locations;
  }

  return [];
};

export default function PropertyMapPage() {
  const t = useTranslations("propertyMap");
  const router = useRouter();

  const [showFilters, setShowFilters] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Search State ---
  const [searchQuery, setSearchQuery] = useState(""); 
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // --- Filter States ---
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [addressFilter, setAddressFilter] = useState<PropertyMapAddressFilter>({
    provinceId: null,
    districtId: null,
    communeId: null,
    villageId: null,
  });

  // --- Valuation Filter States ---
  const [coverageFilter, setCoverageFilter] =
    useState<CoverageFilter>(ALL_FILTER_VALUE);
  const [valuationStatus, setValuationStatus] = useState<string>(ALL_FILTER_VALUE);
  const [valuationMethod, setValuationMethod] = useState<string>(ALL_FILTER_VALUE);
  const [preparedForFilter, setPreparedForFilter] =
    useState<string>(ALL_FILTER_VALUE);
  const [purposeOfValuationFilter, setPurposeOfValuationFilter] =
    useState<string>(ALL_FILTER_VALUE);
  const [mapSearchMode, setMapSearchMode] = useState<MapSearchMode>("none");
  const [searchPropertyIds, setSearchPropertyIds] = useState<number[] | null>(
    null,
  );
  const [searchResetToken, setSearchResetToken] = useState(0);
  
  const cancelSearchDebounce = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
  }, []);

  const flushSearchDebounce = useCallback(() => {
    cancelSearchDebounce();
    setDebouncedSearch(searchQuery.trim());
  }, [cancelSearchDebounce, searchQuery]);

  useEffect(() => {
    cancelSearchDebounce();
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);

    return () => cancelSearchDebounce();
  }, [searchQuery, cancelSearchDebounce]);

  const clearSearchInput = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
    cancelSearchDebounce();
  }, [cancelSearchDebounce]);

  const handleAddressFilterChange = useCallback((next: PropertyMapAddressFilter) => {
    setAddressFilter((prev) => {
      if (
        prev.provinceId === next.provinceId &&
        prev.districtId === next.districtId &&
        prev.communeId === next.communeId &&
        prev.villageId === next.villageId
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const handleMapSearchModeChange = useCallback((nextMode: MapSearchMode) => {
    setMapSearchMode((prev) => (prev === nextMode ? "none" : nextMode));
    setSearchPropertyIds(null);
    setSearchResetToken((prev) => prev + 1);
  }, []);

  const resetMapSearchShapes = useCallback(() => {
    setSearchResetToken((prev) => prev + 1);
  }, []);

  const clearMapSearchSelection = useCallback(() => {
    setSearchPropertyIds(null);
    resetMapSearchShapes();
  }, [resetMapSearchShapes]);

  const exitMapSearch = useCallback(() => {
    setMapSearchMode("none");
    setSearchPropertyIds(null);
    resetMapSearchShapes();
  }, [resetMapSearchShapes]);

  const handleSearchResultChange = useCallback((propertyIds: number[] | null) => {
    setSearchPropertyIds((prev) =>
      arePropertyIdListsEqual(prev, propertyIds) ? prev : propertyIds,
    );
  }, []);

  // --- 2. QUERY PARAMS ---
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};

    // Use debouncedSearch here instead of searchQuery
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

    if (statusFilter && statusFilter !== "All") params.status = statusFilter;
    if (addressFilter.provinceId) params.provinceId = addressFilter.provinceId;
    if (addressFilter.districtId) params.districtId = addressFilter.districtId;
    if (addressFilter.communeId) params.communeId = addressFilter.communeId;
    if (addressFilter.villageId) params.villageId = addressFilter.villageId;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    
    // Valuation filters
    if (coverageFilter === "property_only") {
      params.hasValuation = "false";
      params.hasIndicativeValuation = "false";
    } else if (coverageFilter === "property_valuation_only") {
      params.hasValuation = "true";
    } else if (coverageFilter === "indicative_valuation_only") {
      params.hasIndicativeValuation = "true";
    }
    if (valuationStatus && valuationStatus !== "all" && valuationStatus !== "All") {
      params.valuationStatus = valuationStatus;
    }
    if (valuationMethod && valuationMethod !== "all" && valuationMethod !== "All") {
      params.valuationMethod = valuationMethod;
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }, [
    debouncedSearch, 
    statusFilter,
    addressFilter,
    minPrice,
    maxPrice,
    coverageFilter,
    valuationStatus,
    valuationMethod,
  ]);

  const locationQuery = usePropertiesLocation(queryParams);
  const activeQuery = locationQuery;
  const normalizedValuationStatus =
    valuationStatus && valuationStatus !== "all" && valuationStatus !== "All"
      ? valuationStatus
      : undefined;
  const normalizedValuationMethod =
    valuationMethod && valuationMethod !== "all" && valuationMethod !== "All"
      ? valuationMethod
      : undefined;
  const valuationSummaryQuery = usePropertyValuations({
    page: 1,
    limit: 1,
    status: normalizedValuationStatus as any,
    valuationMethod: normalizedValuationMethod as any,
    search: debouncedSearch.trim() || undefined,
    preparedFor:
      preparedForFilter !== ALL_FILTER_VALUE ? preparedForFilter : undefined,
    purposeOfValuation:
      purposeOfValuationFilter !== ALL_FILTER_VALUE
        ? purposeOfValuationFilter
        : undefined,
  });
  const indicativeSummaryQuery = useIndicativeValuations({
    page: 1,
    limit: 1,
    search: debouncedSearch.trim() || undefined,
    preparedFor:
      preparedForFilter !== ALL_FILTER_VALUE ? preparedForFilter : undefined,
    purposeOfValuation:
      purposeOfValuationFilter !== ALL_FILTER_VALUE
        ? purposeOfValuationFilter
        : undefined,
  });

  const handlePropertyClick = useCallback(
    (propertyId: number) => {
      router.push(`/dashboard/property/${propertyId}`);
    },
    [router]
  );

  const clearFilters = useCallback(() => {
    setStatusFilter("");
    clearSearchInput();
    setMinPrice("");
    setMaxPrice("");
    setCoverageFilter(ALL_FILTER_VALUE);
    setValuationStatus(ALL_FILTER_VALUE);
    setValuationMethod(ALL_FILTER_VALUE);
    setPreparedForFilter(ALL_FILTER_VALUE);
    setPurposeOfValuationFilter(ALL_FILTER_VALUE);
    setAddressFilter({
      provinceId: null,
      districtId: null,
      communeId: null,
      villageId: null,
    });
    exitMapSearch();
  }, [clearSearchInput, exitMapSearch]);

  const clearAll = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  const hasAddressFilter = useMemo(
    () =>
      Boolean(
        addressFilter.provinceId ||
          addressFilter.districtId ||
          addressFilter.communeId ||
          addressFilter.villageId
      ),
    [addressFilter]
  );

  const activeFilterCount = useMemo(() => {
    return (
      (statusFilter && statusFilter !== "All" ? 1 : 0) +
      (hasAddressFilter ? 1 : 0) +
      (minPrice || maxPrice ? 1 : 0) +
      (coverageFilter !== ALL_FILTER_VALUE ? 1 : 0) +
      (valuationStatus && valuationStatus !== "all" && valuationStatus !== "All" ? 1 : 0) +
      (valuationMethod && valuationMethod !== "all" && valuationMethod !== "All"
        ? 1
        : 0) +
      (preparedForFilter !== ALL_FILTER_VALUE ? 1 : 0) +
      (purposeOfValuationFilter !== ALL_FILTER_VALUE ? 1 : 0) +
      (searchPropertyIds !== null ? 1 : 0)
    );
  }, [
    statusFilter,
    hasAddressFilter,
    minPrice,
    maxPrice,
    coverageFilter,
    valuationStatus,
    valuationMethod,
    preparedForFilter,
    purposeOfValuationFilter,
    searchPropertyIds,
  ]);

  const properties = useMemo(() => {
    const locations = resolvePropertyLocations(activeQuery.data);
    const selectedValuationMethod =
      valuationMethod && valuationMethod !== "all" && valuationMethod !== "All"
        ? valuationMethod.toUpperCase()
        : null;
    const selectedPreparedFor =
      preparedForFilter !== ALL_FILTER_VALUE
        ? normalizeComparableText(preparedForFilter)
        : null;
    const selectedPurposeOfValuation =
      purposeOfValuationFilter !== ALL_FILTER_VALUE
        ? normalizeComparableText(purposeOfValuationFilter)
        : null;

    return locations
      .map((property) => {
        const approvedValuations = (property.valuation ?? []).filter(
          (valuation) => {
            const isApprovedWorkflow =
              (valuation.workflowStatus ?? "").toUpperCase() ===
              APPROVED_WORKFLOW_STATUS;
            const isActiveStatus =
              (valuation.status ?? "").toUpperCase() === ACTIVE_RECORD_STATUS;
            if (!isApprovedWorkflow || !isActiveStatus) return false;
            if (!selectedValuationMethod) return true;

            return (
              (valuation.valuationMethod ?? "").toUpperCase() ===
              selectedValuationMethod
            );
          }
        );
        const approvedIndicativeValuations = (property.indicativeValuation ?? []).filter(
          (valuation) =>
            (valuation.workflowStatus ?? "").toUpperCase() ===
              APPROVED_WORKFLOW_STATUS &&
            (valuation.status ?? "").toUpperCase() === ACTIVE_RECORD_STATUS,
        );
        const hasApprovedValuation = approvedValuations.length > 0;
        const hasApprovedIndicativeValuation = approvedIndicativeValuations.length > 0;
        const isApprovedProperty =
          (property.workflowStatus ?? "").toUpperCase() ===
          APPROVED_WORKFLOW_STATUS;

        return {
          ...property,
          valuation: approvedValuations,
          indicativeValuation: approvedIndicativeValuations,
          hasValuation: hasApprovedValuation,
          hasIndicativeValuation: hasApprovedIndicativeValuation,
          isMapEligibleByWorkflow:
            isApprovedProperty ||
            hasApprovedValuation ||
            hasApprovedIndicativeValuation,
        };
      })
      .filter((property) => {
        if (!property.isMapEligibleByWorkflow) return false;

        const hasPropertyValuation = Boolean(property.hasValuation);
        const hasIndicativeValuation = Boolean(property.hasIndicativeValuation);

        if (coverageFilter === "property_only") {
          if (hasPropertyValuation || hasIndicativeValuation) return false;
        }
        if (
          coverageFilter === "property_valuation_only" &&
          !hasPropertyValuation
        ) {
          return false;
        }
        if (
          coverageFilter === "indicative_valuation_only" &&
          !hasIndicativeValuation
        ) {
          return false;
        }

        if (selectedPreparedFor) {
          const preparedForMatched =
            property.valuation?.some(
              (valuation) =>
                normalizeComparableText(valuation.preparedFor) === selectedPreparedFor
            ) ||
            property.indicativeValuation?.some(
              (valuation) =>
                normalizeComparableText(valuation.preparedFor) === selectedPreparedFor
            );

          if (!preparedForMatched) return false;
        }

        if (selectedPurposeOfValuation) {
          const purposeMatched =
            property.valuation?.some(
              (valuation) =>
                normalizeComparableText(valuation.purposeOfValuation) ===
                selectedPurposeOfValuation
            ) ||
            property.indicativeValuation?.some(
              (valuation) =>
                normalizeComparableText(valuation.purposeOfValuation) ===
                selectedPurposeOfValuation
            );

          if (!purposeMatched) return false;
        }

        return true;
      });
  }, [
    activeQuery.data,
    coverageFilter,
    preparedForFilter,
    purposeOfValuationFilter,
    valuationMethod,
  ]);

  const displayedProperties = useMemo(() => {
    if (searchPropertyIds === null) return properties;
    const propertyIds = new Set(searchPropertyIds);
    return properties.filter((property) => propertyIds.has(property.propertyId));
  }, [properties, searchPropertyIds]);

  const propertyTypeNames = useMemo(() => {
    const names = new Set<string>();
    displayedProperties.forEach((property: { propertyType?: { propertyName?: string } }) => {
      if (property.propertyType?.propertyName) {
        names.add(property.propertyType.propertyName);
      }
    });
    return Array.from(names);
  }, [displayedProperties]);

  const totalProperties = useMemo(() => displayedProperties.length, [displayedProperties]);
  const totalValuationRecords = valuationSummaryQuery.data?.pagination?.total ?? 0;
  const totalIndicativeValuationRecords =
    indicativeSummaryQuery.data?.pagination?.total ?? 0;
  const isLoading = activeQuery.isLoading;
  const isInitialLoad =
    locationQuery.isLoading &&
    !locationQuery.data &&
    !locationQuery.error;
  const isRefetching = activeQuery.isFetching && !isInitialLoad;
  const activeError = activeQuery.error;
  const activeRefetch = activeQuery.refetch;
  const isAreaSearchApplied = searchPropertyIds !== null;

  const errorMessage = useMemo(() => {
    if (!activeError) return "";
    if (activeError instanceof Error && activeError.message) {
      return activeError.message;
    }
    return t("unexpectedError");
  }, [activeError, t]);

  // Status Options
  const statusOptions = useMemo(() => [
    { value: "ACTIVE", label: t("statuses.active") },
    { value: "INACTIVE", label: t("statuses.inactive") },
    { value: "SOLD", label: t("statuses.sold") },
    { value: "RENTED", label: t("statuses.rented") },
    { value: "RENTAL_SALE", label: t("statuses.rentalSale") },
  ], [t]);

  // Valuation filter options
  const coverageFilterOptions = useMemo(
    () => [
      { value: "all", label: t("filterOptions.allProperties") },
      { value: "property_only", label: t("filterOptions.propertyOnly") },
      {
        value: "property_valuation_only",
        label: t("filterOptions.propertyValuationOnly"),
      },
      {
        value: "indicative_valuation_only",
        label: t("filterOptions.indicativeValuationOnly"),
      },
    ],
    [t]
  );

  const valuationStatusOptions = useMemo(() => [
    { value: "all", label: t("filterOptions.allStatuses") },
    { value: "ACTIVE", label: t("statuses.active") },
    { value: "SUPERSEDED", label: t("statuses.superseded") },
    { value: "EXPIRED", label: t("statuses.expired") },
    { value: "CANCELLED", label: t("statuses.cancelled") },
  ], [t]);

  const valuationMethodOptions = useMemo(() => [
    { value: "all", label: t("filterOptions.allMethods") },
    { value: "SALES_COMPARISON_APPROACH", label: t("valuationMethods.salesComparisonApproach") },
    { value: "INCOME_APPROACH", label: t("valuationMethods.incomeApproach") },
    { value: "COST_APPROACH", label: t("valuationMethods.costApproach") },
    { value: "SALES_AND_COST_APPROACH", label: t("valuationMethods.salesAndCostApproach") },
  ], [t]);

  const preparedForOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: t("filterOptions.allPreparedFor") },
      ...PREPARED_FOR_OPTIONS.map((option) => ({
        value: option,
        label: option,
      })),
    ],
    [t]
  );

  const purposeOfValuationOptions = useMemo(
    () => [
      {
        value: ALL_FILTER_VALUE,
        label: t("filterOptions.allPurposesOfValuation"),
      },
      {
        value: "MORTGAGE_LOAN",
        label: t("purposeOfValuationOptions.MORTGAGE_LOAN"),
      },
      {
        value: "SALE_PURCHASE",
        label: t("purposeOfValuationOptions.SALE_PURCHASE"),
      },
      {
        value: "INSURANCE",
        label: t("purposeOfValuationOptions.INSURANCE"),
      },
      {
        value: "FINANCIAL_REPORTING",
        label: t("purposeOfValuationOptions.FINANCIAL_REPORTING"),
      },
      {
        value: "INVESTMENT_ANALYSIS",
        label: t("purposeOfValuationOptions.INVESTMENT_ANALYSIS"),
      },
      {
        value: "TAXATION",
        label: t("purposeOfValuationOptions.TAXATION"),
      },
      {
        value: "COURT_DISPUTE",
        label: t("purposeOfValuationOptions.COURT_DISPUTE"),
      },
      {
        value: "OTHER",
        label: t("purposeOfValuationOptions.OTHER"),
      },
    ],
    [t]
  );

  // --- Initial Full Page Load ---
  if (isInitialLoad) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] space-y-6 animate-in fade-in duration-700">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="text-xl font-bold text-foreground">{t("loadingMap")}</p>
      </div>
    );
  }

  return (
    <PermissionGuard hierarchyLevel={3} redirectTo="/dashboard">
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background via-muted/20 to-background" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.14),transparent_55%)]" />

      <div className="space-y-4 p-2 animate-in fade-in duration-500">
        <div className="rounded-2xl  bg-card/80  backdrop-blur-sm">
          <div className="p-2 space-y-4">
            <PropertyMapHeader
              title={t("title")}
              description={
                t("description") 
              }
              totalProperties={totalProperties}
              isLoading={isLoading}
            />

            {activeError && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-semibold">{t("unableToLoadProperties")}</p>
                    <p className="text-xs text-destructive/80">{errorMessage}</p>
                  </div>
                </div>
                {activeRefetch && (
                  <Button
                    variant="outline"
                    onClick={() => activeRefetch()}
                    className="sm:ml-auto border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    {t("retry")}
                  </Button>
                )}
              </div>
            )}


            <PropertyMapFilters
              filtersLabel={t("filters")}
              searchPlaceholder={t("searchPlaceholder")}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearchSubmit={flushSearchDebounce}
              onSearchClear={clearSearchInput}
              isSearchPending={searchQuery !== debouncedSearch}
              isRefetching={isRefetching}
              showFilters={showFilters}
              onToggleFilters={() => setShowFilters((prev) => !prev)}
              activeFilterCount={activeFilterCount}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              minPrice={minPrice}
              onMinPriceChange={setMinPrice}
              maxPrice={maxPrice}
              onMaxPriceChange={setMaxPrice}
              addressFilter={addressFilter}
              onAddressFilterChange={handleAddressFilterChange}
              statusOptions={statusOptions}
              onClearFilters={clearAll}
              coverageFilter={coverageFilter}
              onCoverageFilterChange={(value) =>
                setCoverageFilter(value as CoverageFilter)
              }
              valuationStatus={valuationStatus}
              onValuationStatusChange={setValuationStatus}
              valuationMethod={valuationMethod}
              onValuationMethodChange={setValuationMethod}
              preparedFor={preparedForFilter}
              onPreparedForChange={setPreparedForFilter}
              purposeOfValuation={purposeOfValuationFilter}
              onPurposeOfValuationChange={setPurposeOfValuationFilter}
              coverageFilterOptions={coverageFilterOptions}
              valuationStatusOptions={valuationStatusOptions}
              valuationMethodOptions={valuationMethodOptions}
              preparedForOptions={preparedForOptions}
              purposeOfValuationOptions={purposeOfValuationOptions}
            />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="relative w-full rounded-2xl overflow-hidden border border-border shadow-xl bg-card">
            <div className="absolute top-3 left-3 right-[196px] z-[450] flex flex-wrap items-center gap-1.5 md:right-[188px]">
              <span className="rounded-full bg-background/90 backdrop-blur px-3 py-1 text-xs font-semibold text-foreground shadow-sm border border-border">
                {isLoading
                  ? t("loadingResults")
                  : t("resultsCount", { count: totalProperties })}
              </span>
              {isAreaSearchApplied && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-300/50">
                  {totalProperties} inside draw
                </span>
              )}
              <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold border border-primary/25">
                {t("valuationRecordsCount", { count: totalValuationRecords })}
              </span>
              <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold border border-amber-300/40">
                {t("indicativeRecordsCount", { count: totalIndicativeValuationRecords })}
              </span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold border border-border">
                  {t("activeFiltersCount", { count: activeFilterCount })}
                </span>
              )}
              {debouncedSearch && (
                <span
                  title={debouncedSearch}
                  className="rounded-full bg-foreground text-background px-3 py-1 text-xs font-semibold max-w-[180px] truncate"
                >
                  {t("searchLabel", { query: debouncedSearch })}
                </span>
              )}
            </div>

            <PropertyLocationsMap
              properties={properties}
              onPropertyClick={handlePropertyClick}
              height="calc(100vh - 140px)"
              enableClustering={true}
              coverageFilter={coverageFilter}
              addressFilter={addressFilter}
              onAddressFilterChange={handleAddressFilterChange}
              enableGISBoundaries={true}
              searchMode={mapSearchMode}
              onSearchModeChange={handleMapSearchModeChange}
              onSearchClear={clearMapSearchSelection}
              activeSearchPropertyIds={searchPropertyIds}
              onSearchResultChange={handleSearchResultChange}
              searchResetToken={searchResetToken}
            />

            {/* Modern Loading Overlay */}
            {isRefetching && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="bg-foreground/90 backdrop-blur-md text-background px-4 py-2 rounded-full shadow-lg flex items-center gap-3 border border-border/60">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    {t("updatingMapResults")}
                  </span>
                </div>
              </div>
            )}

            {/* No Results Overlay */}
            {!isLoading &&
              displayedProperties.length === 0 &&
              (queryParams || isAreaSearchApplied) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
                <div className="bg-card p-8 rounded-2xl shadow-2xl border border-border text-center max-w-sm animate-in zoom-in-95 duration-300">
                  <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    {t("noPropertiesFoundTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {t("noPropertiesFoundDescription")}
                  </p>
                  <Button
                    onClick={clearAll}
                    variant="outline"
                    className="w-full border-border hover:bg-muted text-foreground"
                  >
                    {t("clearSearchAndFilters")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <PropertyMapLegend
            statusOptions={statusOptions}
            propertyTypes={propertyTypeNames}
          />
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
