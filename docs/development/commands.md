# Development Commands Reference

Complete reference for all npm scripts and CLI commands used in Atomic Guide development.

## Core Development Commands

### Development Server

```bash
npm run dev
```

Starts the Vite development server with hot module replacement (HMR).

- URL: `http://localhost:5988`
- Watches for file changes
- Provides instant updates

### Build

```bash
npm run build
```

Creates production-optimized build with:

- TypeScript compilation
- Minification and tree-shaking
- Asset optimization
- Manifest injection for cache busting

### Preview

```bash
npm run preview
```

Preview the production build locally before deployment.

### Type Checking

```bash
npm run check
```

Validates TypeScript types and performs a dry-run deployment.

### Deployment

```bash
npm run deploy
```

Deploys to Cloudflare Workers (requires authentication).

## Database Commands

### Setup & Management

| Command              | Description                                  |
| -------------------- | -------------------------------------------- |
| `npm run db:create`  | Create atomic-guide-db D1 database           |
| `npm run db:destroy` | Delete atomic-guide-db D1 database           |
| `npm run db:reset`   | Destroy, create, migrate and seed database   |
| `npm run db:setup`   | Create D1 database and update wrangler.jsonc |

### Migrations

| Command                     | Description                           |
| --------------------------- | ------------------------------------- |
| `npm run db:migrate`        | Run database migrations locally       |
| `npm run db:migrate:remote` | Run migrations on remote database     |
| `npm run db:rollback`       | Rollback database to previous version |
| `npm run db:status`         | Check migration status                |

### Data Operations

| Command                  | Description                             |
| ------------------------ | --------------------------------------- |
| `npm run db:seed`        | Seed database with test data (local)    |
| `npm run db:seed:remote` | Seed remote database                    |
| `npm run db:query`       | Interactive SQL console for D1 database |
| `npm run db:list`        | List all database tables                |
| `npm run db:export`      | Export database to backup.sql           |
| `npm run db:local`       | Execute commands on local database      |

### Example Usage

```bash
# Full database reset with fresh data
npm run db:reset

# Check what migrations need to run
npm run db:status

# Run SQL queries interactively
npm run db:query
> SELECT * FROM users LIMIT 10;
> .tables
> .schema users
```

## Infrastructure Commands

### KV Namespace Management

```bash
# Create all KV namespaces
npm run kv:setup

# Clean up KV namespaces
npm run kv:destroy
```

Creates/destroys these namespaces:

- `KEY_SETS` - Tool RSA key pairs
- `REMOTE_JWKS` - Cached platform JWK sets
- `CLIENT_AUTH_TOKENS` - OAuth tokens
- `PLATFORMS` - Platform configurations

### Logs & Monitoring

```bash
# Stream live logs from deployed worker
npm run tail

# Filter logs by status
npm run tail -- --status error

# Show logs from specific time
npm run tail -- --since 2024-01-01
```

## Testing Commands

### Test Execution

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- StreamButton.test.tsx

# Run tests matching pattern
npm test -- --grep "chat"

# Run with coverage
npm test -- --coverage
```

### Test Types

```bash
# Integration tests
npm run test:integration

# Run tests in UI mode
npm test -- --ui

# Update snapshots
npm test -- -u
```

### Coverage Reports

```bash
# Generate coverage report
npm test -- --coverage

# Open coverage in browser
npm test -- --coverage --reporter=html
open coverage/index.html
```

## Code Quality Commands

### Linting

```bash
# Run ESLint
npm run lint

# Run with automatic fixes
npm run lint-fix

# Lint specific directory
npx eslint src/features/chat
```

### Formatting

```bash
# Check formatting
npx prettier --check .

# Format all files
npx prettier --write .

# Format specific file types
npx prettier --write "**/*.{ts,tsx}"
```

### Type Generation

```bash
# Generate Wrangler types
npm run types

# Generate types for Workers bindings
wrangler types
```

## Development Workflows

### Feature Development

```bash
# 1. Start dev server
npm run dev

# 2. Run tests in watch mode (new terminal)
npm test -- --watch

# 3. Check types continuously (new terminal)
npx tsc --watch --noEmit
```

### Database Development

```bash
# 1. Create migration file
touch migrations/003_add_feature.sql

# 2. Apply migration locally
npm run db:migrate

# 3. Test migration
npm run db:query

# 4. Apply to remote
npm run db:migrate:remote
```

### Pre-Commit Checklist

```bash
# 1. Run all checks
npm run check

# 2. Run tests
npm test

# 3. Check formatting
npm run lint

# 4. Build to verify
npm run build
```

## Environment-Specific Commands

### Development

```bash
# Start with debug logging
LOG_LEVEL=debug npm run dev

# Use different port
npm run dev -- --port 3000

# Enable HTTPS
npm run dev -- --https
```

### Staging

```bash
# Deploy to staging
wrangler deploy --env staging

# View staging logs
wrangler tail --env staging
```

### Production

```bash
# Production deployment
npm run deploy

# Production logs
wrangler tail --env production

# Rollback deployment
wrangler rollback
```

## Utility Commands

### Clean & Reset

```bash
# Clean node_modules
rm -rf node_modules package-lock.json
npm install

# Clean build artifacts
rm -rf dist public/assets

# Reset everything
npm run db:reset
rm -rf node_modules dist
npm install
```

### Debugging

```bash
# Debug Wrangler
WRANGLER_LOG=debug npm run dev

# Debug Node
NODE_OPTIONS='--inspect' npm run dev

# Verbose npm
npm run dev --verbose
```

### Performance

```bash
# Analyze bundle size
npm run build -- --analyze

# Profile build time
time npm run build

# Memory usage
NODE_OPTIONS='--max-old-space-size=4096' npm run build
```

## Custom Scripts

### Add New Migration

```bash
# Create timestamped migration
echo "-- Migration: $(date +%Y%m%d_%H%M%S)" > migrations/$(date +%Y%m%d_%H%M%S)_description.sql
```

### Backup Database

```bash
# Export local database
npm run db:export

# Backup with timestamp
npm run db:export && mv backup.sql backup_$(date +%Y%m%d_%H%M%S).sql
```

### Check Dependencies

```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Audit for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

## Troubleshooting Commands

### Common Issues

```bash
# Port already in use
lsof -i :5988
kill -9 <PID>

# Clear Wrangler cache
rm -rf .wrangler

# Reset npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Diagnostic Commands

```bash
# Check Node version
node --version

# Check npm version
npm --version

# Check Wrangler version
wrangler --version

# List npm scripts
npm run

# Check environment
env | grep -E "(NODE|NPM|WRANGLER)"
```

## Command Aliases

Add to your shell profile for quick access:

```bash
# ~/.bashrc or ~/.zshrc
alias ag='cd ~/projects/atomic-guide'
alias agdev='npm run dev'
alias agtest='npm test -- --watch'
alias agbuild='npm run build'
alias agdeploy='npm run deploy'
alias agdb='npm run db:query'
alias aglogs='npm run tail'
```

## VS Code Tasks

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Dev Server",
      "type": "npm",
      "script": "dev",
      "problemMatcher": [],
      "isBackground": true
    },
    {
      "label": "Run Tests",
      "type": "npm",
      "script": "test",
      "problemMatcher": [],
      "group": {
        "kind": "test",
        "isDefault": true
      }
    }
  ]
}
```

## Next Steps

- [Testing Guide](./testing.md) - Deep dive into testing
- [Debugging Guide](./debugging.md) - Troubleshooting tips
- [Setup Guide](./setup.md) - Development environment configuration
