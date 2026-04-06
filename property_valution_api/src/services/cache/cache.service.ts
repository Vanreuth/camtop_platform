import config from "../../config";
import { logger } from "../../config/logger";
import { RedisClient } from "./redisClient";

type CacheHitResult<T> =
  | { hit: true; value: T }
  | { hit: false; value: undefined };

const redisClient = config.redis.url
  ? new RedisClient({
      url: config.redis.url,
      connectTimeoutMs: config.redis.connectTimeoutMs,
    })
  : null;

class CacheService {
  private readonly client = redisClient;

  private readonly enabled = Boolean(redisClient);

  private lastWarningAt = 0;

  private logWarning(message: string, error?: unknown) {
    const now = Date.now();
    if (now - this.lastWarningAt < 60_000) return;
    this.lastWarningAt = now;
    logger.warn({ err: error }, message);
  }

  async getJson<T>(key: string): Promise<CacheHitResult<T>> {
    if (!this.enabled || !this.client) {
      return { hit: false, value: undefined };
    }

    try {
      const cached = await this.client.get(key);
      if (cached == null) {
        return { hit: false, value: undefined };
      }

      return {
        hit: true,
        value: JSON.parse(cached) as T,
      };
    } catch (error) {
      this.logWarning(`Cache read failed for key "${key}"`, error);
      return { hit: false, value: undefined };
    }
  }

  async getNumber(key: string): Promise<number | null> {
    if (!this.enabled || !this.client) return null;

    try {
      const cached = await this.client.get(key);
      if (cached == null) return null;

      const parsed = Number(cached);
      return Number.isFinite(parsed) ? parsed : null;
    } catch (error) {
      this.logWarning(`Cache numeric read failed for key "${key}"`, error);
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number) {
    if (!this.enabled || !this.client || value === undefined) return;

    try {
      await this.client.set(key, JSON.stringify(value), ttlSeconds);
    } catch (error) {
      this.logWarning(`Cache write failed for key "${key}"`, error);
    }
  }

  async delete(key: string) {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.del(key);
    } catch (error) {
      this.logWarning(`Cache delete failed for key "${key}"`, error);
    }
  }

  async deleteMany(keys: string[]) {
    if (!keys.length || !this.enabled || !this.client) return;

    try {
      await this.client.del(...keys);
    } catch (error) {
      this.logWarning("Cache deleteMany failed", error);
    }
  }

  async increment(key: string): Promise<number | null> {
    if (!this.enabled || !this.client) return null;

    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logWarning(`Cache increment failed for key "${key}"`, error);
      return null;
    }
  }

  async getOrSetJson<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached.hit) {
      return cached.value;
    }

    const value = await loader();
    await this.setJson(key, value, ttlSeconds);
    return value;
  }

  async disconnect() {
    if (!this.client) return;
    await this.client.disconnect();
  }
}

export const cacheService = new CacheService();
