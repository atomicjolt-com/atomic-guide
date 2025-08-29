export interface LMSContent {
  id: string;
  tenantId: string;
  pageUrl: string;
  pageType: string;
  lmsType: string;
  contentHash: string;
  rawContent: string;
  processedContent: any;
  extractedAt: string;
  versionNumber: number;
}

export interface ContentAnalysis {
  keyConcepts: any[];
  learningObjectives: any[];
  prerequisiteKnowledge: any[];
  assessmentOpportunities: any[];
  readabilityScore?: number;
  estimatedReadingTime?: number;
  contentComplexity?: string;
  topicCategories?: string[];
}

export interface CacheOptions {
  ttl?: number;
  namespace?: string;
}

export class ContentCache {
  private kv: KVNamespace;
  private defaultTTL: number;
  private namespace: string;
  private metrics: Map<string, { hits: number; misses: number }>;

  constructor(kv: KVNamespace, options: CacheOptions = {}) {
    this.kv = kv;
    this.defaultTTL = options.ttl || 300;
    this.namespace = options.namespace || 'content';
    this.metrics = new Map();
  }

  private getCacheKey(type: string, id: string): string {
    return `${this.namespace}:${type}:${id}`;
  }

  private async recordMetric(key: string, hit: boolean): Promise<void> {
    const metric = this.metrics.get(key) || { hits: 0, misses: 0 };
    if (hit) {
      metric.hits++;
    } else {
      metric.misses++;
    }
    this.metrics.set(key, metric);
  }

