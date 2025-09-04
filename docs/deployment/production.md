# Production Deployment Guide

This document outlines the complete production deployment process for Atomic Guide, including environment setup, security hardening, and operational procedures.

## Production Environment Overview

### Infrastructure Stack

- **Primary**: Cloudflare Workers (Global Edge Network)
- **Database**: Cloudflare D1 (SQLite at Edge)
- **Storage**: Cloudflare R2 (Object Storage)
- **CDN**: Cloudflare Global Network
- **DNS**: Cloudflare DNS
- **Security**: Cloudflare Security Services

### Performance Characteristics

- **Cold Start**: < 100ms globally
- **Response Time**: < 50ms median
- **Availability**: 99.9% SLA
- **Global Edge**: 200+ data centers

## Pre-Production Checklist

### Code Quality Gates

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compilation clean (`npm run check`)
- [ ] Lint checks passing (`npm run lint`)
- [ ] Security audit clean (`npm audit`)
- [ ] Performance benchmarks met
- [ ] Code coverage > 80%

### Security Checklist

- [ ] All secrets configured via `wrangler secret`
- [ ] No hardcoded credentials in code
- [ ] HTTPS enforced for all endpoints
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Input validation with Zod schemas
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled

### Infrastructure Checklist

- [ ] D1 database created and migrated
- [ ] All KV namespaces configured
- [ ] R2 buckets created with proper permissions
- [ ] Durable Objects deployed
- [ ] Queue consumers configured
- [ ] Vectorize index created
- [ ] Custom domain configured
- [ ] SSL certificate active

## Production Environment Setup

### 1. Environment Variables

```bash
# Production environment configuration
wrangler secret put JWT_SECRET          # Strong JWT signing key
wrangler secret put LTI_WEBHOOK_SECRET  # HMAC webhook validation
wrangler secret put OPENAI_API_KEY      # OpenAI integration
wrangler secret put CANVAS_API_KEY      # Canvas integration (optional)
wrangler secret put MOODLE_API_KEY      # Moodle integration (optional)
wrangler secret put ANALYTICS_KEY       # Analytics service key
wrangler secret put MONITORING_KEY      # Monitoring service key

# Set environment type
wrangler secret put ENVIRONMENT "production"

# Database encryption key
wrangler secret put DB_ENCRYPTION_KEY
```

### 2. Production wrangler.jsonc

```jsonc
{
  "name": "atomic-guide-production",
  "main": "dist/index.js",
  "compatibility_date": "2024-01-15",
  "compatibility_flags": ["nodejs_compat"],
  "send_metrics": true,
  "logpush": true,

  "env": {
    "production": {
      "vars": {
        "ENVIRONMENT": "production",
        "LOG_LEVEL": "error",
        "DEBUG": "false",
      },

      "routes": [
        {
          "pattern": "guide.yourdomain.com/*",
          "zone_name": "yourdomain.com",
        },
      ],

      "limits": {
        "cpu_ms": 30000,
        "memory_mb": 128,
      },
    },
  },

  "placement": {
    "mode": "smart",
  },

  "observability": {
    "enabled": true,
  },
}
```

### 3. Database Setup

```bash
# Create production database
wrangler d1 create atomic-guide-production --env production

# Run migrations
npm run db:migrate:remote -- --env production

# Seed production data (minimal)
npm run db:seed:remote -- --env production --minimal
```

### 4. Custom Domain Configuration

```bash
# Configure custom domain
wrangler route add "guide.yourdomain.com/*" atomic-guide-production

# Verify SSL certificate
curl -I https://guide.yourdomain.com/health
```

## Deployment Pipeline

### 1. Automated CI/CD Pipeline

```yaml
# .github/workflows/production.yml
name: Production Deployment

on:
  push:
    branches: [main]
  release:
    types: [published]

env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Type check
        run: npm run check

      - name: Security audit
        run: npm audit --audit-level=high

      - name: Build application
        run: npm run build

      - name: Run database migrations
        run: npm run db:migrate:remote -- --env production

      - name: Deploy to Cloudflare
        run: npm run deploy -- --env production

      - name: Smoke tests
        run: npm run test:smoke -- --env production

      - name: Notify deployment
        uses: ./.github/actions/notify-deployment
        with:
          status: success
          environment: production
```

### 2. Manual Deployment Process

```bash
# 1. Pre-deployment checks
npm run check
npm test
npm run lint
npm audit

# 2. Build application
npm run build

# 3. Database migrations
npm run db:migrate:remote -- --env production

# 4. Deploy to production
npm run deploy -- --env production

# 5. Post-deployment verification
npm run test:smoke -- --env production

# 6. Monitor deployment
npm run tail -- --env production
```

### 3. Blue-Green Deployment

