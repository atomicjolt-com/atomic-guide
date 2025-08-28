# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

- `npm run dev` - Start local development server with Vite
- `npm run preview` - Build and preview production build locally
- `npm run build` - Build production bundle with TypeScript compilation and manifest injection
- `npm run check` - Validate TypeScript, build, and do a dry-run deployment
- `npm run deploy` - Build and deploy to Cloudflare Workers
- `npm test` - Run Vitest test suite
- `npm run test:integration` - Run integration tests
- `npm run lint` - Run ESLint on .ts,.tsx,.js,.jsx files
- `npm run lint-fix` - Run ESLint with automatic fixes
- `npm run tail` - Stream live logs from deployed worker
- `npm run types` - Generate Wrangler types

### Database Management

```bash
npm run db:create          # Create atomic-guide-db D1 database
npm run db:destroy         # Delete atomic-guide-db D1 database
npm run db:reset           # Destroy, create, migrate and seed database
npm run db:migrate         # Run database migrations locally
npm run db:migrate:remote  # Run migrations on remote database
npm run db:rollback        # Rollback database to previous version
npm run db:status          # Check migration status
npm run db:query           # Interactive SQL console for D1 database
npm run db:list            # List all database tables
npm run db:seed            # Seed database with test data (local)
npm run db:seed:remote     # Seed remote database
npm run db:setup           # Create D1 database and update wrangler.jsonc
npm run db:export          # Export database to backup.sql
npm run db:local           # Execute commands on local database
```

### Infrastructure Setup

```bash
npm run db:setup      # Create D1 database and update wrangler.jsonc
npm run kv:setup      # Create all KV namespaces
npm run kv:destroy    # Clean up KV namespaces
```

### Testing Commands

```bash
npm test                      # Run all tests
npm test -- --watch          # Run tests in watch mode
npm test -- StreamButton.test.tsx  # Run specific test file
npm run test:integration     # Run integration tests
```

### Testing

- Run all tests: `npm test`
- Run tests in watch mode: `npm test -- --watch`
- Run a specific test file: `npm test -- path/to/test.ts`

The application can be viewed by visiting `http://localhost:5988/test`.
Use PlayWright MCP to visit this url for testing

### Code Quality

- Format code: `npx prettier --write .`
- Check formatting: `npx prettier --check .`
- Lint code: `npx eslint .`
- Type check: `tsc` or `npm run check`

## Architecture Overview

