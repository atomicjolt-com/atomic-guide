# Cloudflare Deployment Guide

This document provides comprehensive instructions for deploying Atomic Guide to Cloudflare Workers platform.

## Overview

Atomic Guide is built specifically for Cloudflare's edge computing platform, utilizing:

- **Cloudflare Workers**: Serverless JavaScript runtime
- **D1 Database**: SQLite at the edge
- **KV Storage**: Key-value storage for sessions and cache
- **Durable Objects**: Stateful WebSocket connections
- **R2 Storage**: Object storage for video files
- **Workers AI**: AI/ML capabilities
- **Vectorize**: Vector database for semantic search
- **Queues**: Asynchronous task processing

## Prerequisites

### Required Tools
```bash
# Install Wrangler CLI
npm install -g wrangler

# Verify installation
wrangler --version

# Authenticate with Cloudflare
wrangler auth login
```

### Account Requirements
- Cloudflare account with Workers paid plan
- Domain configured in Cloudflare (optional but recommended)
- API tokens with appropriate permissions

### Environment Setup
```bash
# Clone repository
git clone https://github.com/your-org/atomic-guide.git
cd atomic-guide

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

## Infrastructure Setup

### 1. Create D1 Database

```bash
# Create database
npm run db:setup

# This will:
# - Create D1 database named 'atomic-guide-db'
# - Update wrangler.jsonc with database ID
# - Run initial migrations
```

Manual database creation:
```bash
# Create database manually
wrangler d1 create atomic-guide-db

# Update wrangler.jsonc with returned database ID
# Then run migrations
npm run db:migrate:remote
```

### 2. Create KV Namespaces

```bash
# Create all KV namespaces
npm run kv:setup

# Manual creation:
wrangler kv:namespace create KEY_SETS
wrangler kv:namespace create KEY_SETS --preview
wrangler kv:namespace create REMOTE_JWKS  
wrangler kv:namespace create REMOTE_JWKS --preview
wrangler kv:namespace create CLIENT_AUTH_TOKENS
wrangler kv:namespace create CLIENT_AUTH_TOKENS --preview
wrangler kv:namespace create PLATFORMS
wrangler kv:namespace create PLATFORMS --preview
```

### 3. Create R2 Bucket

```bash
# Create R2 bucket for video storage
wrangler r2 bucket create atomic-guide-videos

# Create R2 bucket for general file storage
wrangler r2 bucket create atomic-guide-files
```

### 4. Set up Queues

```bash
# Create video processing queue
wrangler queues create video-processing-queue

# Create analytics queue
wrangler queues create analytics-queue

# Create webhook queue  
wrangler queues create webhook-queue
```

### 5. Configure Vectorize Index

```bash
# Create vector index for FAQ and content search
wrangler vectorize create faq-index \
  --dimensions=1536 \
  --metric=cosine \
  --description="FAQ and content semantic search"
