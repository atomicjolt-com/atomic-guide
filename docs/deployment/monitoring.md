# Production Monitoring Guide

This document outlines the comprehensive monitoring strategy for Atomic Guide in production, including metrics collection, alerting, and performance optimization.

## Monitoring Stack Overview

### Core Components

- **Cloudflare Analytics**: Built-in Workers analytics and metrics
- **Custom Metrics**: Application-specific performance indicators
- **Real User Monitoring**: Client-side performance tracking
- **Health Checks**: Automated service health validation
- **Log Aggregation**: Structured logging and analysis
- **Alerting**: Proactive issue detection and notification

### Data Flow

```
Client → Workers → Metrics Collection → Analytics Queue → Dashboard
     ↓           ↓                     ↓
   RUM Data → Custom Events → Alerts → Notifications
```

## Core Metrics

### 1. Worker Performance Metrics

#### Request Metrics

```typescript
interface WorkerMetrics {
  // Request volume
  requestsPerSecond: number;
  requestsPerMinute: number;
  totalRequests: number;

  // Response times
  responseTime50p: number; // 50th percentile
  responseTime95p: number; // 95th percentile
  responseTime99p: number; // 99th percentile
  maxResponseTime: number;

  // Error rates
  errorRate: number; // Percentage of 5xx responses
  status2xx: number; // Success responses
  status3xx: number; // Redirect responses
  status4xx: number; // Client error responses
  status5xx: number; // Server error responses

  // Resource usage
  cpuTime: number; // CPU time in milliseconds
  memoryUsage: number; // Memory usage in MB

  // Geographic distribution
  requestsByCountry: Record<string, number>;
  requestsByColo: Record<string, number>;
}
```

#### Implementation

```typescript
export class MetricsCollector {
  private startTime: number = Date.now();

  async collectRequestMetrics(request: Request, response: Response, env: Env): Promise<void> {
    const duration = Date.now() - this.startTime;
    const url = new URL(request.url);

    const metrics = {
      timestamp: Date.now(),
      method: request.method,
      path: url.pathname,
      status: response.status,
      duration,
      country: request.cf?.country || 'unknown',
      colo: request.cf?.colo || 'unknown',
      userAgent: request.headers.get('User-Agent'),
      referer: request.headers.get('Referer'),
    };

    // Send to analytics queue
    await env.ANALYTICS_QUEUE.send({
      type: 'request_metric',
      data: metrics,
    });
  }
}
```

### 2. Database Metrics

```typescript
interface DatabaseMetrics {
  // Query performance
  queryCount: number;
  avgQueryTime: number;
  slowQueries: number; // Queries > 1000ms

  // Connection health
  connectionErrors: number;
  timeouts: number;

  // Database size
  totalRows: number;
  storageUsed: number; // In MB

  // Most expensive queries
  expensiveQueries: Array<{
    query: string;
    avgTime: number;
    count: number;
  }>;
}

export class DatabaseMonitor {
  async recordQuery(query: string, duration: number, success: boolean): Promise<void> {
    const metric = {
      timestamp: Date.now(),
      query: query.substring(0, 100), // Truncate for privacy
      duration,
      success,
      type: this.getQueryType(query),
    };

    await this.metricsQueue.send({
      type: 'database_metric',
      data: metric,
    });
  }

  private getQueryType(query: string): string {
    const normalized = query.toLowerCase().trim();
    if (normalized.startsWith('select')) return 'SELECT';
    if (normalized.startsWith('insert')) return 'INSERT';
    if (normalized.startsWith('update')) return 'UPDATE';
    if (normalized.startsWith('delete')) return 'DELETE';
    return 'OTHER';
  }
}
```

### 3. LTI Integration Metrics

```typescript
interface LTIMetrics {
  // Launch metrics
  launchesPerHour: number;
  successfulLaunches: number;
  failedLaunches: number;
  launchLatency: number;

  // Platform distribution
  platformLaunches: Record<string, number>;

  // Deep linking
  deepLinksCreated: number;
  deepLinksUsed: number;
  deepLinkSuccess: number;

  // Names & Roles usage
  nrpsRequests: number;
  nrpsLatency: number;

  // Grades passback
  gradesPosted: number;
  gradeErrors: number;
}

export class LTIMonitor {
  async recordLaunch(platformId: string, success: boolean, duration: number, context: LTIContext): Promise<void> {
    const metric = {
      timestamp: Date.now(),
      platformId,
      success,
      duration,
      contextType: context.type,
      userRole: context.roles?.[0] || 'unknown',
    };

    await this.analyticsQueue.send({
      type: 'lti_launch',
      data: metric,
    });
  }
}
```

