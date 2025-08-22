# 19. Monitoring and Observability

## Monitoring Stack

- **Frontend Monitoring:** Cloudflare Web Analytics for core metrics
- **Backend Monitoring:** Cloudflare Analytics Dashboard + Tail logs
- **Error Tracking:** Sentry integration for production errors
- **Performance Monitoring:** Cloudflare Observatory for performance insights

## Key Metrics

**Frontend Metrics:**

- Core Web Vitals (LCP, FID, CLS)
- JavaScript error rate
- API response times
- WebSocket connection stability
- User interaction events (chat messages sent, assessments completed)

**Backend Metrics:**

- Request rate and latency (p50, p95, p99)
- Error rate by endpoint
- AI API response times and token usage
- D1 query performance
- WebSocket connection count
- Grade passback success rate
