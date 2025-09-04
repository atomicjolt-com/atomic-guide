# Scaling Guide

This document provides comprehensive guidance on scaling Atomic Guide to handle increased load, user growth, and feature expansion.

## Scaling Overview

### Cloudflare Workers Scaling Model

Cloudflare Workers provide automatic scaling with several key characteristics:

- **Automatic Scaling**: Workers automatically scale up/down based on demand
- **Global Distribution**: Code runs at 200+ edge locations worldwide
- **Zero Cold Starts**: V8 isolates provide near-instantaneous startup
- **Request-based Pricing**: Pay only for actual requests processed
- **No Infrastructure Management**: Serverless architecture eliminates server management

### Current Scale Limits

| Component        | Current Limit              | Notes                              |
| ---------------- | -------------------------- | ---------------------------------- |
| Worker CPU Time  | 30 seconds                 | Can request increase to 15 minutes |
| Worker Memory    | 128 MB                     | Fixed limit per request            |
| D1 Database Size | 10 GB                      | Can request increases              |
| R2 Storage       | Unlimited                  | Pay-as-you-go pricing              |
| KV Operations    | 1000/second                | Per namespace                      |
| Queue Throughput | 400 messages/second        | Per queue                          |
| Durable Object   | 1000 concurrent WebSockets | Per object                         |

## Horizontal Scaling Strategies

### 1. Database Scaling

#### Read Replicas Strategy

```typescript
// Multi-region database access
export class ScalableDatabaseService {
  private primaryDB: D1Database;
  private readReplicas: Map<string, D1Database>;

  constructor(env: Env) {
    this.primaryDB = env.DB;
    this.readReplicas = new Map([
      ['us-east', env.DB_REPLICA_US_EAST],
      ['eu-west', env.DB_REPLICA_EU_WEST],
      ['ap-southeast', env.DB_REPLICA_AP_SOUTHEAST],
    ]);
  }

  async read(query: string, params?: any[]): Promise<any> {
    const region = this.getOptimalRegion();
    const db = this.readReplicas.get(region) || this.primaryDB;

    try {
      return await db
        .prepare(query)
        .bind(...(params || []))
        .first();
    } catch (error) {
      // Fallback to primary if replica fails
      return await this.primaryDB
        .prepare(query)
        .bind(...(params || []))
        .first();
    }
  }

  async write(query: string, params?: any[]): Promise<any> {
    // All writes go to primary
    return await this.primaryDB
      .prepare(query)
      .bind(...(params || []))
      .run();
  }

  private getOptimalRegion(): string {
    // Use Cloudflare's geo-location data
    const country = globalThis.request?.cf?.country;
    const colo = globalThis.request?.cf?.colo;

    // Route to closest replica based on geography
    if (['US', 'CA', 'MX'].includes(country)) return 'us-east';
    if (['GB', 'FR', 'DE', 'IT', 'ES'].includes(country)) return 'eu-west';
    if (['JP', 'SG', 'AU', 'IN'].includes(country)) return 'ap-southeast';

    return 'us-east'; // Default
  }
}
```

#### Database Sharding

