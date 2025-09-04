# Configuration Guide

This guide covers all configuration options for Atomic Guide, including LTI setup, AI services, database settings, and environment variables.

## Configuration Files Overview

```
atomic-guide/
├── wrangler.jsonc          # Cloudflare Workers configuration
├── .env                    # Local environment variables
├── definitions.ts          # Application constants
├── src/config.ts          # LTI tool configuration
├── vite.config.ts         # Build configuration
└── tsconfig.*.json        # TypeScript configurations
```

## Cloudflare Configuration (wrangler.jsonc)

### Basic Configuration

```jsonc
{
  "name": "atomic-guide",
  "compatibility_date": "2024-08-21",
  "compatibility_flags": ["nodejs_compat"],
  "main": "src/index.ts",

  // Your Cloudflare account ID
  "account_id": "YOUR_ACCOUNT_ID",

  // Development settings
  "workers_dev": true,
  "port": 5988,
}
```

### Database Configuration

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "atomic-guide-db",
      "database_id": "YOUR_DATABASE_ID",
    },
  ],
}
```

### KV Namespaces

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "KEY_SETS",
      "id": "YOUR_KV_ID",
      "preview_id": "YOUR_PREVIEW_ID",
    },
    {
      "binding": "REMOTE_JWKS",
      "id": "YOUR_KV_ID",
    },
    {
      "binding": "CLIENT_AUTH_TOKENS",
      "id": "YOUR_KV_ID",
    },
    {
      "binding": "PLATFORMS",
      "id": "YOUR_KV_ID",
    },
  ],
}
```

### AI Services

```jsonc
{
  "ai": {
    "binding": "AI",
  },

  "vectorize": {
    "indexes": [
      {
        "binding": "FAQ_INDEX",
        "index_name": "faq-embeddings",
      },
    ],
  },
}
```

### Durable Objects

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "OIDC_STATE",
        "class_name": "OidcStateDurableObject",
        "script_name": "atomic-guide",
      },
      {
        "name": "CHAT_SESSIONS",
        "class_name": "ChatSessionDurableObject",
        "script_name": "atomic-guide",
      },
    ],
  },
}
```

### Environment-Specific Configuration

```jsonc
{
  "env": {
    "staging": {
      "name": "atomic-guide-staging",
      "vars": {
        "ENVIRONMENT": "staging",
        "LOG_LEVEL": "debug",
      },
    },
    "production": {
      "name": "atomic-guide-production",
      "vars": {
        "ENVIRONMENT": "production",
        "LOG_LEVEL": "info",
      },
      "routes": [
        {
          "pattern": "guide.yourdomain.com/*",
          "custom_domain": true,
        },
      ],
    },
  },
}
```

## LTI Configuration

### Tool Configuration (src/config.ts)

```typescript
export const ltiConfig = {
  // Tool Identity
  title: 'Atomic Guide',
  description: 'AI-Powered Educational Assistant',

  // LTI Version
  lti_version: '1.3.0',

  // Tool Capabilities
  messages: [
    {
      type: 'LtiResourceLinkRequest',
      target_link_uri: 'https://guide.atomicjolt.xyz/lti/launch',
      label: 'Launch Atomic Guide',
    },
    {
      type: 'LtiDeepLinkingRequest',
      target_link_uri: 'https://guide.atomicjolt.xyz/lti/deep_link',
      label: 'Select Content',
    },
  ],

  // Supported Placements
  placements: [
    {
      placement: 'course_navigation',
      message_type: 'LtiResourceLinkRequest',
      label: 'Atomic Guide',
    },
    {
      placement: 'assignment_selection',
      message_type: 'LtiDeepLinkingRequest',
      label: 'Add Assessment',
    },
  ],

  // Required Scopes
  scopes: [
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
    'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
  ],
};
```

### Platform Registration

```typescript
// Dynamic registration endpoint
const REGISTRATION_URL = 'https://guide.atomicjolt.xyz/lti/register';

// Manual registration values
const TOOL_CONFIG = {
  oidc_initiation_url: 'https://guide.atomicjolt.xyz/lti/init',
  target_link_uri: 'https://guide.atomicjolt.xyz/lti/launch',
  redirect_uris: ['https://guide.atomicjolt.xyz/lti/redirect'],
  public_jwks_url: 'https://guide.atomicjolt.xyz/lti/jwks',
};
```

## Environment Variables

### Development (.env)

```bash
# Node Environment
NODE_ENV=development

# Logging
LOG_LEVEL=debug

# LTI Settings
LTI_TOOL_NAME="Atomic Guide Development"
LTI_TOOL_DOMAIN="localhost:5988"

# AI Configuration
AI_MODEL="@cf/meta/llama-3-8b-instruct"
EMBEDDING_MODEL="@cf/baai/bge-base-en-v1.5"

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_DEEP_LINKING=true
ENABLE_GRADE_PASSBACK=true

# Development Tools
ENABLE_DEBUG_PANEL=true
MOCK_AI_RESPONSES=false
```

### Production Secrets

Set via Wrangler CLI:

```bash
# API Keys
wrangler secret put OPENAI_API_KEY
wrangler secret put ANALYTICS_KEY