```

## Configuration

### wrangler.jsonc Configuration

Ensure your `wrangler.jsonc` includes all required bindings:

```jsonc
{
  "name": "atomic-guide",
  "main": "dist/index.js",
  "compatibility_date": "2024-01-15",
  "compatibility_flags": ["nodejs_compat"],
  "send_metrics": true,
  
  "vars": {
    "ENVIRONMENT": "production"
  },
  
  "kv_namespaces": [
    { "binding": "KEY_SETS", "id": "your-key-sets-id", "preview_id": "preview-id" },
    { "binding": "REMOTE_JWKS", "id": "your-jwks-id", "preview_id": "preview-id" },
    { "binding": "CLIENT_AUTH_TOKENS", "id": "your-tokens-id", "preview_id": "preview-id" },
    { "binding": "PLATFORMS", "id": "your-platforms-id", "preview_id": "preview-id" }
  ],
  
  "d1_databases": [
    { "binding": "DB", "database_name": "atomic-guide-db", "database_id": "your-db-id" }
  ],
  
  "r2_buckets": [
    { "binding": "VIDEO_STORAGE", "bucket_name": "atomic-guide-videos" },
    { "binding": "FILE_STORAGE", "bucket_name": "atomic-guide-files" }
  ],
  
  "ai": {
    "binding": "AI"
  },
  
  "vectorize": [
    { "binding": "FAQ_INDEX", "index_name": "faq-index" }
  ],
  
  "queues": {
    "producers": [
      { "binding": "VIDEO_QUEUE", "queue": "video-processing-queue" },
      { "binding": "ANALYTICS_QUEUE", "queue": "analytics-queue" },
      { "binding": "WEBHOOK_QUEUE", "queue": "webhook-queue" }
    ],
    "consumers": [
      { "queue": "video-processing-queue", "max_batch_size": 10 },
      { "queue": "analytics-queue", "max_batch_size": 100 },
      { "queue": "webhook-queue", "max_batch_size": 50 }
    ]
  },
  
  "durable_objects": {
    "bindings": [
      { "name": "OIDC_STATE", "class_name": "OidcStateDurableObject" },
      { "name": "CHAT_ROOM", "class_name": "ChatRoomDurableObject" },
      { "name": "ANALYTICS", "class_name": "AnalyticsDurableObject" }
    ]
  },
  
  "rules": [
    { "type": "Text", "globs": ["**/*.txt", "**/*.md"] },
    { "type": "Data", "globs": ["**/*.bin", "**/*.dat"] }
  ]
}
```

### Environment Variables

Set production environment variables:

```bash
# Required secrets
wrangler secret put JWT_SECRET
wrangler secret put LTI_WEBHOOK_SECRET
wrangler secret put OPENAI_API_KEY

# Optional secrets for integrations
wrangler secret put CANVAS_API_KEY
wrangler secret put MOODLE_API_KEY
wrangler secret put ANALYTICS_API_KEY
```

Environment variables in code:
```typescript
interface Env {
  // Bindings
  DB: D1Database;
  VIDEO_STORAGE: R2Bucket;
  AI: Ai;
  FAQ_INDEX: VectorizeIndex;
  
  // KV Namespaces
  KEY_SETS: KVNamespace;
  REMOTE_JWKS: KVNamespace;
  CLIENT_AUTH_TOKENS: KVNamespace;
  PLATFORMS: KVNamespace;
  
  // Queues
  VIDEO_QUEUE: Queue;
  ANALYTICS_QUEUE: Queue;
  WEBHOOK_QUEUE: Queue;
  
  // Durable Objects
  OIDC_STATE: DurableObjectNamespace;
  CHAT_ROOM: DurableObjectNamespace;
  ANALYTICS: DurableObjectNamespace;
  
  // Secrets
  JWT_SECRET: string;
  LTI_WEBHOOK_SECRET: string;
  OPENAI_API_KEY: string;
  
  // Variables
  ENVIRONMENT: 'development' | 'production';
}
```

## Build and Deploy Process

### 1. Pre-deployment Checks

```bash
# Validate TypeScript and build
npm run check

# Run tests
npm test

# Lint code
npm run lint
```

### 2. Database Migrations

```bash
# Check migration status
npm run db:status

# Run pending migrations on production
npm run db:migrate:remote

# Seed production database (if needed)
npm run db:seed:remote
```

### 3. Build Application

```bash
# Build production bundle
npm run build

# This will:
# - Compile TypeScript to JavaScript
# - Bundle client-side code with Vite
# - Generate manifest.json for cache busting
# - Output to dist/ directory
```

### 4. Deploy to Cloudflare

```bash
# Deploy to production
npm run deploy

# Deploy with specific environment
wrangler deploy --env production

# Deploy with custom name
wrangler deploy --name atomic-guide-production
```

### 5. Verify Deployment

```bash
# Test deployment
curl https://your-domain.com/health

# Check worker logs
npm run tail

# Test LTI endpoints
curl https://your-domain.com/lti/config
```

## Domain Configuration

### 1. Custom Domain Setup

```bash
# Add custom domain (requires domain in Cloudflare)
wrangler route add "guide.yourdomain.com/*" atomic-guide