```bash
# Deploy to staging slot
wrangler deploy --name atomic-guide-staging --env staging

# Run integration tests against staging
npm run test:integration -- --env staging

# Promote to production
wrangler deploy --name atomic-guide-production --env production

# Monitor and rollback if needed
npm run monitor:health
```

## Production Configuration

### 1. Performance Optimization

```typescript
// Production-specific optimizations
export const productionConfig = {
  // Cache configuration
  cache: {
    staticAssets: '1y', // 1 year for immutable assets
    apiResponses: '5m', // 5 minutes for API responses
    ltiConfig: '1h', // 1 hour for LTI configuration
  },

  // Rate limiting
  rateLimit: {
    global: 1000, // requests per minute globally
    perUser: 100, // requests per minute per user
    perIP: 200, // requests per minute per IP
  },

  // Resource limits
  limits: {
    maxUploadSize: 100 * 1024 * 1024, // 100MB
    maxBatchSize: 100, // Max items per batch
    requestTimeout: 30000, // 30 seconds
  },
};
```

### 2. Security Hardening

```typescript
// Security headers for production
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN', // Allow LMS iframe embedding
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' wss: https:",
    'frame-ancestors *', // Allow embedding in LMS
  ].join('; '),
};

// Apply security headers
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

### 3. Error Handling

```typescript
// Production error handler
export class ProductionErrorHandler {
  static handle(error: Error, request: Request): Response {
    // Log error details for monitoring
    console.error('Production error:', {
      message: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent'),
    });

    // Return generic error to user
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
```

## Monitoring and Alerting

### 1. Health Checks

```typescript
// Health check endpoint
export async function handleHealthCheck(env: Env): Promise<Response> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || 'unknown',
    checks: {
      database: await checkDatabase(env.DB),
      kv: await checkKV(env.KEY_SETS),
      r2: await checkR2(env.VIDEO_STORAGE),
      ai: await checkAI(env.AI),
      vectorize: await checkVectorize(env.FAQ_INDEX),
    },
  };

  const allHealthy = Object.values(health.checks).every((check) => check.status === 'ok');

  return new Response(JSON.stringify(health), {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function checkDatabase(db: D1Database): Promise<{ status: string; latency: number }> {
  const start = Date.now();
  try {
    await db.prepare('SELECT 1').first();
    return { status: 'ok', latency: Date.now() - start };
  } catch (error) {
    return { status: 'error', latency: Date.now() - start };
  }
}
```

### 2. Custom Metrics

```typescript
// Performance metrics
export async function recordMetrics(request: Request, response: Response, startTime: number, env: Env): Promise<void> {
  const duration = Date.now() - startTime;
  const path = new URL(request.url).pathname;

  const metrics = {
    timestamp: Date.now(),
    path,
    method: request.method,
    status: response.status,
    duration,
    userAgent: request.headers.get('User-Agent'),
    country: request.cf?.country || 'unknown',
    colo: request.cf?.colo || 'unknown',
  };

  // Send to analytics queue for processing
  await env.ANALYTICS_QUEUE.send(metrics);
}
```

### 3. Alerting Rules

```yaml
# alerts.yml - Configure in monitoring service
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5m
    severity: critical

  - name: High Latency
    condition: p95_latency > 1000ms
    duration: 5m
    severity: warning

  - name: Database Connection Issues
    condition: db_connection_errors > 10
    duration: 2m
    severity: critical

  - name: Memory Usage High
    condition: memory_usage > 90%
    duration: 10m
    severity: warning

  - name: Queue Backlog
    condition: queue_backlog > 1000
    duration: 5m
    severity: warning
```

## Backup and Recovery

### 1. Database Backup

```bash
#!/bin/bash
# backup-production.sh

# Create database backup
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
wrangler d1 export atomic-guide-production --output "$BACKUP_FILE"

# Upload to R2 for long-term storage
wrangler r2 object put atomic-guide-backups/"$BACKUP_FILE" --file "$BACKUP_FILE"

# Verify backup
wrangler r2 object get atomic-guide-backups/"$BACKUP_FILE" --file verify.sql
diff "$BACKUP_FILE" verify.sql

# Clean up local files
rm "$BACKUP_FILE" verify.sql

echo "Backup completed: $BACKUP_FILE"
```

### 2. Disaster Recovery

```bash
#!/bin/bash
# disaster-recovery.sh

# 1. Create new D1 database
wrangler d1 create atomic-guide-recovery

# 2. Restore from backup
LATEST_BACKUP=$(wrangler r2 object list atomic-guide-backups --json | jq -r '.[] | select(.Key | endswith(".sql")) | .Key' | sort | tail -1)
wrangler r2 object get atomic-guide-backups/"$LATEST_BACKUP" --file restore.sql
wrangler d1 execute atomic-guide-recovery --file restore.sql

# 3. Update wrangler.jsonc with new database ID
# 4. Deploy application
npm run deploy -- --env production

# 5. Verify recovery
npm run test:smoke -- --env production
```

### 3. Configuration Backup

```bash
# Backup KV namespaces
for namespace in KEY_SETS REMOTE_JWKS CLIENT_AUTH_TOKENS PLATFORMS; do
  wrangler kv:bulk get --namespace-id "$namespace" > "backup-$namespace.json"
done

# Backup Vectorize index
wrangler vectorize get faq-index --output backup-vectorize.json

# Store backups securely
tar czf "config-backup-$(date +%Y%m%d).tar.gz" backup-*.json
```

## Scaling Considerations

### 1. Auto-scaling Configuration

```jsonc
{
  "placement": {
    "mode": "smart", // Cloudflare automatically places workers optimally
  },

  "limits": {
    "cpu_ms": 30000, // 30 seconds CPU time limit
    "memory_mb": 128, // 128MB memory limit
  },
}
```

### 2. Database Scaling

```typescript
// Read replicas for global performance
export class GlobalDatabaseService {
  constructor(
    private primaryDB: D1Database,
    private replicaDBs: Map<string, D1Database>
  ) {}

  async read(query: string, region?: string): Promise<any> {
    const db = region && this.replicaDBs.has(region) ? this.replicaDBs.get(region)! : this.primaryDB;

    return await db.prepare(query).first();
  }

  async write(query: string): Promise<any> {
    // Always write to primary
    return await this.primaryDB.prepare(query).run();
  }
}
```

### 3. Queue Scaling

```typescript
// Queue configuration for high throughput
export const queueConfig = {
  video_processing: {
    max_batch_size: 10,
    max_batch_timeout: 30000, // 30 seconds
    max_retries: 3,
    dead_letter_queue: 'video_processing_dlq',
  },

  analytics: {
    max_batch_size: 100,
    max_batch_timeout: 10000, // 10 seconds
    max_retries: 2,
  },
};
```

## Performance Monitoring

### 1. Core Web Vitals

```typescript
// Client-side performance monitoring
export function trackWebVitals(): void {
  if (typeof window === 'undefined') return;

  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS((metric) => sendMetric('CLS', metric));
    getFID((metric) => sendMetric('FID', metric));
    getFCP((metric) => sendMetric('FCP', metric));
    getLCP((metric) => sendMetric('LCP', metric));
    getTTFB((metric) => sendMetric('TTFB', metric));
  });
}

function sendMetric(name: string, metric: any): void {
  navigator.sendBeacon(
    '/api/metrics',
    JSON.stringify({
      name,
      value: metric.value,
      id: metric.id,
      timestamp: Date.now(),
    })
  );
}
```

### 2. Real User Monitoring

```typescript
// RUM implementation
export class RealUserMonitoring {
  private buffer: MetricEvent[] = [];

