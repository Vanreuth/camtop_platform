import { cacheKeys } from "./cacheKeys";
import { cacheService } from "./cache.service";

export const invalidatePropertyStatisticsCache = async () => {
  await cacheService.increment(cacheKeys.property.statisticsVersion);
};
