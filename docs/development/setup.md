# Development Environment Setup

Complete guide for setting up your Atomic Guide development environment with all tools, extensions, and configurations.

## Prerequisites

### Required Software

| Software | Minimum Version | Check Command        | Installation                        |
| -------- | --------------- | -------------------- | ----------------------------------- |
| Node.js  | v18.0.0         | `node --version`     | [nodejs.org](https://nodejs.org/)   |
| npm      | v9.0.0          | `npm --version`      | Comes with Node.js                  |
| Git      | v2.0.0          | `git --version`      | [git-scm.com](https://git-scm.com/) |
| Wrangler | Latest          | `wrangler --version` | `npm install -g wrangler`           |

### Recommended Software

- **VS Code** or **WebStorm** - IDE with TypeScript support
- **Postman** or **Insomnia** - API testing
- **TablePlus** or **DB Browser** - SQLite database viewer
- **Chrome DevTools** - Debugging and profiling

## Initial Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/atomic-guide.git
cd atomic-guide

# Add upstream remote
git remote add upstream https://github.com/atomicjolt-com/atomic-guide.git
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Install global tools
npm install -g wrangler
npm install -g typescript
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
code .env
```

Required environment variables:

```bash
NODE_ENV=development
LOG_LEVEL=debug
PORT=5988
```

### 4. Cloudflare Setup

```bash
# Login to Cloudflare
wrangler login

# Get your account ID
wrangler whoami
```

Update `wrangler.jsonc`:

```jsonc
{
  "account_id": "YOUR_ACCOUNT_ID_HERE",
}
```

### 5. Database Setup

```bash
# Create D1 database
npm run db:setup

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed

# Verify database
npm run db:list
```

### 6. KV Namespace Setup

```bash
# Create all KV namespaces
npm run kv:setup

# The script will output IDs - update wrangler.jsonc with them
```

## IDE Configuration

### Visual Studio Code

#### Required Extensions

```bash
# Install via command palette
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss
code --install-extension formulahendry.auto-rename-tag
```

#### Settings (.vscode/settings.json)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
    "**/.wrangler": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/public/assets": true
  }
}
```

#### Launch Configuration (.vscode/launch.json)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Dev Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "*"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test", "--", "--inspect"],
      "console": "integratedTerminal"
    }
  ]
}
```

### WebStorm / IntelliJ IDEA

#### Configuration

1. **TypeScript**:
   - Settings → Languages & Frameworks → TypeScript
   - TypeScript version: Use project's (`node_modules/typescript`)
   - Enable "Recompile on changes"

2. **ESLint**:
   - Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
   - Enable "Automatic ESLint configuration"

3. **Prettier**:
   - Settings → Languages & Frameworks → JavaScript → Prettier
   - Run on save: Enable

4. **File Watchers**:
   - Add watcher for TypeScript files
   - Program: `tsc`
   - Arguments: `--noEmit`

## Git Configuration

### Git Hooks Setup

```bash
# Install husky for git hooks
npm install -D husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm test"

# Add commit message hook
npx husky add .husky/commit-msg "npx commitlint --edit $1"
```

### Commit Convention

Follow conventional commits:

```bash
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Format code
refactor: Refactor code
test: Add tests
chore: Update dependencies
```

## Development Workflow

### 1. Start Development Servers

```bash
# Terminal 1: Vite dev server
npm run dev

# Terminal 2: TypeScript watch
npx tsc --watch --noEmit

# Terminal 3: Test watch
npm test -- --watch
```

### 2. Database Development

```bash
# Open SQL console
npm run db:query

# Watch for changes
npm run db:migrate -- --watch
```

### 3. API Development

Use the REST Client extension or curl:

```bash
# Test API endpoint
curl http://localhost:5988/api/health

# Test with authentication
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:5988/api/chat
```

## Browser Setup

### Chrome Extensions

Recommended extensions for development:

- **React Developer Tools** - Inspect React components
- **Redux DevTools** - Debug Redux state
- **Wappalyzer** - Identify technologies
- **JSON Viewer** - Format JSON responses
- **ModHeader** - Modify HTTP headers

### Chrome DevTools Settings

1. Enable source maps: Settings → Sources → Enable JavaScript source maps
2. Enable network throttling: Network tab → Throttling
3. Enable device emulation: Toggle device toolbar

## TypeScript Configuration

### Path Aliases

Configure in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@tests/*": ["tests/*"]
    }
  }
}
```

### Strict Mode Settings

Ensure these are enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Testing Environment

### Setup Test Database

```bash
# Create test database
wrangler d1 create atomic-guide-test

# Run migrations on test DB
DATABASE_NAME=atomic-guide-test npm run db:migrate
```

### Configure Test Environment

Create `test.env`:

```bash
NODE_ENV=test
DATABASE_NAME=atomic-guide-test
LOG_LEVEL=error
MOCK_AI=true
```

## Performance Profiling

### Setup Performance Monitoring

```bash
# Install performance tools
npm install -D lighthouse chrome-launcher

# Run performance audit
npx lighthouse http://localhost:5988 --view
```

### Memory Profiling

```javascript
// Add to development build
if (process.env.NODE_ENV === 'development') {
  window.profileMemory = () => {
    const memory = performance.memory;
    console.table({
      'Used JS Heap': `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
      'Total JS Heap': `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
      Limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
    });
  };
}
```

## Debugging Setup

### Node.js Debugging

```bash
# Debug with Chrome DevTools
node --inspect npm run dev

# Debug with VS Code
# Use launch configuration above
```

### React Debugging

```javascript
// Add to React components
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Component rendered:', { props, state });
  }
}, [props, state]);
```

### Worker Debugging

```bash
# Enable verbose logging
WRANGLER_LOG=debug npm run dev

# Use wrangler tail for production
npm run tail -- --format pretty
```

## Security Setup

### Environment Security

```bash
# Never commit .env files
echo ".env*" >> .gitignore

# Use secrets for sensitive data
wrangler secret put API_KEY
```

### SSL for Local Development

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Configure Vite for HTTPS
# vite.config.ts
server: {
  https: {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
  }
}
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :5988

# Kill process
kill -9 <PID>

# Or use different port
PORT=3000 npm run dev
```

#### TypeScript Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache/typescript

# Rebuild
npm run check
```

#### Database Issues

```bash
# Reset database
npm run db:reset

# Check database status
npm run db:status
```

### Getting Help

- Check [Debugging Guide](./debugging.md)
- Search [GitHub Issues](https://github.com/atomicjolt-com/atomic-guide/issues)
- Ask in [Discussions](https://github.com/atomicjolt-com/atomic-guide/discussions)

## Next Steps

- [Testing Guide](./testing.md) - Write and run tests
- [Commands Reference](./commands.md) - All available commands
- [API Development](../api/endpoints.md) - Build API endpoints