# Or use subdomain
wrangler route add "*.yourdomain.com/guide/*" atomic-guide
```

### 2. SSL Configuration

SSL certificates are automatically managed by Cloudflare. Ensure:

- Domain DNS is proxied through Cloudflare (orange cloud)
- SSL/TLS mode is set to "Full (strict)"
- Always Use HTTPS is enabled

### 3. Update wrangler.jsonc

```jsonc
{
  "routes": [
    {
      "pattern": "guide.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

## Performance Optimization

### 1. Caching Configuration

```typescript
// Set cache headers for static assets
export function handleStaticAssets(request: Request): Response {
  const url = new URL(request.url);
  
  if (url.pathname.startsWith('/assets/')) {
    return new Response(asset, {
      headers: {
        'Content-Type': getContentType(url.pathname),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': generateETag(asset)
      }
    });
  }
}
```

### 2. Bundle Optimization

```typescript
// vite.config.ts optimization
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'lti-vendor': ['@atomicjolt/lti-endpoints'],
          'ui-vendor': ['@headlessui/react', '@heroicons/react']
        }
      }
    },
    minify: 'terser',
    sourcemap: false // Disable for production
  }
});
```

### 3. Worker Optimization

```typescript
// Optimize cold start performance
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Cache frequently used services
    const services = await initializeServices(env);
    
    // Use waitUntil for non-critical tasks
    ctx.waitUntil(logAnalytics(request));
    
    return await handleRequest(request, env, services);
  }
};
```

## Monitoring Setup

### 1. Worker Analytics

Enable Worker Analytics in Cloudflare dashboard:
- Go to Workers & Pages > atomic-guide > Analytics
- Enable detailed analytics
- Set up custom metrics

### 2. Real User Monitoring (RUM)

```typescript
// Client-side RUM
if (typeof window !== 'undefined') {
  window.cloudflareRum = {
    token: 'your-rum-token',
    endpoint: 'https://cloudflareinsights.com/cdn-cgi/rum'
  };
}
```

### 3. Custom Metrics

```typescript
// Track custom metrics
export async function trackCustomMetric(
  name: string, 
  value: number, 
  env: Env
): Promise<void> {
  await env.ANALYTICS_QUEUE.send({
    metric: name,
    value,
    timestamp: Date.now()
  });
}
```

## Troubleshooting

### Common Deployment Issues

#### 1. KV Namespace Errors
```bash
# Error: KV namespace not found
# Solution: Verify namespace IDs in wrangler.jsonc
wrangler kv:namespace list
```

#### 2. Database Connection Errors
```bash
# Error: D1 database not found
# Solution: Check database binding
wrangler d1 list
npm run db:status
```

#### 3. Build Errors
```bash
# Error: TypeScript compilation failed
# Solution: Fix TypeScript errors
npm run types
tsc --noEmit
```

#### 4. Asset Loading Issues
```bash
# Error: Assets not found
# Solution: Check manifest generation
npm run build
ls -la public/assets/
```

### Debugging Production Issues

```bash
# Stream live logs
npm run tail

# Check specific error logs
wrangler tail --format=pretty --search="ERROR"

# Monitor specific worker
wrangler tail atomic-guide --env production
```

### Performance Issues

```bash
# Check worker CPU time
wrangler analytics --metric cpu-time

# Check memory usage
wrangler analytics --metric memory-usage

# Check request volume
wrangler analytics --metric requests
```

## Security Considerations

### 1. Secrets Management
- Never commit secrets to version control
- Use `wrangler secret` command for sensitive data
- Rotate secrets regularly
- Use different secrets for different environments

### 2. CORS Configuration
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://yourdomain.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};
```

### 3. Rate Limiting
```typescript
// Implement rate limiting
const rateLimiter = new Map<string, number>();

export function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimiter.get(clientIP) || 0;
  
  if (now - lastRequest < 1000) { // 1 request per second
    return false;
  }
  
  rateLimiter.set(clientIP, now);
  return true;
}
```

## Rollback Strategy

### 1. Deployment Rollback
```bash
# Deploy previous version
wrangler deploy --compatibility-date=2024-01-01

# Or deploy specific version from git
git checkout previous-working-commit
npm run deploy
```

### 2. Database Rollback
```bash
# Rollback database migration
npm run db:rollback

# Check rollback status
npm run db:status
```

### 3. Emergency Procedures
```bash
# Quick rollback script
#!/bin/bash
echo "Rolling back deployment..."
git checkout main~1  # Go back one commit
npm run build
wrangler deploy --name atomic-guide-rollback
echo "Rollback complete"
```