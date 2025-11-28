import { logger } from '../lib/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

type CacheSegment = 'permissions' | 'config' | 'dashboard' | 'analytics' | 'user' | 'org' | 'general';

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_ENTRIES = 10000;
  private readonly CLEANUP_INTERVAL_MS = 60 * 1000;

  private readonly SEGMENT_TTL: Record<CacheSegment, number> = {
    permissions: 60 * 1000,
    config: 5 * 60 * 1000,
    dashboard: 2 * 60 * 1000,
    analytics: 5 * 60 * 1000,
    user: 2 * 60 * 1000,
    org: 5 * 60 * 1000,
    general: 5 * 60 * 1000,
  };

  constructor() {
    this.startCleanupTask();
  }

  private buildKey(segment: CacheSegment, ...parts: string[]): string {
    return `${segment}:${parts.join(':')}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (this.cache.size >= this.MAX_ENTRIES) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + (ttlMs || this.DEFAULT_TTL_MS),
      createdAt: now,
    });
  }

  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttlMs?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async deletePattern(pattern: string): Promise<number> {
    let count = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      logger.info({ pattern, count }, 'Cache keys invalidated by pattern');
    }
    
    return count;
  }

  async invalidateSegment(segment: CacheSegment): Promise<number> {
    return this.deletePattern(`${segment}:*`);
  }

  async invalidateOrgData(orgId: string): Promise<number> {
    return this.deletePattern(`*:${orgId}:*`);
  }

  async invalidateUserData(userId: string): Promise<number> {
    return this.deletePattern(`*:${userId}:*`);
  }

  getUserPermissionsCacheKey(userId: string, orgId: string): string {
    return this.buildKey('permissions', orgId, userId);
  }

  async cacheUserPermissions(
    userId: string, 
    orgId: string, 
    permissions: any
  ): Promise<void> {
    const key = this.getUserPermissionsCacheKey(userId, orgId);
    await this.set(key, permissions, this.SEGMENT_TTL.permissions);
  }

  async getUserPermissions(userId: string, orgId: string): Promise<any | undefined> {
    const key = this.getUserPermissionsCacheKey(userId, orgId);
    return this.get(key);
  }

  async invalidateUserPermissions(userId: string, orgId: string): Promise<void> {
    const key = this.getUserPermissionsCacheKey(userId, orgId);
    await this.delete(key);
  }

  getProjectConfigCacheKey(projectId: string): string {
    return this.buildKey('config', 'project', projectId);
  }

  async cacheProjectConfig(projectId: string, config: any): Promise<void> {
    const key = this.getProjectConfigCacheKey(projectId);
    await this.set(key, config, this.SEGMENT_TTL.config);
  }

  async getProjectConfig(projectId: string): Promise<any | undefined> {
    const key = this.getProjectConfigCacheKey(projectId);
    return this.get(key);
  }

  async invalidateProjectConfig(projectId: string): Promise<void> {
    const key = this.getProjectConfigCacheKey(projectId);
    await this.delete(key);
  }

  getDashboardDataCacheKey(orgId: string, timeRange: string, modules?: string): string {
    return this.buildKey('dashboard', orgId, timeRange, modules || 'all');
  }

  async cacheDashboardData(
    orgId: string, 
    timeRange: string, 
    data: any, 
    modules?: string
  ): Promise<void> {
    const key = this.getDashboardDataCacheKey(orgId, timeRange, modules);
    await this.set(key, data, this.SEGMENT_TTL.dashboard);
  }

  async getDashboardData(
    orgId: string, 
    timeRange: string, 
    modules?: string
  ): Promise<any | undefined> {
    const key = this.getDashboardDataCacheKey(orgId, timeRange, modules);
    return this.get(key);
  }

  async invalidateDashboardData(orgId: string): Promise<number> {
    return this.deletePattern(`dashboard:${orgId}:*`);
  }

  getAnalyticsCacheKey(type: string, orgId: string, ...params: string[]): string {
    return this.buildKey('analytics', type, orgId, ...params);
  }

  async cacheAnalyticsData(
    type: string,
    orgId: string,
    data: any,
    params: string[] = []
  ): Promise<void> {
    const key = this.getAnalyticsCacheKey(type, orgId, ...params);
    await this.set(key, data, this.SEGMENT_TTL.analytics);
  }

  async getAnalyticsData(
    type: string,
    orgId: string,
    params: string[] = []
  ): Promise<any | undefined> {
    const key = this.getAnalyticsCacheKey(type, orgId, ...params);
    return this.get(key);
  }

  async invalidateAnalyticsData(orgId: string): Promise<number> {
    return this.deletePattern(`analytics:*:${orgId}:*`);
  }

  getVdrPermissionsCacheKey(documentId: string, userId: string): string {
    return this.buildKey('permissions', 'vdr', documentId, userId);
  }

  async cacheVdrPermission(
    documentId: string, 
    userId: string, 
    permission: any
  ): Promise<void> {
    const key = this.getVdrPermissionsCacheKey(documentId, userId);
    await this.set(key, permission, this.SEGMENT_TTL.permissions);
  }

  async getVdrPermission(documentId: string, userId: string): Promise<any | undefined> {
    const key = this.getVdrPermissionsCacheKey(documentId, userId);
    return this.get(key);
  }

  async invalidateVdrPermissions(documentId: string): Promise<number> {
    return this.deletePattern(`permissions:vdr:${documentId}:*`);
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cleaned up expired cache entries');
    }
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.CLEANUP_INTERVAL_MS);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    logger.info('Cache cleared');
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

export const cacheService = new CacheService();
