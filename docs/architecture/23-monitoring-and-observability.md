# 23. Monitoring and Observability

## Monitoring Stack

- **Frontend Monitoring:** Cloudflare Web Analytics for core metrics
- **Backend Monitoring:** Cloudflare Analytics Dashboard + Tail logs
- **Error Tracking:** Sentry integration for production errors
- **Performance Monitoring:** Cloudflare Observatory for performance insights
- **AI Usage Tracking:** Cloudflare AI Analytics for model usage and costs
- **Search Analytics:** Vectorize query performance and relevance metrics

## Cloudflare Analytics Integration

```typescript
// Frontend Analytics with Zaraz
export class AnalyticsService {
  // Track user events
  trackEvent(eventName: string, properties?: Record<string, any>) {
    if (typeof window !== 'undefined' && window.zaraz) {
      window.zaraz.track(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
        user_id: store.getState().auth.user?.id,
        session_id: store.getState().session.id,
      });
    }
  }

  // Track page views
  trackPageView(path: string) {
    this.trackEvent('page_view', { path });
  }

  // Track API performance
  trackApiCall(endpoint: string, duration: number, status: number) {
    this.trackEvent('api_call', {
      endpoint,
      duration_ms: duration,
      status_code: status,
      success: status < 400,
    });
  }
}

// Backend Analytics with Workers Analytics Engine
export class WorkerAnalytics {
  constructor(private env: Env) {}

  // Log request metrics
  async logRequest(request: Request, response: Response, duration: number) {
    await this.env.ANALYTICS.writeDataPoint({
      blobs: [request.url, request.method],
      doubles: [duration, response.status],
      indexes: ['endpoint', 'status_code'],
    });
  }

  // Track AI usage
  async trackAIUsage(model: string, tokens: number, latency: number) {
    await this.env.ANALYTICS.writeDataPoint({
      blobs: [model],
      doubles: [tokens, latency],
      indexes: ['ai_model'],
    });
  }

  // Monitor Vectorize performance
  async trackVectorSearch(query: string, resultCount: number, latency: number) {
    await this.env.ANALYTICS.writeDataPoint({
      blobs: ['vector_search'],
      doubles: [resultCount, latency],
      indexes: ['search_type'],
    });
  }
}
```

## Real-time Monitoring Dashboard

```typescript
// Custom metrics aggregation
export class MetricsAggregator {
  async getMetrics(timeRange: string): Promise<DashboardMetrics> {
    const analytics = await this.env.ANALYTICS.query({
      timeRange,
      aggregations: {
        requestCount: { type: 'count' },
        avgLatency: { type: 'avg', field: 'duration' },
        errorRate: {
          type: 'percentage',
          filter: { field: 'status', operator: '>=', value: 400 },
        },
        aiTokensUsed: {
          type: 'sum',
          field: 'tokens',
          filter: { index: 'ai_model' },
        },
      },
    });

    return {
      requests: analytics.requestCount,
      latency: analytics.avgLatency,
      errorRate: analytics.errorRate,
      aiUsage: {
        tokens: analytics.aiTokensUsed,
        cost: this.calculateAICost(analytics.aiTokensUsed),
      },
    };
  }
}
```

## Key Metrics

**Frontend Metrics:**

- Core Web Vitals (LCP, FID, CLS)
- JavaScript error rate
- API response times via RTK Query middleware
- WebSocket connection stability
- Redux action performance
- User interaction events (chat messages, assessments)

**Backend Metrics:**

- Request rate and latency (p50, p95, p99)
- Error rate by endpoint
- Cloudflare AI token usage and costs
- Vectorize query performance
- D1 query performance
- WebSocket connection count
- Grade passback success rate

**AI/ML Metrics:**

- Model inference latency
- Token consumption by model
- Embedding generation performance
- Vector search relevance scores
- Intent classification accuracy