# Database
wrangler secret put DATABASE_URL

# Security
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
```

## Application Constants (definitions.ts)

```typescript
export const APP_CONSTANTS = {
  // Application Identity
  APP_NAME: 'Atomic Guide',
  APP_VERSION: '1.0.0',

  // URLs
  APP_URL: process.env.APP_URL || 'https://guide.atomicjolt.xyz',
  API_BASE_URL: '/api',

  // Paths
  LTI_PATH: '/lti',
  EMBED_PATH: '/embed',
  HOME_PATH: '/',

  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 seconds
  WEBSOCKET_TIMEOUT: 300000, // 5 minutes

  // Limits
  MAX_MESSAGE_LENGTH: 10000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOKENS: 4096,

  // Cache
  CACHE_TTL: 3600, // 1 hour
  JWKS_CACHE_TTL: 86400, // 24 hours
};
```

## Feature Flags

### Configuration

```typescript
export const FEATURES = {
  // Core Features
  CHAT: {
    enabled: true,
    streaming: true,
    maxHistory: 50,
  },

  ASSESSMENTS: {
    enabled: true,
    aiGeneration: true,
    deepLinking: true,
  },

  ANALYTICS: {
    enabled: true,
    realtime: true,
    exportEnabled: false,
  },

  // Experimental
  EXPERIMENTAL: {
    voiceInput: false,
    collaborativeEdit: false,
    advancedVisualization: false,
  },
};
```

### Runtime Toggle

```typescript
// Check feature flag
if (FEATURES.CHAT.streaming) {
  // Use streaming response
}

// Environment-based
const analyticsEnabled = env.ENVIRONMENT === 'production' && FEATURES.ANALYTICS.enabled;
```

## Security Configuration

### CORS Settings

```typescript
export const CORS_CONFIG = {
  origin: ['https://canvas.instructure.com', 'https://*.instructure.com', 'http://localhost:5988'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};
```

### Content Security Policy

```typescript
export const CSP_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' wss: https:",
    'frame-ancestors *',
  ].join('; '),
};
```

## Performance Configuration

### Cache Settings

```typescript
export const CACHE_CONFIG = {
  // Browser Cache
  staticAssets: 'public, max-age=31536000',
  apiResponses: 'private, max-age=0, must-revalidate',

  // Edge Cache
  kvCache: {
    ttl: 3600,
    cacheControl: 's-maxage=3600',
  },

  // Service Worker
  swCache: {
    strategies: {
      images: 'cache-first',
      api: 'network-first',
      static: 'cache-first',
    },
  },
};
```

### Rate Limiting

```typescript
export const RATE_LIMITS = {
  // API Endpoints
  chat: {
    requests: 100,
    window: 60, // seconds
  },

  assessment: {
    requests: 10,
    window: 300,
  },

  // WebSocket
  websocket: {
    connections: 5,
    messages: 100,
    window: 60,
  },
};
```

## Build Configuration (vite.config.ts)

```typescript
export default defineConfig({
  plugins: [react(), cloudflare()],

  build: {
    // Output settings
    outDir: 'public',
    assetsDir: 'assets',

    // Optimization
    minify: 'terser',
    sourcemap: true,

    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'redux-vendor': ['@reduxjs/toolkit'],
          'ui-vendor': ['@headlessui/react'],
        },
      },
    },
  },

  // Development server
  server: {
    port: 5988,
    host: true,
    hmr: true,
  },
});
```

## TypeScript Configuration

### Application Code (tsconfig.app.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["./src/shared/*"],
      "@features/*": ["./src/features/*"]
    }
  }
}
```

## Monitoring Configuration

### Logging Levels

```typescript
export const LOG_LEVELS = {
  development: 'debug',
  staging: 'info',
  production: 'warn',
};

// Usage
const logger = new Logger({
  level: LOG_LEVELS[env.ENVIRONMENT] || 'info',
});
```

### Analytics

```typescript
export const ANALYTICS_CONFIG = {
  enabled: env.ENVIRONMENT === 'production',
  provider: 'cloudflare-analytics',
  events: {
    pageView: true,
    userAction: true,
    apiCall: true,
    error: true,
  },
};
```

## Custom Configuration

### Per-Institution Settings

```typescript
// Store in KV or D1
const INSTITUTION_CONFIG = {
  'canvas.university.edu': {
    features: {
      chat: true,
      assessments: false,
    },
    branding: {
      primaryColor: '#003366',
      logo: '/custom/university-logo.png',
    },
  },
};
```

### User Preferences

```typescript
// Stored in localStorage
const USER_PREFERENCES = {
  theme: 'light',
  fontSize: 'medium',
  notifications: true,
  autoSave: true,
};
```

## Validation

### Configuration Schema

```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  features: z.object({
    chat: z.boolean(),
    assessments: z.boolean(),
    analytics: z.boolean(),
  }),
});

// Validate on startup
const config = ConfigSchema.parse(rawConfig);
```

## Next Steps

- [Development Setup](../development/setup.md) - Configure your development environment
- [Deployment Guide](../deployment/cloudflare.md) - Deploy to production
- [API Reference](../api/endpoints.md) - API configuration details
