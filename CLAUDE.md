# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## 📖 Documentation Links

For detailed information, refer to:

- **[Architecture Documentation](./docs/architecture/)** - System design and patterns
- **[Development Guide](./docs/development/)** - Setup, testing, debugging
- **[React Guidelines](./docs/development/react-guidelines.md)** - React 19 development standards
- **[API Reference](./docs/api/)** - Endpoints and integration
- **[Vertical Slice Architecture](./docs/architecture/vertical-slice-refactoring.md)** - Code organization

## Quick Reference

### Development Commands
```bash
npm run dev          # Start development (http://localhost:5988/test)
npm run build        # Build for production
npm run deploy       # Deploy to Cloudflare Workers
npm test             # Run tests
npm run lint         # Lint code
npm run tail         # View live logs
npm run check        # Validate TypeScript + dry-run deploy
```

### Database Commands
```bash
npm run db:migrate         # Run local migrations
npm run db:migrate:remote  # Run remote migrations
npm run db:seed           # Seed local database
npm run db:query          # Interactive SQL console
npm run db:reset          # Destroy, create, migrate and seed
```

### Code Quality
```bash
npx prettier --write .     # Format code
npx eslint .              # Lint code
tsc                       # Type check
```

### Testing
- Run all tests: `npm test`
- Run tests in watch mode: `npm test -- --watch`
- Run specific test: `npm test -- path/to/test.ts`
- **Use Playwright MCP** to visit `http://localhost:5988/test` for testing

## ⚠️ MANDATORY Architecture Rules

### Repository Pattern (STRICT ENFORCEMENT)
```
Handler → Service → Repository → DatabaseService → D1 Database
```

**NEVER**:
- Access database directly from handlers/services
- Use `this.db.getDb()` in services
- Bypass repositories

**ALWAYS**:
- One repository per domain entity
- Test handlers with mocked services
- Test services with mocked repositories

### Example Implementation
```typescript
// ✅ CORRECT: Repository pattern
class UserHandler {
  constructor(private userService: UserService) {}
  
  async getUser(c: Context) {
    const user = await this.userService.getUser(id);
    return c.json(user);
  }
}

// ❌ FORBIDDEN: Direct database access
class ApiHandler {
  async getUser(c: Context) {
    const user = await this.db.get('SELECT * FROM users WHERE id = ?', [id]);
  }
}
```

### Project Structure (Vertical Slice)
```
src/
├── features/           # Feature-based vertical slices
│   └── [feature]/
│       ├── client/     # React components, hooks, store
│       ├── server/     # Handlers, services, repositories
│       └── shared/     # Types, schemas
└── shared/            # Cross-feature code
```

## LTI Architecture Overview