```typescript
// Horizontal database partitioning
export class ShardedDatabaseService {
  private shards: Map<string, D1Database>;

  constructor(env: Env) {
    this.shards = new Map([
      ['shard_0', env.DB_SHARD_0],
      ['shard_1', env.DB_SHARD_1],
      ['shard_2', env.DB_SHARD_2],
      ['shard_3', env.DB_SHARD_3],
    ]);
  }

  private getShardKey(contextId: string): string {
    // Consistent hashing based on context ID
    const hash = this.hashString(contextId);
    const shardIndex = hash % this.shards.size;
    return `shard_${shardIndex}`;
  }

  async getUserData(userId: string, contextId: string): Promise<any> {
    const shardKey = this.getShardKey(contextId);
    const db = this.shards.get(shardKey)!;

    return await db
      .prepare(
        `
      SELECT * FROM users 
      WHERE user_id = ? AND context_id = ?
    `
      )
      .bind(userId, contextId)
      .first();
  }

  async insertUserData(userData: UserData): Promise<void> {
    const shardKey = this.getShardKey(userData.contextId);
    const db = this.shards.get(shardKey)!;

    await db
      .prepare(
        `
      INSERT INTO users (user_id, context_id, name, email, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .bind(userData.userId, userData.contextId, userData.name, userData.email, new Date().toISOString())
      .run();
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
```

### 2. Queue Scaling

#### Multiple Queue Strategy

```typescript
// Distribute load across multiple queues
export class ScalableQueueService {
  private queues: {
    video_processing: Queue[];
    analytics: Queue[];
    notifications: Queue[];
  };

  constructor(env: Env) {
    this.queues = {
      video_processing: [env.VIDEO_QUEUE_1, env.VIDEO_QUEUE_2, env.VIDEO_QUEUE_3],
      analytics: [env.ANALYTICS_QUEUE_1, env.ANALYTICS_QUEUE_2],
      notifications: [env.NOTIFICATIONS_QUEUE_1],
    };
  }

  async enqueueVideoProcessing(job: VideoProcessingJob): Promise<void> {
    const queueIndex = this.getOptimalQueue('video_processing', job);
    const queue = this.queues.video_processing[queueIndex];

    await queue.send(job, {
      delaySeconds: job.priority === 'high' ? 0 : 60,
    });
  }

  private getOptimalQueue(type: keyof typeof this.queues, job: any): number {
    const queues = this.queues[type];

    // Round-robin for simplicity
    // In production, consider queue length, processing time, etc.
    return Math.floor(Math.random() * queues.length);
  }
}
```

#### Priority Queue Implementation

```typescript
// Priority-based job processing
export class PriorityQueueProcessor {
  async processVideoJobs(batch: MessageBatch<VideoJob>): Promise<void> {
    // Sort messages by priority
    const sortedMessages = batch.messages.sort((a, b) => {
      const priorityA = this.getPriorityScore(a.body);
      const priorityB = this.getPriorityScore(b.body);
      return priorityB - priorityA; // Higher priority first
    });

    // Process high-priority jobs first
    for (const message of sortedMessages) {
      try {
        await this.processVideoJob(message.body);
        message.ack();
      } catch (error) {
        console.error('Video processing failed:', error);
        if (message.attempts < 3) {
          message.retry({ delaySeconds: Math.pow(2, message.attempts) * 60 });
        } else {
          message.ack(); // Give up after 3 attempts
        }
      }
    }
  }

  private getPriorityScore(job: VideoJob): number {
    let score = 0;

    // Higher priority for shorter videos (process quickly)
    if (job.duration < 300) score += 10; // 5 minutes

    // Higher priority for instructor uploads
    if (job.userRole === 'instructor') score += 5;

    // Higher priority for live sessions
    if (job.isLiveSession) score += 15;

    return score;
  }
}
```

### 3. Durable Object Scaling

#### Multiple Durable Object Instances

```typescript
// Distribute WebSocket connections across multiple Durable Objects
export class ScalableChatService {
  private getObjectId(contextId: string): DurableObjectId {
    // Consistent hashing to distribute load
    const hash = this.hashString(contextId);
    const suffix = hash % 10; // 10 instances per context type

    return this.env.CHAT_ROOM.idFromName(`chat:${contextId}:${suffix}`);
  }

  async connectToChat(contextId: string, userId: string): Promise<Response> {
    const objectId = this.getObjectId(contextId);
    const obj = this.env.CHAT_ROOM.get(objectId);

    return await obj.fetch(`https://chat/connect?userId=${userId}&contextId=${contextId}`);
  }

  async broadcastMessage(contextId: string, message: ChatMessage): Promise<void> {
    // Fan-out to all instances for this context
    const promises = [];

    for (let i = 0; i < 10; i++) {
      const objectId = this.env.CHAT_ROOM.idFromName(`chat:${contextId}:${i}`);
      const obj = this.env.CHAT_ROOM.get(objectId);

      promises.push(
        obj.fetch('https://chat/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        })
      );
    }

    await Promise.all(promises);
  }
}
```

#### Durable Object with Connection Limits

```typescript
export class ScalableChatRoomDurableObject implements DurableObject {
  private connections = new Map<WebSocket, UserSession>();
  private readonly MAX_CONNECTIONS = 1000;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/connect') {
      return this.handleWebSocketConnection(request);
    } else if (url.pathname === '/broadcast') {
      return this.handleBroadcast(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocketConnection(request: Request): Promise<Response> {
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      return new Response('Room full', { status: 503 });
    }

    const { 0: client, 1: server } = new WebSocketPair();

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const contextId = url.searchParams.get('contextId');

    server.accept();

    this.connections.set(server, {
      userId: userId!,
      contextId: contextId!,
      connectedAt: Date.now(),
    });

    server.addEventListener('close', () => {
      this.connections.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const message = await request.json();
    const data = JSON.stringify(message);

    for (const [ws, session] of this.connections.entries()) {
      if (ws.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          ws.send(data);
        } catch (error) {
          console.error('Failed to send message:', error);
          this.connections.delete(ws);
        }
      }
    }

    return new Response('OK');
  }
}
```

## Vertical Scaling Optimizations

### 1. Performance Optimizations

#### Caching Strategy

```typescript
// Multi-layer caching for performance
export class ScalableCacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MEMORY_CACHE_SIZE = 1000;
  private readonly MEMORY_CACHE_TTL = 300_000; // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    // Layer 1: Memory cache (fastest)
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      return memoryEntry.value;
    }

    // Layer 2: KV cache (fast)
    const kvValue = await this.env.CACHE_KV.get(key);
    if (kvValue) {
      const parsed = JSON.parse(kvValue);

      // Update memory cache
      this.setMemoryCache(key, parsed);

      return parsed;
    }

    // Layer 3: Database (slower)
    const dbValue = await this.fetchFromDatabase(key);
    if (dbValue) {
      // Cache in both layers
      await this.env.CACHE_KV.put(key, JSON.stringify(dbValue), {
        expirationTtl: 3600, // 1 hour
      });
      this.setMemoryCache(key, dbValue);

      return dbValue;
    }

    return null;
  }

  private setMemoryCache(key: string, value: any): void {
    // Implement LRU eviction
    if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + this.MEMORY_CACHE_TTL,
    });
  }
}
```

#### Database Query Optimization

```typescript
// Optimized database queries for scale
export class OptimizedDatabaseService {
  // Batch operations to reduce round trips
  async getUsersBatch(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];