### 4. Feature Usage Metrics

```typescript
interface FeatureMetrics {
  // Chat usage
  messagesPerDay: number;
  activeChats: number;
  avgMessagesPerSession: number;

  // Video processing
  videosUploaded: number;
  transcriptionsCompleted: number;
  avgProcessingTime: number;

  // FAQ usage
  faqQueries: number;
  faqHitRate: number;
  avgQueryResponseTime: number;

  // Assessment usage
  assessmentsCreated: number;
  assessmentsCompleted: number;
  avgCompletionTime: number;
}
```

## Health Checks

### 1. Service Health Endpoints

```typescript
export class HealthCheckService {
  async performHealthCheck(env: Env): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(env.DB),
      this.checkKVStore(env.KEY_SETS),
      this.checkR2Storage(env.VIDEO_STORAGE),
      this.checkAIService(env.AI),
      this.checkVectorSearch(env.FAQ_INDEX),
      this.checkQueues(env),
    ]);

    const results = checks.map((result, index) => ({
      service: this.serviceNames[index],
      status: result.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      details: result.status === 'fulfilled' ? result.value : { error: result.reason.message },
    }));

    const overallHealth = results.every((r) => r.status === 'healthy') ? 'healthy' : 'unhealthy';

    return {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      services: results,
      version: env.VERSION || 'unknown',
    };
  }

  private async checkDatabase(db: D1Database): Promise<ServiceCheck> {
    const start = Date.now();
    try {
      await db.prepare('SELECT 1 as health_check').first();
      return {
        status: 'healthy',
        latency: Date.now() - start,
        details: { connection: 'ok' },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        details: { error: error.message },
      };
    }
  }

  private async checkKVStore(kv: KVNamespace): Promise<ServiceCheck> {
    const start = Date.now();
    try {
      const testKey = `health_check_${Date.now()}`;
      await kv.put(testKey, 'ok', { expirationTtl: 60 });
      const value = await kv.get(testKey);
      await kv.delete(testKey);

      return {
        status: value === 'ok' ? 'healthy' : 'unhealthy',
        latency: Date.now() - start,
        details: { read_write: 'ok' },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        details: { error: error.message },
      };
    }
  }
}

// Health check endpoint
export async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  const healthService = new HealthCheckService();
  const health = await healthService.performHealthCheck(env);

  return new Response(JSON.stringify(health, null, 2), {
    status: health.status === 'healthy' ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
```

### 2. Synthetic Monitoring

```typescript
// Automated health checks from external monitoring service
export class SyntheticMonitor {
  private checks = [
    {
      name: 'LTI Config Endpoint',
      url: 'https://guide.yourdomain.com/lti/config',
      method: 'GET',
      expectedStatus: 200,
      timeout: 5000,
    },
    {
      name: 'Health Check',
      url: 'https://guide.yourdomain.com/health',
      method: 'GET',
      expectedStatus: 200,
      timeout: 5000,
    },
    {
      name: 'Home Page',
      url: 'https://guide.yourdomain.com/',
      method: 'GET',
      expectedStatus: 200,
      timeout: 5000,
    },
  ];

  async runChecks(): Promise<SyntheticResults> {
    const results = await Promise.allSettled(this.checks.map((check) => this.runCheck(check)));

    return {
      timestamp: new Date().toISOString(),
      totalChecks: this.checks.length,
      passedChecks: results.filter((r) => r.status === 'fulfilled').length,
      results: results.map((result, index) => ({
        check: this.checks[index].name,
        status: result.status === 'fulfilled' ? 'pass' : 'fail',
        details: result.status === 'fulfilled' ? result.value : { error: result.reason },
      })),
    };
  }
}
```

## Real User Monitoring (RUM)

### 1. Client-Side Performance