  track(event: MetricEvent): void {
    this.buffer.push(event);

    if (this.buffer.length >= 10) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0);

    try {
      await fetch('/api/metrics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(events),
      });
    } catch (error) {
      console.warn('Failed to send metrics:', error);
    }
  }
}
```

## Security Auditing

### 1. Regular Security Checks

```bash
#!/bin/bash
# security-audit.sh

# NPM audit
npm audit --audit-level=moderate

# TypeScript security check
npx tsc --noEmit --strict

# Check for secrets in code
git log --all -p | grep -i "password\|secret\|key\|token" | head -20

# HTTPS enforcement check
curl -I http://guide.yourdomain.com | grep -i location

# Security headers check
curl -I https://guide.yourdomain.com | grep -E "(strict-transport|x-content-type|x-frame-options)"
```

### 2. Vulnerability Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly
  push:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run security audit
        run: npm audit --audit-level=high

      - name: SAST scan
        uses: github/super-linter@v4
        env:
          DEFAULT_BRANCH: main
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Troubleshooting Production Issues

### 1. Common Issues and Solutions

| Issue          | Symptoms            | Solution                                      |
| -------------- | ------------------- | --------------------------------------------- |
| High Latency   | Response times > 1s | Check database queries, optimize hot paths    |
| Memory Errors  | 1015 errors         | Reduce memory usage, optimize data structures |
| Rate Limiting  | 429 errors          | Implement client-side retry logic             |
| Database Locks | Timeouts on writes  | Optimize transaction scope                    |
| Queue Backlog  | Delayed processing  | Scale queue consumers                         |

### 2. Emergency Procedures

```bash
# Emergency rollback
wrangler deploy --name atomic-guide-production --env production --compatibility-date=2024-01-01

# Temporary traffic routing
wrangler route delete "guide.yourdomain.com/*"
wrangler route add "guide.yourdomain.com/*" atomic-guide-maintenance

# Database emergency mode
wrangler d1 execute atomic-guide-production --command "PRAGMA read_only=1"

# Emergency maintenance page
echo "Service temporarily unavailable" > maintenance.html
wrangler pages publish maintenance.html --project-name atomic-guide-maintenance
```
