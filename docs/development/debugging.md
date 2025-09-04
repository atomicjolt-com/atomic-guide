# Debugging Guide

Comprehensive guide for debugging Atomic Guide applications, including common issues, debugging tools, and troubleshooting strategies.

## Debugging Tools

### Browser DevTools

#### Chrome DevTools Setup

1. **Open DevTools**: F12 or Right-click → Inspect
2. **Enable Source Maps**: Settings → Sources → Enable JavaScript source maps
3. **Preserve Network Log**: Network tab → Preserve log checkbox
4. **Enable Async Stack Traces**: Settings → Console → Show async stack traces

#### Essential DevTools Panels

- **Console**: JavaScript errors and logs
- **Network**: API calls and responses
- **Sources**: Breakpoints and code stepping
- **Performance**: Runtime performance analysis
- **Memory**: Memory leaks and usage
- **React DevTools**: Component tree and props

### VS Code Debugging

#### Launch Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Vite Dev Server",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5988",
      "webRoot": "${workspaceFolder}",
      "sourceMaps": true,
      "sourceMapPathOverrides": {
        "/@fs/*": "${workspaceFolder}/*"
      }
    },
    {
      "name": "Debug Node Process",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

#### Breakpoint Types

- **Standard Breakpoints**: Click line number
- **Conditional Breakpoints**: Right-click → Add Conditional Breakpoint
- **Logpoints**: Right-click → Add Logpoint
- **Exception Breakpoints**: Breakpoints panel → Caught/Uncaught Exceptions

## Common Issues & Solutions

### Build & Compilation Issues

#### TypeScript Errors

```bash
# Check for type errors
npm run check

# Common fixes:
# 1. Clear TypeScript cache
rm -rf node_modules/.cache/typescript

# 2. Restart TS server in VS Code
Cmd+Shift+P → "TypeScript: Restart TS Server"

# 3. Check tsconfig.json paths
cat tsconfig.json | grep "paths" -A 5
```

#### Module Resolution Issues

```typescript
// Debug module resolution
console.log('Module paths:', import.meta.url);
console.log('Resolved:', new URL('./module', import.meta.url));

// Common solutions:
// 1. Check path aliases in tsconfig.json
// 2. Verify vite.config.ts resolve.alias
// 3. Clear node_modules and reinstall
```

### Runtime Errors

#### React Component Errors

```typescript
// Add error boundary for debugging
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Component Error:', error);
    console.error('Stack:', errorInfo.componentStack);

    // Log to error service
    logError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Error details: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}
```

#### Async/Promise Errors

```typescript
// Debug unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent default browser behavior
  event.preventDefault();
});

// Debug async functions
async function debugAsync() {
  try {
    console.log('Starting async operation');
    const result = await someAsyncOperation();
    console.log('Result:', result);
    return result;
  } catch (error) {
    console.error('Async error:', error);
    console.trace(); // Print stack trace
    throw error;
  }
}
```

### API & Network Issues

#### Debug API Requests

```typescript
// Intercept fetch for debugging
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log('Fetch request:', args);
  const response = await originalFetch(...args);
  console.log('Fetch response:', response.status, response);
  return response;
};

// Debug with curl
// Copy as cURL from Network tab, then:
curl -v 'http://localhost:5988/api/chat' \
  -H 'Content-Type: application/json' \
  -d '{"message":"test"}'
```

#### CORS Issues

```typescript
// Debug CORS headers
app.use((c, next) => {
  console.log('Request origin:', c.req.header('Origin'));
  console.log('Request method:', c.req.method);

  // Log CORS headers being set
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  console.log('Setting CORS headers:', headers);
  Object.entries(headers).forEach(([key, value]) => {
    c.header(key, value);
  });

  return next();
});
```

### Database Issues

#### D1 Database Debugging

```bash
# Check database state
npm run db:list
npm run db:status

# Query database directly
npm run db:query
> .tables
> .schema users
> SELECT * FROM users LIMIT 10;

# Debug migrations
wrangler d1 migrations list atomic-guide-db
```

#### Database Query Debugging

```typescript
// Log SQL queries
class DatabaseDebugger {
  async query(sql: string, params?: any[]) {
    console.group('SQL Query');
    console.log('Query:', sql);
    console.log('Params:', params);
    console.time('Execution time');

    try {
      const result = await db
        .prepare(sql)
        .bind(...params)
        .all();
      console.log('Result count:', result.results.length);
      console.timeEnd('Execution time');
      console.groupEnd();
      return result;
    } catch (error) {
      console.error('Query error:', error);
      console.groupEnd();
      throw error;
    }
  }
}
```

### Cloudflare Workers Issues

#### Worker Debugging

```bash
# Enable debug logging
WRANGLER_LOG=debug npm run dev

# Tail production logs
npm run tail

# Filter logs
npm run tail -- --status error
npm run tail -- --search "user-123"

# Pretty print logs
npm run tail -- --format pretty
```

#### Durable Objects Debugging

```typescript
// Debug Durable Object state
export class DebugDurableObject {
  constructor(state: DurableObjectState) {
    this.state = state;

    // Log all storage operations
    const originalGet = this.state.storage.get.bind(this.state.storage);
    this.state.storage.get = async (key: string) => {
      const value = await originalGet(key);
      console.log(`DO Storage GET: ${key} = ${JSON.stringify(value)}`);
      return value;
    };
  }

  async fetch(request: Request) {
    console.log('DO Request:', request.method, request.url);
    const response = await this.handleRequest(request);
    console.log('DO Response:', response.status);
    return response;
  }
}
```

## Performance Debugging

### React Performance

```typescript
// Enable React Profiler
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  console.log(`Component ${id} (${phase}) took ${actualDuration}ms`);
}

<Profiler id="ChatWindow" onRender={onRenderCallback}>
  <ChatWindow />
</Profiler>
```

### Memory Debugging

```javascript
// Monitor memory usage
setInterval(() => {
  if (performance.memory) {
    const mb = 1024 * 1024;
    console.table({
      'Used JS Heap': `${(performance.memory.usedJSHeapSize / mb).toFixed(2)} MB`,
      'Total JS Heap': `${(performance.memory.totalJSHeapSize / mb).toFixed(2)} MB`,
      'Heap Limit': `${(performance.memory.jsHeapSizeLimit / mb).toFixed(2)} MB`
    });
  }
}, 5000);

// Find memory leaks
class MemoryLeakDetector {
  private snapshots: WeakMap<object, number> = new WeakMap();

  track(obj: object) {
    this.snapshots.set(obj, performance.now());
  }

  checkLeaks() {
    // Force garbage collection (Chrome DevTools)
    if (global.gc) {
      global.gc();
    }
    // Check if objects are still in memory
  }
}
```

### Bundle Size Debugging

```bash
# Analyze bundle size
npm run build -- --analyze

# Check individual chunk sizes
ls -lah dist/assets/*.js

# Find large dependencies
npm list --depth=0 | awk '{print $2}' | xargs -I {} sh -c 'echo "{}: $(npm view {} size)"'
```

## Logging Strategies

### Structured Logging

```typescript
class Logger {
  private context: Record<string, any> = {};

  setContext(context: Record<string, any>) {
    this.context = { ...this.context, ...context };
  }

  log(level: string, message: string, data?: any) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(log, null, 2));
    } else {
      console.log(JSON.stringify(log));
    }
  }

  error(message: string, error?: Error) {
    this.log('error', message, {
      error: error?.message,
      stack: error?.stack,
    });
  }
}
```

### Debug Utilities

```typescript
// Debug helper functions
export const debug = {
  // Log with timestamp
  log: (...args: any[]) => {
    console.log(`[${new Date().toISOString()}]`, ...args);
  },

  // Log and return value (for chain debugging)
  tap: <T>(value: T, label?: string): T => {
    console.log(label || 'Debug:', value);
    return value;
  },

  // Time execution
  time: async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    console.time(label);
    try {
      const result = await fn();
      console.timeEnd(label);
      return result;
    } catch (error) {
      console.timeEnd(label);
      throw error;
    }
  },

  // Trace function calls
  trace: (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
      console.log(`Calling ${propertyKey} with:`, args);
      const result = original.apply(this, args);
      console.log(`${propertyKey} returned:`, result);
      return result;
    };
  },
};

// Usage examples:
const data = await debug.tap(fetchData(), 'Fetched data');
const result = await debug.time('Processing', () => processData(data));

class Service {
  @debug.trace
  async process(input: string) {
    return input.toUpperCase();
  }
}
```

## Environment-Specific Debugging

### Development Environment

```typescript
// Enable dev-only debugging
if (import.meta.env.DEV) {
  // Add debug panel
  import('./debug/DebugPanel').then(({ DebugPanel }) => {
    const root = document.createElement('div');
    root.id = 'debug-panel';
    document.body.appendChild(root);
    ReactDOM.render(<DebugPanel />, root);
  });

  // Expose debugging tools globally
  window.debug = {
    store: () => console.log(store.getState()),
    clearCache: () => localStorage.clear(),
    resetDB: () => fetch('/api/debug/reset', { method: 'POST' })
  };
}
```

### Production Debugging

```typescript
// Safe production logging
class ProductionLogger {
  log(level: string, message: string, data?: any) {
    // Only log errors and warnings in production
    if (level === 'error' || level === 'warn') {
      // Send to logging service
      fetch('/api/logs', {
        method: 'POST',
        body: JSON.stringify({ level, message, data }),
      });
    }
  }
}

// Feature flags for debugging
const DEBUG_FLAGS = {
  logApiCalls: searchParams.get('debug_api') === 'true',
  logStateChanges: searchParams.get('debug_state') === 'true',
  showPerformance: searchParams.get('debug_perf') === 'true',
};
```

## Quick Debugging Checklist

### When Things Go Wrong

1. **Check Browser Console**
   - Look for red errors
   - Check network tab for failed requests
   - Review console warnings

2. **Verify Environment**

   ```bash
   node --version  # Should be v18+
   npm --version   # Should be v9+
   npm run check   # TypeScript errors?
   ```

3. **Check Services**

   ```bash
   # Is dev server running?
   lsof -i :5988

   # Database accessible?
   npm run db:query

   # Wrangler authenticated?
   wrangler whoami
   ```

4. **Clear Caches**

   ```bash
   rm -rf .wrangler
   rm -rf node_modules/.cache
   rm -rf public/assets
   npm run build
   ```

5. **Review Recent Changes**
   ```bash
   git status
   git diff
   git log --oneline -10
   ```

## Getting Help

### Error Messages

When asking for help, provide:

1. **Full error message** including stack trace
2. **Steps to reproduce** the issue
3. **Environment details** (OS, Node version, etc.)
4. **Recent changes** that might be related

### Resources

- [GitHub Issues](https://github.com/atomicjolt-com/atomic-guide/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/cloudflare-workers)
- [Cloudflare Discord](https://discord.gg/cloudflaredev)

## Next Steps

- [Testing Guide](./testing.md) - Debug test failures
- [Commands Reference](./commands.md) - Debugging commands
- [Setup Guide](./setup.md) - Environment troubleshooting
