import React, { useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProvinces,
  useDistrictsByProvinceCode,
  useCommunesByDistrictCode,
  useVillagesByCommuneCode,
} from "@/hooks/usePropertyAddress";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2, MapPin, ChevronRight } from "lucide-react";
import { useAddressLocale } from "@/hooks/useAddressLocale";
import type { ResolvedAddressHierarchyItems } from "@/types/propertyAddress.types";

type AddressValue = {
  provinceId: string | null;
  districtId: string | null;
  communeId: string | null;
  villageId: string | null;
};

interface PropertyAddressFormProps {
  value: AddressValue;
  resolvedAddressItems?: ResolvedAddressHierarchyItems;
  onAddressChange?: (address: AddressValue) => void;
}

export const PropertyAddressForm: React.FC<PropertyAddressFormProps> = ({
  value,
  resolvedAddressItems,
  onAddressChange,
}) => {
  const t = useTranslations("properties");
  const addressLocale = useAddressLocale();

  const normalizeSelectedCode = (code: string | null | undefined): string | null => {
    const trimmed = code?.trim();
    return trimmed ? trimmed : null;
  };

  const selectedProvinceId =
    normalizeSelectedCode(value.provinceId) ??
    normalizeSelectedCode(resolvedAddressItems?.province?.code) ??
    null;
  const selectedDistrictId =
    normalizeSelectedCode(value.districtId) ??
    normalizeSelectedCode(resolvedAddressItems?.district?.code) ??
    null;
  const selectedCommuneId =
    normalizeSelectedCode(value.communeId) ??
    normalizeSelectedCode(resolvedAddressItems?.commune?.code) ??
    null;
  const selectedVillageId =
    normalizeSelectedCode(value.villageId) ??
    normalizeSelectedCode(resolvedAddressItems?.village?.code) ??
    null;

  const { data: provinces, isLoading: isLoadingProvinces } = useProvinces();
  const { data: districts, isLoading: isLoadingDistricts } =
    useDistrictsByProvinceCode(selectedProvinceId);
  const { data: communes, isLoading: isLoadingCommunes } =
    useCommunesByDistrictCode(selectedDistrictId);
  const { data: villages, isLoading: isLoadingVillages } =
    useVillagesByCommuneCode(selectedCommuneId);

  const selectedCommune = useMemo(() => {
    return communes?.find((item) => item.code === selectedCommuneId) ?? null;
  }, [communes, selectedCommuneId]);

  const selectedVillage = useMemo(() => {
    return villages?.find((item) => item.code === selectedVillageId) ?? null;
  }, [villages, selectedVillageId]);

  const selectedProvince = useMemo(() => {
    return provinces?.find((item) => item.code === selectedProvinceId) ?? null;
  }, [provinces, selectedProvinceId]);

  const selectedDistrict = useMemo(() => {
    return districts?.find((item) => item.code === selectedDistrictId) ?? null;
  }, [districts, selectedDistrictId]);

  const selectedProvinceLabel = useMemo(() => {
    if (!selectedProvinceId) return null;
    if (selectedProvince) return addressLocale.province(selectedProvince);
    if (resolvedAddressItems?.province?.code === selectedProvinceId) {
      return addressLocale.province(resolvedAddressItems.province);
    }
    return selectedProvinceId;
  }, [addressLocale, resolvedAddressItems, selectedProvince, selectedProvinceId]);

  const selectedDistrictLabel = useMemo(() => {
    if (!selectedDistrictId) return null;
    if (selectedDistrict) return addressLocale.district(selectedDistrict);
    if (resolvedAddressItems?.district?.code === selectedDistrictId) {
      return addressLocale.district(resolvedAddressItems.district);
    }
    return selectedDistrictId;
  }, [addressLocale, resolvedAddressItems, selectedDistrict, selectedDistrictId]);

  const selectedCommuneLabel = useMemo(() => {
    if (!selectedCommuneId) return null;
    if (selectedCommune) return addressLocale.commune(selectedCommune);
    if (resolvedAddressItems?.commune?.code === selectedCommuneId) {
      return addressLocale.commune(resolvedAddressItems.commune);
    }
    return selectedCommuneId;
  }, [addressLocale, resolvedAddressItems, selectedCommune, selectedCommuneId]);

  const selectedVillageLabel = useMemo(() => {
    if (!selectedVillageId) return null;
    if (selectedVillage) return addressLocale.village(selectedVillage);
    if (resolvedAddressItems?.village?.code === selectedVillageId) {
      return addressLocale.village(resolvedAddressItems.village);
    }
    return selectedVillageId;
  }, [addressLocale, resolvedAddressItems, selectedVillage, selectedVillageId]);

  // ✅ Check if villages exist for the selected commune
  const hasVillages = useMemo(() => {
    return villages && villages.length > 0;
  }, [villages]);

  const emit = useCallback(
    (next: AddressValue) => {
      // prevent needless parent updates (helps avoid loops)
      if (
        next.provinceId === value.provinceId &&
        next.districtId === value.districtId &&
        next.communeId === value.communeId &&
        next.villageId === value.villageId
      ) {
        return;
      }
      onAddressChange?.(next);
    },
    [onAddressChange, value.provinceId, value.districtId, value.communeId, value.villageId]
  );

  // ✅ OPTIMIZATION: Memoize change handlers to prevent recreation
  const handleProvinceChange = useCallback(
    (provinceId: string) => {
      emit({ provinceId, districtId: null, communeId: null, villageId: null });
    },
    [emit]
  );

  const handleDistrictChange = useCallback(
    (districtId: string) => {
      emit({
        provinceId: selectedProvinceId,
        districtId,
        communeId: null,
        villageId: null,
      });
    },
    [emit, selectedProvinceId]
  );

  const handleCommuneChange = useCallback(
    (communeId: string) => {
      emit({
        provinceId: selectedProvinceId,
        districtId: selectedDistrictId,
        communeId,
        villageId: null,
      });
    },
    [emit, selectedProvinceId, selectedDistrictId]
  );

  const handleVillageChange = useCallback(
    (villageId: string) => {
      emit({
        provinceId: selectedProvinceId,
        districtId: selectedDistrictId,
        communeId: selectedCommuneId,
        villageId,
      });
    },
    [emit, selectedProvinceId, selectedDistrictId, selectedCommuneId]
  );

  // ✅ IMPROVED: Better placeholder logic
  const districtPlaceholder = useMemo(() => {
    if (!selectedProvinceId) return "Select province first";
    if (isLoadingDistricts) return "Loading...";
    return "Select District";
  }, [selectedProvinceId, isLoadingDistricts]);

  const communePlaceholder = useMemo(() => {
    if (!selectedDistrictId) return "Select district first";
    if (isLoadingCommunes) return "Loading...";
    return "Select Commune";
  }, [selectedDistrictId, isLoadingCommunes]);

  const villagePlaceholder = useMemo(() => {
    if (!selectedCommuneId) return "Select commune first";
    if (isLoadingVillages) return "Loading...";
    if (!hasVillages) return "No villages available";
    return "Select Village";
  }, [selectedCommuneId, isLoadingVillages, hasVillages]);

  const progressCount = useMemo(() => {
    const baseCount = [selectedProvinceId, selectedDistrictId, selectedCommuneId].filter(Boolean).length;
    
    // Only count village if it's selected OR if there are no villages available
    if (selectedVillageId || (!isLoadingVillages && !hasVillages && selectedCommuneId)) {
      return baseCount + 1;
    }
    
    return baseCount;
  }, [selectedProvinceId, selectedDistrictId, selectedCommuneId, selectedVillageId, isLoadingVillages, hasVillages]);

  // ✅ IMPROVED: Progress items should show completion for villages when none exist
  const progressItems = useMemo(() => {
    return [
      selectedProvinceId,
      selectedDistrictId,
      selectedCommuneId,
      selectedVillageId || (!isLoadingVillages && !hasVillages && selectedCommuneId ? "n/a" : null)
    ];
  }, [selectedProvinceId, selectedDistrictId, selectedCommuneId, selectedVillageId, isLoadingVillages, hasVillages]);

  // ✅ NEW: Determine if village field should be disabled
  const isVillageDisabled = useMemo(() => {
    if (!selectedCommuneId) return true;
    if (isLoadingVillages) return true;
    if (!hasVillages) return true; // Disable if no villages exist
    return false;
  }, [selectedCommuneId, isLoadingVillages, hasVillages]);

  return (
    <div className="space-y-4">
      {/* Progress Indicator */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
        <MapPin className="h-5 w-5 text-blue-600" />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900">Address Information</h3>
          <div className="flex items-center gap-1 mt-1">
            {progressItems.map((item, index) => (
              <React.Fragment key={index}>
                <div
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    item ? "bg-gradient-to-r from-blue-500 to-blue-600" : "bg-gray-200"
                  }`}
                />
                {index < 3 && <ChevronRight className="h-3 w-3 text-gray-400" />}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="text-xs font-semibold text-gray-600">
          {progressCount}/4
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Province */}
        <div className="space-y-2">
          <Label htmlFor="province" className="flex items-center gap-2">
            {t("province")} <span className="text-red-500">*</span>
            {selectedProvinceId && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
          </Label>
          <Select
            value={selectedProvinceId ?? ""}
            onValueChange={handleProvinceChange}
            disabled={isLoadingProvinces}
          >
            <SelectTrigger id="province">
              {isLoadingProvinces ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span>Loading...</span>
                </div>
              ) : selectedProvinceLabel ? (
                <span className="truncate">{selectedProvinceLabel}</span>
              ) : (
                <SelectValue placeholder="Select Province" />
              )}
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {provinces?.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {addressLocale.province(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* District */}
        <div className="space-y-2">
          <Label htmlFor="district" className="flex items-center gap-2">
            {t("district")} <span className="text-red-500">*</span>
            {selectedDistrictId && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
          </Label>
          <Select
            value={selectedDistrictId ?? ""}
            onValueChange={handleDistrictChange}
            disabled={!selectedProvinceId || isLoadingDistricts}
          >
            <SelectTrigger id="district">
              {isLoadingDistricts ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
                  <span>Loading...</span>
                </div>
              ) : selectedDistrictLabel ? (
                <span className="truncate">{selectedDistrictLabel}</span>
              ) : (
                <SelectValue placeholder={districtPlaceholder} />
              )}
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {districts?.map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {addressLocale.district(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Commune */}
        <div className="space-y-2">
          <Label htmlFor="commune" className="flex items-center gap-2">
            {t("commune")} <span className="text-red-500">*</span>
            {selectedCommuneId && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
          </Label>
          <Select
            value={selectedCommuneId ?? ""}
            onValueChange={handleCommuneChange}
            disabled={!selectedDistrictId || isLoadingCommunes}
          >
            <SelectTrigger id="commune">
              {isLoadingCommunes ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <span>Loading...</span>
                </div>
              ) : selectedCommuneLabel ? (
                <span className="truncate">{selectedCommuneLabel}</span>
              ) : (
                <SelectValue placeholder={communePlaceholder} />
              )}
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {communes?.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {addressLocale.commune(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Village */}
        <div className="space-y-2">
          <Label htmlFor="village" className="flex items-center gap-2">
            {t("village")} {hasVillages && <span className="text-red-500">*</span>}
            {(selectedVillageId || (!hasVillages && selectedCommuneId && !isLoadingVillages)) && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            )}
          </Label>
          <Select
            value={selectedVillageId ?? ""}
            onValueChange={handleVillageChange}
            disabled={isVillageDisabled}
          >
            <SelectTrigger id="village">
              {isLoadingVillages ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                  <span>Loading...</span>
                </div>
              ) : selectedVillageLabel ? (
                <span className="truncate">{selectedVillageLabel}</span>
              ) : (
                <SelectValue placeholder={villagePlaceholder} />
              )}
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {villages?.map((v) => (
                <SelectItem key={v.code} value={v.code}>
                  {addressLocale.village(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!hasVillages && selectedCommuneId && !isLoadingVillages && (
            <p className="text-xs text-gray-500 italic">No villages in this commune</p>
          )}
        </div>
      </div>
    </div>
  );
};