    // Use IN clause with proper parameterization
    const placeholders = userIds.map(() => '?').join(',');
    const query = `SELECT * FROM users WHERE user_id IN (${placeholders})`;

    const result = await this.db
      .prepare(query)
      .bind(...userIds)
      .all();
    return result.results as User[];
  }

  // Use prepared statements for repeated queries
  private getUserStmt = this.db.prepare('SELECT * FROM users WHERE user_id = ?');
  private insertMessageStmt = this.db.prepare(`
    INSERT INTO messages (id, user_id, context_id, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  async getUser(userId: string): Promise<User | null> {
    return (await this.getUserStmt.bind(userId).first()) as User | null;
  }

  // Batch inserts for better performance
  async insertMessagesBatch(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    const batch = this.db.batch(
      messages.map((msg) => this.insertMessageStmt.bind(msg.id, msg.userId, msg.contextId, msg.content, msg.createdAt))
    );

    await batch;
  }
}
```

### 2. Memory Optimization

#### Efficient Data Structures

```typescript
// Memory-efficient implementations
export class MemoryOptimizedService {
  // Use TypedArrays for large datasets
  private userScores = new Float32Array(10000); // Pre-allocated
  private userIds = new Map<string, number>(); // ID to index mapping

  setUserScore(userId: string, score: number): void {
    let index = this.userIds.get(userId);

    if (index === undefined) {
      index = this.userIds.size;
      this.userIds.set(userId, index);
    }

    this.userScores[index] = score;
  }

  getUserScore(userId: string): number | null {
    const index = this.userIds.get(userId);
    return index !== undefined ? this.userScores[index] : null;
  }

  // Streaming processing for large datasets
  async processLargeDataset(dataStream: ReadableStream<DataItem>): Promise<void> {
    const reader = dataStream.getReader();
    let batch: DataItem[] = [];
    const BATCH_SIZE = 100;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (batch.length > 0) {
            await this.processBatch(batch);
          }
          break;
        }

        batch.push(value);

        if (batch.length >= BATCH_SIZE) {
          await this.processBatch(batch);
          batch = []; // Clear batch to free memory
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

## Auto-scaling Implementation

### 1. Demand-Based Scaling

```typescript
// Monitor and adjust resources based on demand
export class AutoScaler {
  private metrics = new Map<string, MetricHistory>();

  async checkScalingNeeds(): Promise<ScalingDecision[]> {
    const decisions: ScalingDecision[] = [];

    // Check database load
    const dbMetrics = await this.getDBMetrics();
    if (dbMetrics.avgQueryTime > 1000) {
      // > 1 second
      decisions.push({
        component: 'database',
        action: 'add_read_replica',
        reason: 'High query latency detected',
        urgency: 'high',
      });
    }

    // Check queue backlog
    const queueMetrics = await this.getQueueMetrics();
    if (queueMetrics.backlogSize > 10000) {
      decisions.push({
        component: 'video_queue',
        action: 'add_consumer',
        reason: 'Queue backlog exceeds threshold',
        urgency: 'medium',
      });
    }

    // Check WebSocket connections
    const wsMetrics = await this.getWebSocketMetrics();
    if (wsMetrics.connectionsPerObject > 800) {
      // Near limit of 1000
      decisions.push({
        component: 'chat_durable_objects',
        action: 'increase_sharding',
        reason: 'WebSocket connections approaching limit',
        urgency: 'high',
      });
    }

    return decisions;
  }

  async implementScalingDecision(decision: ScalingDecision): Promise<void> {
    switch (decision.action) {
      case 'add_read_replica':
        await this.addDatabaseReplica();
        break;

      case 'add_consumer':
        await this.addQueueConsumer(decision.component);
        break;

      case 'increase_sharding':
        await this.increaseSharding(decision.component);
        break;
    }
  }
}
```

### 2. Predictive Scaling

```typescript
// Predict future load based on patterns
export class PredictiveScaler {
  async analyzeUsagePatterns(): Promise<ScalingPrediction[]> {
    const predictions: ScalingPrediction[] = [];

    // Analyze historical data
    const historicalData = await this.getHistoricalMetrics(30); // 30 days

    // Detect weekly patterns
    const weeklyPattern = this.detectWeeklyPattern(historicalData);

    // Predict next week's peak
    const nextWeekPeak = this.predictNextWeekPeak(weeklyPattern);

    if (nextWeekPeak.expectedLoad > this.currentCapacity * 0.8) {
      predictions.push({
        timeframe: nextWeekPeak.timeframe,
        expectedLoad: nextWeekPeak.expectedLoad,
        recommendedAction: 'pre_scale_resources',
        confidence: nextWeekPeak.confidence,
      });
    }

    return predictions;
  }

  private detectWeeklyPattern(data: MetricDataPoint[]): WeeklyPattern {
    // Group data by day of week and hour
    const pattern = new Map<string, number[]>();

    for (const point of data) {
      const date = new Date(point.timestamp);
      const key = `${date.getDay()}-${date.getHours()}`; // day-hour

      if (!pattern.has(key)) {
        pattern.set(key, []);
      }
      pattern.get(key)!.push(point.value);
    }

    // Calculate averages for each time slot
    const avgPattern = new Map<string, number>();
    for (const [key, values] of pattern.entries()) {
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      avgPattern.set(key, avg);
    }

    return {
      pattern: avgPattern,
      reliability: this.calculatePatternReliability(pattern),
    };
  }
}
```

## Global Distribution Strategy

### 1. Region-Specific Deployment

```typescript
// Deploy workers optimally based on user distribution
export class GlobalDistributionService {
  private regionConfigs = new Map([
    [
      'us-east',
      {
        primaryDB: 'us-east-db',
        cacheNodes: ['us-east-1', 'us-east-2'],
        specialized: ['video-processing'],
      },
    ],
    [
      'eu-west',
      {
        primaryDB: 'eu-west-db',
        cacheNodes: ['eu-west-1'],
        specialized: ['analytics'],
      },
    ],
    [
      'ap-southeast',
      {
        primaryDB: 'ap-southeast-db',
        cacheNodes: ['ap-southeast-1'],
        specialized: ['real-time-features'],
      },
    ],
  ]);

  async routeRequest(request: Request): Promise<Response> {
    const clientRegion = this.getClientRegion(request);
    const config = this.regionConfigs.get(clientRegion);

    if (!config) {
      // Fallback to nearest available region
      return await this.routeToNearestRegion(request);
    }

    // Route to region-specific handler
    return await this.handleInRegion(request, config);
  }

  private getClientRegion(request: Request): string {
    const country = request.cf?.country;
    const colo = request.cf?.colo;

    // Map countries to regions
    if (['US', 'CA', 'MX'].includes(country)) return 'us-east';
    if (['GB', 'FR', 'DE', 'IT', 'ES', 'NL'].includes(country)) return 'eu-west';
    if (['JP', 'SG', 'AU', 'IN', 'KR'].includes(country)) return 'ap-southeast';

    return 'us-east'; // Default
  }
}
```

### 2. Content Distribution

```typescript
// Distribute content globally for better performance
export class ContentDistributionService {
  async getOptimalAssetURL(assetPath: string, region: string): Promise<string> {
    // Use region-specific R2 buckets or CDN endpoints
    const regionEndpoints = {
      'us-east': 'https://assets-us.yourdomain.com',
      'eu-west': 'https://assets-eu.yourdomain.com',
      'ap-southeast': 'https://assets-ap.yourdomain.com',
    };

    const baseURL = regionEndpoints[region] || regionEndpoints['us-east'];
    return `${baseURL}/${assetPath}`;
  }

  async replicateAssetGlobally(assetId: string, content: ArrayBuffer): Promise<void> {
    const replicas = [this.env.R2_US_EAST, this.env.R2_EU_WEST, this.env.R2_AP_SOUTHEAST];

    // Upload to all regions in parallel
    await Promise.all(
      replicas.map((bucket) =>
        bucket.put(assetId, content, {
          httpMetadata: {
            contentType: this.getContentType(assetId),
            cacheControl: 'public, max-age=31536000',
          },
        })
      )
    );
  }
}
```

## Cost Optimization

### 1. Resource Usage Optimization

```typescript
// Optimize costs while maintaining performance
export class CostOptimizer {
  async optimizeResourceUsage(): Promise<OptimizationReport> {
    const report: OptimizationReport = {
      recommendations: [],
      estimatedSavings: 0,
    };

    // Analyze KV usage patterns
    const kvUsage = await this.analyzeKVUsage();
    if (kvUsage.readWriteRatio > 10) {
      // Read-heavy
      report.recommendations.push({
        type: 'caching',
        description: 'Implement aggressive caching for read-heavy KV data',
        estimatedSaving: kvUsage.currentCost * 0.3,
      });
    }

    // Analyze queue usage
    const queueUsage = await this.analyzeQueueUsage();
    const idleQueues = queueUsage.queues.filter((q) => q.utilization < 0.1);
    if (idleQueues.length > 0) {
      report.recommendations.push({
        type: 'queue_consolidation',
        description: `Consolidate ${idleQueues.length} underutilized queues`,
        estimatedSaving: idleQueues.length * 50, // $50/month per queue
      });
    }

    // Analyze Durable Object usage
    const doUsage = await this.analyzeDurableObjectUsage();
    if (doUsage.avgConnectionsPerObject < 100) {
      report.recommendations.push({
        type: 'do_consolidation',
        description: 'Reduce number of Durable Object instances',
        estimatedSaving: doUsage.wastedCapacityCost,
      });
    }

    report.estimatedSavings = report.recommendations.reduce((total, rec) => total + rec.estimatedSaving, 0);

    return report;
  }

  async implementCostOptimizations(optimizations: Optimization[]): Promise<void> {
    for (const opt of optimizations) {
      switch (opt.type) {
        case 'caching':
          await this.implementAggressiveCaching();
          break;

        case 'queue_consolidation':
          await this.consolidateQueues(opt.targetQueues);
          break;

        case 'do_consolidation':
          await this.consolidateDurableObjects(opt.consolidationPlan);
          break;
      }
    }
  }
}
```

### 2. Usage-Based Scaling

```typescript
// Scale resources based on actual usage patterns
export class UsageBasedScaler {
  async analyzeUsagePatterns(): Promise<UsageAnalysis> {
    const analysis = {
      dailyPeaks: await this.getDailyPeakTimes(),
      weeklyTrends: await this.getWeeklyTrends(),
      seasonalPatterns: await this.getSeasonalPatterns(),
      userBehavior: await this.getUserBehaviorPatterns(),
    };

    return analysis;
  }

  async createScalingSchedule(analysis: UsageAnalysis): Promise<ScalingSchedule> {
    const schedule: ScalingSchedule = {
      rules: [],
    };

    // Scale up before daily peaks
    for (const peak of analysis.dailyPeaks) {
      schedule.rules.push({
        time: this.subtractMinutes(peak.time, 15), // 15 min before
        action: 'scale_up',
        factor: peak.intensity,
        duration: peak.duration + 30, // 30 min buffer
      });
    }

    // Scale down during low usage periods
    const lowUsagePeriods = this.identifyLowUsagePeriods(analysis);
    for (const period of lowUsagePeriods) {
      schedule.rules.push({
        time: period.start,
        action: 'scale_down',
        factor: 0.5, // Reduce to 50%
        duration: period.duration,
      });
    }

    return schedule;
  }
}
```

## Monitoring Scaling Health

### 1. Scaling Metrics

```typescript
// Monitor the effectiveness of scaling decisions
export class ScalingMetricsCollector {
  async collectScalingMetrics(): Promise<ScalingMetrics> {
    return {
      resourceUtilization: {
        workers: await this.getWorkerUtilization(),
        database: await this.getDatabaseUtilization(),
        queues: await this.getQueueUtilization(),
        durableObjects: await this.getDurableObjectUtilization(),
      },

      performance: {
        responseTimeP95: await this.getResponseTimeP95(),
        errorRate: await this.getErrorRate(),
        throughput: await this.getThroughput(),
      },

      costs: {
        daily: await this.getDailyCosts(),
        perFeature: await this.getCostsPerFeature(),
        efficiency: await this.calculateCostEfficiency(),
      },

      scalingEvents: {
        recent: await this.getRecentScalingEvents(),
        effectiveness: await this.evaluateScalingEffectiveness(),
      },
    };
  }

  async evaluateScalingEffectiveness(): Promise<ScalingEffectiveness> {
    const events = await this.getRecentScalingEvents();
    let successfulEvents = 0;

    for (const event of events) {
      const beforeMetrics = await this.getMetricsBefore(event.timestamp);
      const afterMetrics = await this.getMetricsAfter(event.timestamp);

      if (this.isScalingEventSuccessful(event, beforeMetrics, afterMetrics)) {
        successfulEvents++;
      }
    }

    return {
      totalEvents: events.length,
      successfulEvents,
      successRate: events.length > 0 ? successfulEvents / events.length : 0,
      avgResponseTime: this.calculateAvgResponseTime(events),
    };
  }
}
```

### 2. Scaling Alerts

```typescript
// Alert on scaling issues
export const scalingAlerts: AlertRule[] = [
  {
    name: 'Scaling Event Failed',
    condition: 'scaling_success_rate < 0.8',
    severity: 'critical',
    description: 'Recent scaling events have low success rate',
  },

  {
    name: 'Resource Utilization High',
    condition: 'resource_utilization > 0.9',
    severity: 'warning',
    description: 'Resources are highly utilized, consider scaling up',
  },

  {
    name: 'Cost Spike Detected',
    condition: 'daily_cost > previous_day_cost * 1.5',
    severity: 'warning',
    description: 'Daily costs have increased significantly',
  },

  {
    name: 'Scaling Too Frequent',
    condition: 'scaling_events_per_hour > 5',
    severity: 'warning',
    description: 'Too many scaling events, review thresholds',
  },
];
```

## Best Practices for Scaling

### 1. Design Principles

- **Stateless Design**: Keep Workers stateless for easy scaling
- **Idempotent Operations**: Ensure operations can be safely retried
- **Circuit Breakers**: Implement circuit breakers to prevent cascade failures
- **Graceful Degradation**: Design features to degrade gracefully under load
- **Async Processing**: Use queues for heavy operations

### 2. Testing Scaling

```typescript
// Load testing for scaling validation
export class ScalingLoadTester {
  async runScalingTest(targetLoad: number): Promise<LoadTestResults> {
    const test = new LoadTest({
      targetRPS: targetLoad,
      duration: 600, // 10 minutes
      rampUpTime: 120, // 2 minutes
      endpoints: ['/lti/launch', '/api/chat/message', '/api/video/upload', '/api/analytics/performance'],
    });

    const results = await test.execute();

    return {
      maxThroughput: results.maxRPS,
      avgResponseTime: results.avgResponseTime,
      errorRate: results.errorRate,
      scalingEvents: results.observedScalingEvents,
      resourceUtilization: results.peakUtilization,
    };
  }
}
```

### 3. Capacity Planning

```typescript
// Plan capacity based on growth projections
export class CapacityPlanner {
  async planCapacity(growthProjection: GrowthProjection): Promise<CapacityPlan> {
    const currentCapacity = await this.getCurrentCapacity();
    const projectedNeeds = this.calculateProjectedNeeds(growthProjection);

    return {
      currentCapacity,
      projectedNeeds,
      recommendations: [
        {
          component: 'database',
          action: 'add_read_replicas',
          timeline: '3 months',
          estimated_cost: 500, // monthly
        },
        {
          component: 'durable_objects',
          action: 'increase_sharding',
          timeline: '6 months',
          estimated_cost: 200,
        },
      ],
      totalEstimatedCost: 700,
    };
  }
}
```
