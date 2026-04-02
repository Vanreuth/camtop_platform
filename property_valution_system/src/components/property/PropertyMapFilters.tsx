import { Loader2, ChevronDown, DollarSign, Filter, MapPin, Search, X, FileCheck } from "lucide-react";
import { PropertyAddressForm } from "@/components/PropertyAddressForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PropertyMapAddressFilter = {
  provinceId: string | null;
  districtId: string | null;
  communeId: string | null;
  villageId: string | null;
};

type Option = {
  value: string;
  label: string;
};

interface PropertyMapFiltersProps {
  filtersLabel: string;
  searchPlaceholder?: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  isSearchPending: boolean;
  isRefetching: boolean;

  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;

  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  minPrice: string;
  onMinPriceChange: (value: string) => void;
  maxPrice: string;
  onMaxPriceChange: (value: string) => void;
  addressFilter: PropertyMapAddressFilter;
  onAddressFilterChange: (value: PropertyMapAddressFilter) => void;

  statusOptions: Option[];
  onClearFilters: () => void;

  // Valuation filter props
  coverageFilter?: string;
  onCoverageFilterChange?: (value: string) => void;
  valuationStatus?: string;
  onValuationStatusChange?: (value: string) => void;
  valuationMethod?: string;
  onValuationMethodChange?: (value: string) => void;
  preparedFor?: string;
  onPreparedForChange?: (value: string) => void;
  purposeOfValuation?: string;
  onPurposeOfValuationChange?: (value: string) => void;
  coverageFilterOptions?: Option[];
  valuationStatusOptions?: Option[];
  valuationMethodOptions?: Option[];
  preparedForOptions?: Option[];
  purposeOfValuationOptions?: Option[];
}