```typescript
// Client-side RUM implementation
export class RealUserMonitor {
  private metrics: PerformanceEntry[] = [];
  private observer?: PerformanceObserver;

  init(): void {
    this.trackWebVitals();
    this.trackNavigation();
    this.trackResources();
    this.trackLongTasks();
  }

  private trackWebVitals(): void {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => this.sendMetric('CLS', metric));
      getFID((metric) => this.sendMetric('FID', metric));
      getFCP((metric) => this.sendMetric('FCP', metric));
      getLCP((metric) => this.sendMetric('LCP', metric));
      getTTFB((metric) => this.sendMetric('TTFB', metric));
    });
  }

  private trackNavigation(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navigation) {
      this.sendMetric('page_load', {
        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcp: navigation.connectEnd - navigation.connectStart,
        ssl: navigation.connectEnd - navigation.secureConnectionStart,
        ttfb: navigation.responseStart - navigation.requestStart,
        download: navigation.responseEnd - navigation.responseStart,
        dom: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        load: navigation.loadEventEnd - navigation.loadEventStart,
      });
    }
  }

  private sendMetric(name: string, data: any): void {
    const metric = {
      name,
      value: data.value || data,
      id: data.id || crypto.randomUUID(),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: (navigator as any).connection?.effectiveType,
    };

    // Use sendBeacon for reliability
    navigator.sendBeacon('/api/metrics/rum', JSON.stringify(metric));
  }
}

// Initialize RUM
if (typeof window !== 'undefined') {
  const rum = new RealUserMonitor();
  rum.init();
}
```

### 2. Error Tracking

```typescript
// Global error handler
export class ErrorTracker {
  init(): void {
    window.addEventListener('error', this.handleError.bind(this));
    window.addEventListener('unhandledrejection', this.handleRejection.bind(this));
  }

  private handleError(event: ErrorEvent): void {
    this.sendError({
      type: 'javascript_error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: Date.now(),
      url: window.location.href,
    });
  }

  private handleRejection(event: PromiseRejectionEvent): void {
    this.sendError({
      type: 'unhandled_promise_rejection',
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack,
      timestamp: Date.now(),
      url: window.location.href,
    });
  }

  private sendError(error: ErrorReport): void {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error),
    }).catch((err) => {
      console.warn('Failed to send error report:', err);
    });
  }
}
```

## Custom Dashboards

### 1. Operational Dashboard

```typescript
// Dashboard data aggregation
export class DashboardService {
  async getOperationalMetrics(timeRange: string): Promise<OperationalDashboard> {
    const metrics = await Promise.all([
      this.getRequestMetrics(timeRange),
      this.getErrorMetrics(timeRange),
      this.getPerformanceMetrics(timeRange),
      this.getLTIMetrics(timeRange),
      this.getFeatureUsage(timeRange),
    ]);

    return {
      timestamp: new Date().toISOString(),
      timeRange,
      overview: {
        totalRequests: metrics[0].total,
        errorRate: metrics[1].rate,
        avgResponseTime: metrics[2].avgResponseTime,
        activeLaunches: metrics[3].activeLaunches,
        uptime: await this.calculateUptime(),
      },
      charts: {
        requestsOverTime: metrics[0].timeSeries,
        errorsOverTime: metrics[1].timeSeries,
        responseTimeOverTime: metrics[2].timeSeries,
        ltiLaunchesOverTime: metrics[3].timeSeries,
      },
      topErrors: metrics[1].topErrors,
      slowestEndpoints: metrics[2].slowestEndpoints,
      featureUsage: metrics[4],
    };
  }
}

// Real-time dashboard updates via WebSocket
export class DashboardWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): void {
    this.ws = new WebSocket('wss://guide.yourdomain.com/api/dashboard/ws');

    this.ws.onopen = () => {
      console.log('Dashboard WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.handleDashboardUpdate(update);
    };

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(
          () => {
            this.reconnectAttempts++;
            this.connect();
          },
          Math.pow(2, this.reconnectAttempts) * 1000
        );
      }
    };
  }

  private handleDashboardUpdate(update: DashboardUpdate): void {
    switch (update.type) {
      case 'metric_update':
        this.updateMetricDisplay(update.data);
        break;
      case 'alert':
        this.showAlert(update.data);
        break;
      case 'health_status':
        this.updateHealthStatus(update.data);
        break;
    }
  }
}
```

### 2. Business Intelligence Dashboard

```typescript
// Business metrics for stakeholders
export class BusinessDashboard {
  async getBusinessMetrics(period: 'day' | 'week' | 'month'): Promise<BusinessMetrics> {
    return {
      userEngagement: {
        activeUsers: await this.getActiveUsers(period),
        sessionsPerUser: await this.getSessionsPerUser(period),
        avgSessionDuration: await this.getAvgSessionDuration(period),
        userRetention: await this.getUserRetention(period),
      },

      ltiIntegration: {
        totalLaunches: await this.getTotalLaunches(period),
        uniquePlatforms: await this.getUniquePlatforms(period),
        launchSuccess: await this.getLaunchSuccessRate(period),
        topPlatforms: await this.getTopPlatforms(period),
      },

      featureAdoption: {
        chatUsage: await this.getChatUsage(period),
        videoProcessing: await this.getVideoProcessing(period),
        faqQueries: await this.getFAQQueries(period),
        assessmentUsage: await this.getAssessmentUsage(period),
      },

      performance: {
        avgResponseTime: await this.getAvgResponseTime(period),
        uptime: await this.getUptime(period),
        errorRate: await this.getErrorRate(period),
      },
    };
  }
}
```

