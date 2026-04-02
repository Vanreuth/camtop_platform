import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import axiosInstance from '@/lib/api';
import type { ResolvedPropertyAddress } from '@/types/propertyAddress.types';

export function useReverseGeocode(
  latitude: number,
  longitude: number,
  enabled: boolean = true
) {
  return useQuery<ResolvedPropertyAddress>({
    queryKey: ['reverseGeocode', latitude, longitude],
    queryFn: async () => {
      const response = await axiosInstance.post('/property-address/resolve', {
        latitude,
        longitude,
      });
      return response.data.data;
    },
    enabled:
      enabled &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

export function useGeocodeAddress(address: {
  provinceId: string;
  districtId: string;
  communeId: string;
  villageId: string;
  street?: string;
  houseNo?: string;
}) {
  return useQuery({
    queryKey: ['geocodeAddress', address],
    queryFn: async () => {
      const response = await axios.post('/api/location/geocode', address);
      return response.data;
    },
    enabled: !!(address.provinceId && address.districtId && address.communeId && address.villageId),
    staleTime: 5 * 60 * 1000,
  });
}