export function PropertyMapFilters({
  filtersLabel,
  searchPlaceholder,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  onSearchClear,
  isSearchPending,
  isRefetching,
  showFilters,
  onToggleFilters,
  activeFilterCount,
  statusFilter,
  onStatusFilterChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  addressFilter,
  onAddressFilterChange,
  statusOptions,
  onClearFilters,
  coverageFilter,
  onCoverageFilterChange,
  valuationStatus,
  onValuationStatusChange,
  valuationMethod,
  onValuationMethodChange,
  preparedFor,
  onPreparedForChange,
  purposeOfValuation,
  onPurposeOfValuationChange,
  coverageFilterOptions,
  valuationStatusOptions,
  valuationMethodOptions,
  preparedForOptions,
  purposeOfValuationOptions,
}: PropertyMapFiltersProps) {
  const hasAddressFilter = Boolean(
    addressFilter.provinceId ||
      addressFilter.districtId ||
      addressFilter.communeId ||
      addressFilter.villageId
  );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/70 p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={
              searchPlaceholder ||
              "Search by name, code, address, contact, or phone..."
            }
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearchSubmit();
              }
            }}
            className="pl-10 h-11 border-input bg-background focus-visible:ring-ring focus-visible:ring-2 transition-all"
          />
          {isSearchPending ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-xs text-muted-foreground animate-pulse">
                Typing...
              </span>
            </div>
          ) : isRefetching && searchQuery ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
          ) : (
            searchQuery && (
              <button
                onClick={onSearchClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={onToggleFilters}
            className={`h-11 min-w-[120px] relative transition-all ${
              showFilters
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            <Filter className="mr-2 h-4 w-4" />
            {filtersLabel}
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 px-1.5 h-5 min-w-[20px] flex items-center justify-center  text-current"
              >
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown
              className={`ml-2 h-4 w-4 transition-transform duration-200 ${
                showFilters ? "rotate-180" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="pt-5 border-t border-border animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="col-span-full p-4 rounded-lg border border-border bg-muted/20">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Location Filter
              </label>
              <PropertyAddressForm
                onAddressChange={onAddressFilterChange}
                value={addressFilter}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Property Status
              </label>
              <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="h-10 bg-background border-input">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valuation Filters */}
            {coverageFilterOptions && onCoverageFilterChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1">
                  <FileCheck className="h-3.5 w-3.5" /> Coverage
                </label>
                <Select
                  value={coverageFilter || "all"}
                  onValueChange={onCoverageFilterChange}
                >
                  <SelectTrigger className="h-10 bg-background border-input">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent>
                    {coverageFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {preparedForOptions && onPreparedForChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1">
                  <FileCheck className="h-3.5 w-3.5" /> Prepared For
                </label>
                <Select
                  value={preparedFor || "all"}
                  onValueChange={onPreparedForChange}
                >
                  <SelectTrigger className="h-10 bg-background border-input">
                    <SelectValue placeholder="All Prepared For" />
                  </SelectTrigger>
                  <SelectContent>
                    {preparedForOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {valuationStatusOptions && onValuationStatusChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Valuation Status
                </label>
                <Select
                  value={valuationStatus || "all"}
                  onValueChange={onValuationStatusChange}
                >
                  <SelectTrigger className="h-10 bg-background border-input">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {valuationStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {valuationMethodOptions && onValuationMethodChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Valuation Method
                </label>
                <Select
                  value={valuationMethod || "all"}
                  onValueChange={onValuationMethodChange}
                >
                  <SelectTrigger className="h-10 bg-background border-input">
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    {valuationMethodOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {purposeOfValuationOptions && onPurposeOfValuationChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Purpose Of Valuation
                </label>
                <Select
                  value={purposeOfValuation || "all"}
                  onValueChange={onPurposeOfValuationChange}
                >
                  <SelectTrigger className="h-10 bg-background border-input">
                    <SelectValue placeholder="All Purposes" />
                  </SelectTrigger>
                  <SelectContent>
                    {purposeOfValuationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="col-span-full lg:col-span-2">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Price Range (USD)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => onMinPriceChange(e.target.value)}
                    className="pl-9 h-10 bg-background border-input"
                  />
                </div>
                <span className="text-muted-foreground font-medium">-</span>
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => onMaxPriceChange(e.target.value)}
                    className="pl-9 h-10 bg-background border-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-border">
              <span className="text-xs font-bold uppercase text-muted-foreground mr-1">
                Active:
              </span>

              {[
                statusFilter && statusFilter !== "All"
                  ? {
                      label: `Status: ${
                        statusOptions.find((s) => s.value === statusFilter)
                          ?.label
                      }`,
                      clear: () => onStatusFilterChange(""),
                    }
                  : null,
                coverageFilter &&
                coverageFilter !== "all" &&
                onCoverageFilterChange
                  ? {
                      label: `Coverage: ${
                        coverageFilterOptions?.find(
                          (option) => option.value === coverageFilter
                        )?.label || coverageFilter
                      }`,
                      clear: () => onCoverageFilterChange("all"),
                    }
                  : null,
                valuationMethod &&
                valuationMethod !== "all" &&
                valuationMethod !== "All" &&
                onValuationMethodChange
                  ? {
                      label: `Method: ${
                        valuationMethodOptions?.find(
                          (method) => method.value === valuationMethod
                        )?.label || valuationMethod
                      }`,
                      clear: () => onValuationMethodChange("all"),
                    }
                  : null,
                valuationStatus &&
                valuationStatus !== "all" &&
                valuationStatus !== "All" &&
                onValuationStatusChange
                  ? {
                      label: `Val. Status: ${
                        valuationStatusOptions?.find(
                          (v) => v.value === valuationStatus
                        )?.label || valuationStatus
                      }`,
                      clear: () => onValuationStatusChange("all"),
                    }
                  : null,
                preparedFor &&
                preparedFor !== "all" &&
                onPreparedForChange
                  ? {
                      label: `Prepared For: ${
                        preparedForOptions?.find(
                          (option) => option.value === preparedFor
                        )?.label || preparedFor
                      }`,
                      clear: () => onPreparedForChange("all"),
                    }
                  : null,
                purposeOfValuation &&
                purposeOfValuation !== "all" &&
                onPurposeOfValuationChange
                  ? {
                      label: `Purpose: ${
                        purposeOfValuationOptions?.find(
                          (option) => option.value === purposeOfValuation
                        )?.label || purposeOfValuation
                      }`,
                      clear: () => onPurposeOfValuationChange("all"),
                    }
                  : null,
                minPrice || maxPrice
                  ? {
                      label: `Price: ${minPrice || 0} - ${maxPrice || ""}`,
                      clear: () => {
                        onMinPriceChange("");
                        onMaxPriceChange("");
                      },
                    }
                  : null,
                hasAddressFilter
                  ? {
                      label: "Location Filter Active",
                      clear: () =>
                        onAddressFilterChange({
                          provinceId: null,
                          districtId: null,
                          communeId: null,
                          villageId: null,
                        }),
                    }
                  : null,
              ]
                .filter(
                  (item): item is { label: string; clear: () => void } =>
                    item !== null
                )
                .map((chip, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="px-2.5 py-1 gap-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                  >
                    {chip.label}
                    <button
                      onClick={chip.clear}
                      className="hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}

              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="ml-auto text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-7"
              >
                Clear All
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