## Alerting System

### 1. Alert Configuration

```typescript
interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  duration: number; // Seconds
  severity: 'info' | 'warning' | 'critical';
  channels: string[]; // Notification channels
  enabled: boolean;
}

export const alertRules: AlertRule[] = [
  {
    id: 'high_error_rate',
    name: 'High Error Rate',
    condition: 'error_rate > threshold',
    threshold: 0.05, // 5%
    duration: 300, // 5 minutes
    severity: 'critical',
    channels: ['email', 'slack', 'pagerduty'],
    enabled: true,
  },

  {
    id: 'high_response_time',
    name: 'High Response Time',
    condition: 'p95_response_time > threshold',
    threshold: 2000, // 2 seconds
    duration: 300,
    severity: 'warning',
    channels: ['slack'],
    enabled: true,
  },

  {
    id: 'database_connection_errors',
    name: 'Database Connection Issues',
    condition: 'db_connection_errors > threshold',
    threshold: 10,
    duration: 120, // 2 minutes
    severity: 'critical',
    channels: ['email', 'slack', 'pagerduty'],
    enabled: true,
  },

  {
    id: 'queue_backlog',
    name: 'Queue Backlog Too Large',
    condition: 'queue_backlog > threshold',
    threshold: 1000,
    duration: 300,
    severity: 'warning',
    channels: ['slack'],
    enabled: true,
  },
];
```

### 2. Alert Processing

```typescript
export class AlertProcessor {
  private alertStates = new Map<string, AlertState>();

  async processMetrics(metrics: Metric[]): Promise<void> {
    for (const rule of alertRules) {
      if (!rule.enabled) continue;

      const shouldAlert = this.evaluateRule(rule, metrics);
      const currentState = this.alertStates.get(rule.id);

      if (shouldAlert && !currentState?.active) {
        // New alert
        await this.triggerAlert(rule, metrics);
        this.alertStates.set(rule.id, {
          active: true,
          triggeredAt: Date.now(),
          rule,
        });
      } else if (!shouldAlert && currentState?.active) {
        // Alert resolved
        await this.resolveAlert(rule);
        this.alertStates.delete(rule.id);
      }
    }
  }

  private evaluateRule(rule: AlertRule, metrics: Metric[]): boolean {
    switch (rule.condition) {
      case 'error_rate > threshold':
        const errorRate = this.calculateErrorRate(metrics);
        return errorRate > rule.threshold;

      case 'p95_response_time > threshold':
        const p95Time = this.calculateP95ResponseTime(metrics);
        return p95Time > rule.threshold;

      case 'db_connection_errors > threshold':
        const dbErrors = this.countDBErrors(metrics);
        return dbErrors > rule.threshold;

      case 'queue_backlog > threshold':
        const backlog = this.getQueueBacklog(metrics);
        return backlog > rule.threshold;

      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, metrics: Metric[]): Promise<void> {
    const alert = {
      rule,
      timestamp: new Date().toISOString(),
      severity: rule.severity,
      message: this.generateAlertMessage(rule, metrics),
    };

    for (const channel of rule.channels) {
      await this.sendNotification(channel, alert);
    }
  }
}
```

### 3. Notification Channels

```typescript
// Email notifications
export class EmailNotifier {
  async send(alert: Alert): Promise<void> {
    const emailBody = `
      Alert: ${alert.rule.name}
      Severity: ${alert.severity}
      Time: ${alert.timestamp}
      
      ${alert.message}
      
      Dashboard: https://guide.yourdomain.com/dashboard
    `;

    await this.emailService.send({
      to: 'alerts@yourcompany.com',
      subject: `[${alert.severity.toUpperCase()}] ${alert.rule.name}`,
      body: emailBody,
    });
  }
}

// Slack notifications
export class SlackNotifier {
  async send(alert: Alert): Promise<void> {
    const color = {
      info: 'good',
      warning: 'warning',
      critical: 'danger',
    }[alert.severity];

    await fetch(this.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [
          {
            color,
            title: `${alert.rule.name}`,
            text: alert.message,
            footer: 'Atomic Guide Monitoring',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      }),
    });
  }
}
```

## Log Management

### 1. Structured Logging