This is a **Cloudflare Workers-based LTI 1.3 tool** built on [Atomic LTI Worker](https://github.com/atomicjolt-com/atomic-lti-worker).

### Key LTI Components

**Server-side**: `src/index.ts` - Hono app handling all LTI routes and services
**Client-side**: `client/app.tsx` - React SPA launched via LTI
**LTI Data**: `window.LAUNCH_SETTINGS` - Server passes settings to client

### LTI Integration Points
- Dynamic registration: `/lti/register` endpoint
- Deep linking: Client-side with server JWT signing at `/lti/sign_deep_link`
- Names and roles: `/lti/names_and_roles` for roster retrieval

### Important LTI Context
- The server passes data via `window.LAUNCH_SETTINGS` (type `LaunchSettings`)
- Most useful values: `window.LAUNCH_SETTINGS.jwt` and `window.LAUNCH_SETTINGS.deepLinking`
- API calls require JWT in Authorization header
- React app is wrapped in `<LtiLaunchCheck>` - **DO NOT CHANGE**

## Technology Stack

- **Runtime**: Cloudflare Workers + D1 Database + Durable Objects
- **Framework**: Vite + React 19 + TypeScript (uses `@cloudflare/vite-plugin`)
- **LTI**: Built on Atomic LTI Worker
- **AI**: Workers AI + Vectorize
- **Assets**: Vite-built files served from `public/` with manifest injection

### Key Service Bindings
- `DB`: D1 database for persistent storage
- `VIDEO_STORAGE`: R2 bucket for video files
- `AI`: Workers AI for transcription and embeddings
- `VIDEO_QUEUE`: Queue for async video processing
- `FAQ_INDEX`: Vector index for semantic search

## 🔒 TypeScript Requirements (STRICT)

**MANDATORY**:
- Never use `any` - use `unknown`
- Explicit return types on all functions
- Use `z.infer<typeof schema>` for types
- Validate all external data with Zod
- Use branded types for IDs

### Branded Types Example
```typescript
const UserIdSchema = z.string().uuid().brand<'UserId'>();

// ✅ CORRECT: Validate and convert
const userId = UserIdSchema.parse(rawId);

// ❌ FORBIDDEN: Type assertion without validation  
const userId: UserId = rawId as UserId;
```

## ⚛️ React Guidelines

For comprehensive guidelines, see **[React Guidelines](./docs/development/react-guidelines.md)**.

**Component Rules**:
- Max 200 lines per file
- Single responsibility
- Use `ReactElement` return type (not `JSX.Element`)
- Co-locate tests with components

**State Hierarchy**:
1. Local state (useState)
2. Context (feature-level)
3. Server state (TanStack Query)
4. Global state (Zustand) - only when needed
5. URL state (search params)

## 🛡️ Data Validation (Zod)

**MUST validate ALL external data**: API responses, form inputs, URL params

```typescript
// API responses
const validated = userSchema.parse(await response.json());

// Branded IDs
const CVIdSchema = z.number().positive().brand<'CVId'>();
```

## 🧪 Testing Requirements

- **Minimum 80% coverage** - No exceptions
- Use React Testing Library for components
- Test behavior, not implementation
- Co-locate tests in `__tests__` folders

## 📝 Documentation Standards

- JSDoc for all exports
- Include `@fileoverview` for modules
- Document all parameters and returns
- Include `@example` for complex functions

## 🔐 Security Requirements

- Validate ALL external data with Zod
- Never trust user input
- No sensitive data in logs (passwords, tokens, PII)
- Use parameterized queries for database
- Validate JWT tokens before processing

## 🎨 Design & QA

- Design principles: `/docs/branding/design-principles.md`
- Style guide: `/docs/branding/style-guide.md`
- Use Playwright MCP for visual testing

### Quick Visual Check
After UI changes:
1. Navigate to affected pages
2. Verify against design docs
3. Take screenshots for evidence
4. Check console for errors

## 🔧 Key Files

- `definitions.ts` - LTI paths and constants
- `wrangler.jsonc` - Cloudflare configuration  
- `vite.config.ts` - Build configuration
- `window.LAUNCH_SETTINGS` - Client-side LTI data
- `public/` - Static assets (images, css) with manifest injection

## 🔍 Search Commands

**Always use `rg` (ripgrep) instead of `grep` or `find`:**
```bash
rg "pattern"              # Instead of: grep -r "pattern"
rg --files -g "*.tsx"    # Instead of: find . -name "*.tsx"
```

## ✅ Sanity Check

After making changes, verify the app works:
```
https://guide.atomicjolt.xyz/embed
```

## 🚨 Common Pitfalls

- Creating duplicate functionality
- Direct database access in handlers/services
- Using `any` type
- Forgetting to validate external data
- Not running lint/typecheck before commit
- Modifying `<LtiLaunchCheck>` wrapper

## 📚 Additional Resources

- [LTI Developer Guide](./docs/lti-developer-guide.md)
- [Coding Standards](./docs/architecture/coding-standards-and-conventions.md)
- [Testing Strategy](./docs/architecture/testing-strategy.md)
- [Security Integration](./docs/architecture/security-integration.md)