This application is built on [Atomic LTI Worker](https://github.com/atomicjolt-com/atomic-lti-worker) which provides a complete foundation for working with LTI Applications.

This is a Cloudflare Workers-based LTI 1.3 tool implementation using a serverless edge architecture:

This LTI tool is designed as a single page application (SPA).

If you need/want to make changes to the code that handles the LTI launch or if you need to store or modify values server side look at the code in:
`src/index.ts`

The client code can be found in:
`client/app.tsx`

This is the entry point for the client side React application.

The server will pass settings to the client using `window.LAUNCH_SETTINGS` which by default is of type `LaunchSettings`. If you need to pass additonal data to the client LaunchSettings can be extended to include any additional required information. The most useful values provided by `window.LAUNCH_SETTINGS` will be `window.LAUNCH_SETTINGS.jwt` and ``window.LAUNCH_SETTINGS.deepLinking`. API calls back to the server will require the jwt be passed in the Authorization header. Examples of how to use `window.LAUNCH_SETTINGS` can be seen in client/app.tsx. The React application is wrapped in ">LtiLaunchCheck>". This code should not be changed.

### Technology Stack

This project is build using vite, specifically `@cloudflare/vite-plugin` which handles both server and client side code.

- **Runtime**: Cloudflare Workers (Edge compute platform)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Real-time**: Durable Objects (WebSocket state management)
- **AI Services**: Workers AI (allows for interactions with modules)
- **Vector Search**: Cloudflare Vectorize (https://developers.cloudflare.com/vectorize/)
- **Frontend**: React 19 + TypeScript

### Project Structure

```
/Users/jbasdf/projects/atomic-guide/
├── client/                    # Client-side React application
├── src/                      # Server-side Cloudflare Worker code
├── tests/                    # Test suite organization
├── docs/                     # Comprehensive project documentation
├── scripts/                  # Database and infrastructure scripts
├── migrations/               # D1 database schema migrations
├── seeds/                    # Database seed data
├── public/                   # Static assets and build output
└── Configuration files
```

#### Server-Side Architecture (`src/`)

The server-side code follows a modular Hono-based architecture:

- **`src/index.ts`** - Main Cloudflare Worker entry point with Hono app setup
- **`src/api/handlers/`** - API endpoint handlers for chat, content, dashboard, FAQ, and suggestions
- **`src/services/`** - Business logic services including AI, content analysis, learning patterns, and database operations
- **`src/durable-objects/`** - Cloudflare Durable Objects for stateful operations (chat conversations, struggle detection)
- **`src/html/`** - HTML template generators for various LTI pages (launch, registration, etc.)
- **`src/db/`** - Database utilities and connection management
- **`src/libs/`** - Utility libraries for encryption and manifest handling
- **`src/utils/`** - Response formatting, sanitization, and tokenization utilities
- **`src/config.ts`** - Tool configuration for LTI dynamic registration
- **`src/register.ts`** - Platform registration handling
- **`src/tool_jwt.ts`** - JWT token management

#### Client-Side Architecture (`client/`)

The client-side is a modern React 19 application with Redux Toolkit:

- **`client/app.tsx`** - Main LTI launch application entry point
- **`client/app-init.ts`** - OIDC initialization handler
- **`client/home.ts`** - Home page entry point
- **`client/components/`** - React component organization:
  - `chat/` - Chat interface components (FAB, window, messages, rich media)
  - `content/` - Content awareness and privacy controls
  - `dashboard/` - Analytics and learning insights
  - `settings/` - User preference components
- **`client/pages/`** - Page-level components (student dashboard)
- **`client/store/`** - Redux Toolkit store configuration:
  - `api/` - RTK Query API definitions
  - `slices/` - Redux state slices (chat, JWT)
- **`client/hooks/`** - Custom React hooks for content extraction and LMS integration
- **`client/services/`** - Client-side services (LMS content extractor)
- **`client/styles/`** - CSS modules for component styling
- **`client/utils/`** - Client utilities (retry logic)

#### Testing Organization (`tests/`)

Comprehensive test coverage organized by concern:

- **`tests/api/`** - API endpoint testing
- **`tests/components/`** - React component tests
- **`tests/services/`** - Business logic service tests
- **`tests/store/`** - Redux state management tests
- **`tests/integration/`** - End-to-end integration tests
- **`tests/performance/`** - Performance benchmarks
- **`tests/security/`** - Security validation tests

#### Key Configuration Files

- **`package.json`** - Project dependencies and comprehensive npm scripts
- **`wrangler.jsonc`** - Cloudflare Workers configuration with KV namespaces, D1 database, Durable Objects, AI binding, and Vectorize index
- **`vite.config.ts`** - Build configuration with multiple entry points (app, appInit, home)
- **`definitions.ts`** - Central constants for LTI paths, application name, and service URLs
- **`tsconfig.*.json`** - TypeScript configurations for different build targets (app, worker, node)
- **`eslint.config.js`** - ESLint configuration for code quality
- **`vitest.config.ts`** - Test framework configuration

#### Database and Infrastructure

- **`migrations/`** - SQL schema migrations for D1 database
- **`seeds/`** - Database seed data for development and testing
- **`scripts/`** - Automation scripts:
  - Database management (create, migrate, seed, query)
  - KV namespace setup and cleanup
  - Manifest injection for cache busting
  - D1 database setup automation

#### Static Assets (`public/`)

- **`public/assets/`** - Vite-built application bundles with cache-busted filenames
- **`public/images/`** - Brand assets and icons
- **Favicons and PWA manifests** - Complete icon set for different platforms

#### Documentation (`docs/`)

Extensive documentation organized by concern:

- **`docs/architecture/`** - Technical architecture documentation
- **`docs/branding/`** - Design principles and style guide
- **`docs/prd/`** - Product requirements and specifications
- **`docs/qa/`** - Quality assurance gates and assessments
- **`docs/stories/`** - User story definitions

#### Notable Patterns and Conventions

1. **Separation of Concerns**: Clear boundaries between server (Cloudflare Worker) and client (React SPA) code
2. **Entry Point Strategy**: Multiple Vite entry points for different application modes (LTI launch, home page, OIDC init)
3. **Service Architecture**: Modular service layer with dependency injection patterns
4. **Type Safety**: Comprehensive TypeScript configuration with strict typing
5. **Testing Strategy**: Multi-layered testing approach (unit, integration, performance, security)
6. **Infrastructure as Code**: Automated scripts for database and KV namespace management
7. **LTI Compliance**: Built on Atomic Jolt's LTI foundation with standard endpoint patterns
8. **Edge Computing**: Leverages Cloudflare's edge platform (Workers, D1, Durable Objects, AI, Vectorize)

### Core Components

1. **Server-Side (Cloudflare Worker)**
   - Entry point: `src/index.ts` - Hono app handling all LTI routes and services
   - LTI endpoints managed via `@atomicjolt/lti-endpoints` package
   - State management through Cloudflare KV namespaces and Durable Objects
   - Dynamic registration support with configurable tool settings

2. **Client-Side (SPA)**
   - Entry points: `client/app.tsx` (LTI launch), `client/home.ts` (home page), `client/app-init.ts` (OIDC init)
   - Built with Vite, deployed as static assets
   - Handles post-launch interactions including deep linking and names/roles services

3. **Configuration**
   - `definitions.ts`: Central constants for paths, names, and URLs
   - `src/config.ts`: Tool configuration for dynamic registration
   - `wrangler.jsonc`: Cloudflare Workers deployment configuration

### Key Service Bindings

- `DB`: D1 database for persistent storage
- `VIDEO_STORAGE`: R2 bucket for video files
- `AI`: Workers AI for transcription and embeddings
- `VIDEO_QUEUE`: Queue for async video processing
- `FAQ_INDEX`: Vector index for semantic search

### LTI 1.3 Integration

The application implements full LTI 1.3 support with:

- Dynamic registration at `/lti/register`
- OIDC authentication flow
- JWT validation with platform JWKS
- Names and Role Provisioning Service (NRPS)
- Assignment and Grade Services (AGS)
- Deep Linking support

Key LTI endpoints are defined in `/src/index.ts` and use the `@atomicjolt/lti-*` packages.

#### Storage Architecture (Cloudflare KV)

These are used by the LTI launch process and should not be modified or deleted

- `KEY_SETS`: Tool's RSA key pairs for JWT signing
- `REMOTE_JWKS`: Cached platform JWK sets
- `CLIENT_AUTH_TOKENS`: OAuth client credentials
- `PLATFORMS`: Platform configurations from dynamic registration
- `OIDC_STATE` (Durable Object): Manages OIDC state during authentication flow

#### LTI Flow

1. Platform initiates at `/lti/init` with OIDC authentication request
2. Worker validates and redirects to platform's auth endpoint
3. Platform returns to `/lti/redirect` with auth response
4. Worker validates JWT and redirects to `/lti/launch` with state
5. Launch page validates and loads client application

#### Key LTI Integration Points

- Dynamic registration: `/lti/register` endpoint for automatic platform setup
- Deep linking: Client-side handling with server JWT signing at `/lti/sign_deep_link`
- Names and roles service: `/lti/names_and_roles` for roster retrieval

### Key Integration Points

- Dynamic registration: `/lti/register` endpoint for automatic platform setup
- Deep linking: Client-side handling with server JWT signing at `/lti/sign_deep_link`
- Names and roles service: `/lti/names_and_roles` for roster retrieval
- Asset serving: Vite-built files served from `public/` with manifest injection
- The entry point for the front end, React application that is launched via LTI can be found in client/app.tsx
- The entry point for the application home page is client/home.ts

## Initial Setup

### KV Namespace Creation

If deploying manually (not using one-click deploy), create required KV namespaces:

```bash
# Tool key pairs
npx wrangler kv:namespace create KEY_SETS
npx wrangler kv:namespace create KEY_SETS --preview

# Platform JWK sets cache
npx wrangler kv:namespace create REMOTE_JWKS
npx wrangler kv:namespace create REMOTE_JWKS --preview

# Client auth tokens
npx wrangler kv:namespace create CLIENT_AUTH_TOKENS
npx wrangler kv:namespace create CLIENT_AUTH_TOKENS --preview

# Platform configurations
npx wrangler kv:namespace create PLATFORMS
npx wrangler kv:namespace create PLATFORMS --preview
```

Update `wrangler.jsonc` with the returned IDs.

### Dynamic Registration

- Registration URL: `https://yourdomain.com/lti/register`
- Tool configuration: `src/config.ts`
- Platform response handling: `src/register.ts`
- Tool definitions (names, URLs): `definitions.ts`

## Troubleshooting

### Common Issues

- **KV namespace errors**: Ensure IDs in `wrangler.jsonc` match created namespaces
- **JWKS endpoint failures**: Check platform configuration and network access
- **LTI launch failures**: Verify platform JWT validation and redirect URLs
- **Build failures**: Run `tsc` to check TypeScript errors before deployment
- **Asset loading issues**: Check manifest.json injection and public/ directory

### Debugging

- View logs: `npm run tail` or `npx wrangler tail`
- Check deployment: `npm run check` (dry-run deploy with validation)
- Test locally: `npm run dev` (http://localhost:8787)

## Important Context

- All LTI protocol handling is abstracted through `@atomicjolt/lti-*` packages
- Client scripts are injected dynamically based on manifest.json for cache busting
- Frame options are set to ALLOWALL for LMS iframe embedding
- TypeScript strict mode enforced - run `tsc` before deploying

## QA

## Visual Development

### Design Principles

- Comprehensive design checklist in `/context/design-principles.md`
- Brand style guide in `/context/style-guide.md`
- When making visual (front-end, UI/UX) changes, always refer to these files for guidance

### Quick Visual Check

IMMEDIATELY after implementing any front-end change:

1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against `/docs/branding/design-principles.md` and `/docs/branding/style-guide.md`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages`

This verification ensures changes meet design standards and user requirements.

### Comprehensive Design Review

Invoke the `@agent-design-review` subagent for thorough design validation when:

- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- Needing comprehensive accessibility and responsiveness testing

### Deployment Process

1. **Pre-deployment**: Run `npm run check` to verify build and types
2. **Database migrations**: Apply with `npm run db:migrate:remote`
3. **Deploy**: Use `npm run deploy` for production deployment
4. **Monitor**: Check logs with `npm run tail`
5. **Rollback**: Database supports versioned rollbacks via migration system