```typescript
export class Logger {
  private env: Env;
  private context: LogContext;

  constructor(env: Env, context: LogContext = {}) {
    this.env = env;
    this.context = context;
  }

  info(message: string, data?: Record<string, any>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, any>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>): void {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    };

    // Console output for development
    console.log(JSON.stringify(logEntry));

    // Send to log aggregation service
    if (this.env.ENVIRONMENT === 'production') {
      this.sendToLogService(logEntry);
    }
  }

  private async sendToLogService(entry: LogEntry): Promise<void> {
    try {
      await this.env.LOG_QUEUE.send(entry);
    } catch (error) {
      console.error('Failed to send log entry:', error);
    }
  }
}

// Usage example
const logger = new Logger(env, {
  requestId: crypto.randomUUID(),
  userId: 'user123',
  feature: 'chat',
});

logger.info('Chat message sent', { messageId: 'msg456', length: 42 });
logger.error('Failed to process video', { videoId: 'vid789', error: error.message });
```

### 2. Log Analysis

```typescript
// Log aggregation and analysis
export class LogAnalyzer {
  async analyzeErrorPatterns(timeWindow: number): Promise<ErrorAnalysis> {
    const errors = await this.getErrorLogs(timeWindow);

    const patterns = {
      byMessage: this.groupBy(errors, 'message'),
      byPath: this.groupBy(errors, 'path'),
      byStatus: this.groupBy(errors, 'status'),
      overTime: this.timeSeriesAnalysis(errors),
    };

    return {
      totalErrors: errors.length,
      uniqueMessages: Object.keys(patterns.byMessage).length,
      topErrors: this.getTopErrors(patterns.byMessage),
      trends: this.analyzeTrends(patterns.overTime),
    };
  }

  async generateInsights(): Promise<LogInsights> {
    return {
      errorSpikes: await this.detectErrorSpikes(),
      performanceRegression: await this.detectPerformanceRegression(),
      unusualPatterns: await this.detectUnusualPatterns(),
    };
  }
}
```

## Performance Optimization Based on Metrics

### 1. Automated Optimization

```typescript
export class PerformanceOptimizer {
  async optimizeBasedOnMetrics(): Promise<OptimizationReport> {
    const metrics = await this.getRecentMetrics();
    const optimizations = [];

    // Detect slow queries and suggest indexes
    const slowQueries = metrics.database.filter((q) => q.duration > 1000);
    if (slowQueries.length > 0) {
      optimizations.push({
        type: 'database_index',
        description: 'Add indexes for slow queries',
        impact: 'high',
        queries: slowQueries.map((q) => q.query),
      });
    }

    // Detect memory usage spikes
    if (metrics.worker.memoryUsage > 100) {
      optimizations.push({
        type: 'memory_optimization',
        description: 'Optimize memory usage in hot paths',
        impact: 'medium',
        hotPaths: metrics.worker.topMemoryConsumers,
      });
    }

    // Detect high error rates on specific endpoints
    const errorRates = this.calculateErrorRatesByEndpoint(metrics.requests);
    const highErrorEndpoints = Object.entries(errorRates)
      .filter(([_, rate]) => rate > 0.05)
      .map(([endpoint, rate]) => ({ endpoint, rate }));

    if (highErrorEndpoints.length > 0) {
      optimizations.push({
        type: 'error_handling',
        description: 'Improve error handling for endpoints',
        impact: 'high',
        endpoints: highErrorEndpoints,
      });
    }

    return {
      timestamp: new Date().toISOString(),
      optimizations,
      priority: this.prioritizeOptimizations(optimizations),
    };
  }
}
```

## Monitoring Best Practices

### 1. Metric Collection Guidelines

- **High Cardinality**: Avoid metrics with too many unique labels
- **Sampling**: Use sampling for high-volume metrics
- **Buffering**: Buffer metrics before sending to reduce overhead
- **Graceful Degradation**: Continue functioning if metrics collection fails

### 2. Alert Design Principles

- **Actionable**: Alerts should require human action
- **Specific**: Include enough context to understand the issue
- **Grouped**: Batch related alerts to avoid noise
- **Escalation**: Implement escalation for critical issues

### 3. Dashboard Design

- **Red/Yellow/Green**: Use color coding for quick status assessment
- **Time Context**: Always include time ranges and timestamps
- **Drill Down**: Enable drilling down from overview to details
- **Mobile Friendly**: Ensure dashboards work on mobile devices

### 4. Performance Impact

- **Async Processing**: Use queues for heavy metric processing
- **Caching**: Cache dashboard data appropriately
- **Batching**: Batch metric submissions
- **Circuit Breakers**: Disable monitoring if it impacts performance