  async getContent(pageUrl: string, tenantId: string): Promise<LMSContent | null> {
    const startTime = Date.now();
    const key = this.getCacheKey('content', `${tenantId}:${pageUrl}`);
    
    try {
      const cached = await this.kv.get(key, 'json');
      await this.recordMetric('content', cached !== null);
      
      if (cached) {
        console.log(`Cache hit for content: ${pageUrl} (${Date.now() - startTime}ms)`);
        return cached as LMSContent;
      }
      
      console.log(`Cache miss for content: ${pageUrl}`);
      return null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  async setContent(content: LMSContent, ttl?: number): Promise<void> {
    const key = this.getCacheKey('content', `${content.tenantId}:${content.pageUrl}`);
    const effectiveTTL = ttl || this.defaultTTL;
    
    try {
      await this.kv.put(key, JSON.stringify(content), {
        expirationTtl: effectiveTTL
      });
      
      await this.setContentHash(content.contentHash, content.id, effectiveTTL);
      
      console.log(`Cached content: ${content.pageUrl} (TTL: ${effectiveTTL}s)`);
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  async invalidateContent(pageUrl: string, tenantId: string): Promise<void> {
    const key = this.getCacheKey('content', `${tenantId}:${pageUrl}`);
    
    try {
      await this.kv.delete(key);
      
      await this.invalidateAnalysis(`${tenantId}:${pageUrl}`);
      
      console.log(`Invalidated cache for: ${pageUrl}`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  async getAnalysis(contentId: string): Promise<ContentAnalysis | null> {
    const key = this.getCacheKey('analysis', contentId);
    
    try {
      const cached = await this.kv.get(key, 'json');
      await this.recordMetric('analysis', cached !== null);
      
      if (cached) {
        console.log(`Cache hit for analysis: ${contentId}`);
        return cached as ContentAnalysis;
      }
      
      return null;
    } catch (error) {
      console.error('Analysis cache retrieval error:', error);
      return null;
    }
  }

  async setAnalysis(contentId: string, analysis: ContentAnalysis, ttl?: number): Promise<void> {
    const key = this.getCacheKey('analysis', contentId);
    const effectiveTTL = ttl || this.defaultTTL * 2;
    
    try {
      await this.kv.put(key, JSON.stringify(analysis), {
        expirationTtl: effectiveTTL
      });
      
      console.log(`Cached analysis: ${contentId} (TTL: ${effectiveTTL}s)`);
    } catch (error) {
      console.error('Analysis cache storage error:', error);
    }
  }

  async invalidateAnalysis(contentId: string): Promise<void> {
    const key = this.getCacheKey('analysis', contentId);
    
    try {
      await this.kv.delete(key);
      console.log(`Invalidated analysis cache: ${contentId}`);
    } catch (error) {
      console.error('Analysis cache invalidation error:', error);
    }
  }

  private async setContentHash(hash: string, contentId: string, ttl: number): Promise<void> {
    const key = this.getCacheKey('hash', hash);
    
    try {
      await this.kv.put(key, contentId, {
        expirationTtl: ttl
      });
    } catch (error) {
      console.error('Hash cache storage error:', error);
    }
  }

  async getContentByHash(hash: string): Promise<string | null> {
    const key = this.getCacheKey('hash', hash);
    
    try {
      const contentId = await this.kv.get(key);
      await this.recordMetric('hash', contentId !== null);
      return contentId;
    } catch (error) {
      console.error('Hash cache retrieval error:', error);
      return null;
    }
  }

  async warmCache(tenantId: string, pageUrls: string[]): Promise<void> {
    console.log(`Warming cache for ${pageUrls.length} pages`);
    
    const promises = pageUrls.map(async(pageUrl) => {
      const content = await this.getContent(pageUrl, tenantId);
      if (!content) {
        console.log(`No cached content for warm-up: ${pageUrl}`);
      }
    });
    
    await Promise.all(promises);
  }

  async invalidateByTenant(tenantId: string): Promise<void> {
    console.log(`Invalidating all cache entries for tenant: ${tenantId}`);
    
    const prefix = `${this.namespace}:content:${tenantId}:`;
    const keys = await this.kv.list({ prefix });
    
    const deletePromises = keys.keys.map(key => this.kv.delete(key.name));
    await Promise.all(deletePromises);
    
    console.log(`Invalidated ${keys.keys.length} cache entries`);
  }

  async invalidateOldContent(maxAgeSeconds: number = 86400): Promise<void> {
    console.log(`Invalidating content older than ${maxAgeSeconds} seconds`);
    
    const cutoffTime = Date.now() - (maxAgeSeconds * 1000);
    const keys = await this.kv.list({ prefix: `${this.namespace}:` });
    
    let invalidatedCount = 0;
    for (const key of keys.keys) {
      const metadata = key.metadata as any;
      if (metadata?.timestamp && metadata.timestamp < cutoffTime) {
        await this.kv.delete(key.name);
        invalidatedCount++;
      }
    }
    
    console.log(`Invalidated ${invalidatedCount} old cache entries`);
  }

  getMetrics(): { key: string; hits: number; misses: number; hitRate: number }[] {
    const results: { key: string; hits: number; misses: number; hitRate: number }[] = [];
    
    for (const [key, metric] of this.metrics.entries()) {
      const total = metric.hits + metric.misses;
      const hitRate = total > 0 ? metric.hits / total : 0;
      
      results.push({
        key,
        hits: metric.hits,
        misses: metric.misses,
        hitRate: Math.round(hitRate * 100) / 100
      });
    }
    
    return results.sort((a, b) => b.hitRate - a.hitRate);
  }

  resetMetrics(): void {
    this.metrics.clear();
    console.log('Cache metrics reset');
  }

  async getCacheSize(): Promise<{ keys: number; estimatedBytes: number }> {
    const keys = await this.kv.list({ prefix: `${this.namespace}:` });
    
    let estimatedBytes = 0;
    for (const key of keys.keys) {
      const metadata = key.metadata as any;
      if (metadata?.size) {
        estimatedBytes += metadata.size;
      } else {
        estimatedBytes += key.name.length * 2 + 1024;
      }
    }
    
    return {
      keys: keys.keys.length,
      estimatedBytes
    };
  }
}

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;

  constructor(threshold: number = 5, timeout: number = 60000, resetTimeout: number = 30000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFail = Date.now() - this.lastFailTime;
      
      if (timeSinceLastFail > this.timeout) {
        this.state = 'half-open';
        console.log('Circuit breaker: Half-open, trying request');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
        console.log('Circuit breaker: Closed, service recovered');
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
        console.log(`Circuit breaker: Open after ${this.failures} failures`);
      }
      
      throw error;
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailTime = 0;
    console.log('Circuit breaker: Manually reset');
  }
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly delayMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000, delayMs: number = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.delayMs = delayMs;
  }

  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    const recentRequests = requests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    return true;
  }

  async throttle<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const canProceed = await this.checkLimit(key);
    
    if (!canProceed) {
      console.log(`Rate limit exceeded for: ${key}`);
      await this.delay(this.delayMs);
      return this.throttle(key, fn);
    }
    
    return fn();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - recentRequests.length);
  }

  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}

export class ContentCacheManager {
  private cache: ContentCache;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  constructor(kv: KVNamespace, options: CacheOptions = {}) {
    this.cache = new ContentCache(kv, options);
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.rateLimiter = new RateLimiter(100, 60000);
  }

  async getContentWithFallback(
    pageUrl: string,
    tenantId: string,
    fetchFn: () => Promise<LMSContent>
  ): Promise<LMSContent> {
    const cached = await this.cache.getContent(pageUrl, tenantId);
    if (cached) {
      return cached;
    }

    return this.circuitBreaker.execute(async() => {
      return this.rateLimiter.throttle(tenantId, async() => {
        const content = await fetchFn();
        await this.cache.setContent(content);
        return content;
      });
    });
  }

  async invalidateAndRefresh(
    pageUrl: string,
    tenantId: string,
    fetchFn: () => Promise<LMSContent>
  ): Promise<LMSContent> {
    await this.cache.invalidateContent(pageUrl, tenantId);
    
    const newContent = await fetchFn();
    await this.cache.setContent(newContent);
    
    return newContent;
  }

  async preloadFrequentContent(tenantId: string, db: any): Promise<void> {
    const frequentContent = await db.prepare(
      `SELECT DISTINCT page_url
       FROM content_engagement
       WHERE tenant_id = ?
       GROUP BY page_url
       ORDER BY COUNT(*) DESC
       LIMIT 20`
    ).bind(tenantId).all();

    const urls = frequentContent.results.map((r: any) => r.page_url);
    await this.cache.warmCache(tenantId, urls);
  }

  getCache(): ContentCache {
    return this.cache;
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }
}