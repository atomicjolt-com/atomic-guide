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

## TypeScript Configuration (STRICT REQUIREMENTS) Assume strict requirements even if project settings are looser

### MUST follow These Compiler Options

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "allowJs": false
  }
}
```

### MANDATORY Type Requirements

- **NEVER use `any` type** - use `unknown` if type is truly unknown
- **MUST have explicit return types** for all functions and components
- **MUST use proper generic constraints** for reusable components
- **MUST use type inference from Zod schemas** using `z.infer<typeof schema>`
- **NEVER use `@ts-ignore`** or `@ts-expect-error` - fix the type issue properly

### Type Safety Hierarchy (STRICT ORDER)

1. **Specific Types**: Always prefer specific types when possible
2. **Generic Constraints**: Use generic constraints for reusable code
3. **Unknown**: Use `unknown` for truly unknown data that will be validated
4. **Never `any`**: The only exception is library declaration merging (must be commented)

### TypeScript Project Structure (MANDATORY)

- **App Code**: `tsconfig.app.json` - covers src/ directory
- **Node Config**: `tsconfig.node.json` - MUST include vite.config.ts, vitest.config.ts
- **ESLint Integration**: MUST reference both in parserOptions.project

### Branded Type Safety (MANDATORY)

- **MUST use Schema.parse() to convert plain types to branded types**
- **NEVER assume external data matches branded types**
- **Always validate at system boundaries**

```typescript
// ✅ CORRECT: Convert plain types to branded types
const cvId = CVIdSchema.parse(numericId);

// ❌ FORBIDDEN: Assuming type without validation
const cvId: CVId = numericId; // Type assertion without validation
```

### ExactOptionalPropertyTypes Compliance (MANDATORY)

- **MUST handle `undefined` vs `null` properly** in API interfaces
- **MUST use conditional spreads** instead of passing `undefined` to optional props
- **MUST convert `undefined` to `null`** for API body types

```typescript
// ✅ CORRECT: Handle exactOptionalPropertyTypes properly
const apiCall = async (data?: string) => {
  return fetch('/api', {
    method: 'POST',
    body: data ? JSON.stringify({ data }) : null,  // null, not undefined
  });
};

// Conditional prop spreading for optional properties
<Input
  label="Email"
  error={errors.email?.message}
  {...(showHelper ? { helperText: "Enter valid email" } : {})}  // Conditional spread
/>

// ❌ FORBIDDEN: Passing undefined to optional properties
<Input
  label="Email"
  error={errors.email?.message}
  helperText={showHelper ? "Enter valid email" : undefined}  // undefined not allowed
/>
```

## Assets

- Asset serving: Vite-built files served from `public/` with manifest injection
- images, css and other static assets should be placed in `public/`

## 🎨 React

### Component Structure (MANDATORY)

- **MAXIMUM 200 lines** per component file
- **Single responsibility** principle - one component, one purpose
- **Co-locate related files** - styles, tests, types in same folder
- **Export one component** per file as default
- **Name files** matching the component name

### Component Integration (STRICT REQUIREMENTS)

- **MUST verify actual prop names** before using components
- **MUST use exact callback parameter types** from component interfaces
- **NEVER assume prop names match semantic expectations**
- **MUST import proper types** for callback parameters

```typescript
// ✅ CORRECT: Verify component interface and use exact prop names
import { EducationList } from './EducationList';
import { EducationSummary } from './schemas';

<EducationList
  cvId={cvId}
  onSelectEducation={(education: EducationSummary) => handleEdit(education.id)}
  onCreateEducation={() => handleCreate()}
  showCreateButton={showActions}  // Verified actual prop name
/>

// ❌ FORBIDDEN: Assuming prop names without verification
<EducationList
  onEditEducation={(education) => handleEdit(education.id)}  // Wrong prop name
  onAddEducation={() => handleCreate()}  // Wrong prop name
/>
```

### Performance Guidelines

#### React 19 Optimizations

- **Trust the compiler** - avoid manual memoization
- **Use Suspense** for data fetching boundaries
- **Implement code splitting** at route level
- **Lazy load** heavy components

#### Bundle Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'form-vendor': ['react-hook-form', 'zod'],
        },
      },
    },
  },
});
```

#### Performance by Default

With React 19's compiler, manual optimizations are largely unnecessary. Focus on clean, readable code and let the compiler handle performance optimizations.

#### Design Principles (MUST FOLLOW)

- **Vertical Slice Architecture**: MUST organize by features, not layers
- **Composition Over Inheritance**: MUST use React's composition model

### 🚀 React 19 Key Features

#### Automatic Optimizations

- **React Compiler**: Eliminates need for `useMemo`, `useCallback`, and `React.memo`
- Let the compiler handle performance - write clean, readable code

#### Core Features

- **Server Components**: Use for data fetching and static content
- **Actions**: Handle async operations with built-in pending states
- **use() API**: Simplified data fetching and context consumption
- **Document Metadata**: Native support for SEO tags
- **Enhanced Suspense**: Better loading states and error boundaries

#### React 19 TypeScript Integration (MANDATORY)

- **MUST use `ReactElement` instead of `JSX.Element`** for return types
- **MUST import `ReactElement` from 'react'** explicitly
- **NEVER use `JSX.Element` namespace** - use React types directly

```typescript
// ✅ CORRECT: Modern React 19 typing
import { ReactElement } from 'react';

function MyComponent(): ReactElement {
  return <div>Content</div>;
}

const renderHelper = (): ReactElement | null => {
  return condition ? <span>Helper</span> : null;
};

// ❌ FORBIDDEN: Legacy JSX namespace
function MyComponent(): JSX.Element {
  // Cannot find namespace 'JSX'
  return <div>Content</div>;
}
```

#### State Management Example

```typescript
/**
 * @fileoverview User list with proper state management hierarchy
 */

// 1. Local state for UI
const [selectedTab, setSelectedTab] = useState<'active' | 'archived'>('active');

// 2. Context for feature settings
const { viewMode } = useListContext();

// 3. Server state for data
const { data: users, isLoading } = useQuery({
  queryKey: ['users', selectedTab],
  queryFn: () => fetchUsers(selectedTab),
});

// 4. Global state for auth (if needed)
const { currentUser } = useAuthStore();

// 5. URL state for filters
const [searchParams] = useSearchParams();
const filter = searchParams.get('filter');
```

#### Actions Example (WITH MANDATORY DOCUMENTATION)

````typescript
/**
 * @fileoverview Contact form using React 19 Actions API
 * @module features/contact/components/ContactForm
 */

import { useActionState, ReactElement } from 'react';

/**
 * Contact form component using React 19 Actions.
 *
 * Leverages the Actions API for automatic pending state management
 * and error handling. Form data is validated with Zod before submission.
 *
 * @component
 * @example
 * ```tsx
 * <ContactForm onSuccess={() => router.push('/thank-you')} />
 * ```
 */
function ContactForm(): ReactElement {
  /**
   * Form action handler with built-in state management.
   *
   * @param previousState - Previous form state (unused in this implementation)
   * @param formData - Raw form data from submission
   * @returns Promise resolving to success or error state
   */
  const [state, submitAction, isPending] = useActionState(async (previousState: any, formData: FormData) => {
    // Extract and validate form data
    const result = contactSchema.safeParse({
      email: formData.get('email'),
      message: formData.get('message'),
    });

    if (!result.success) {
      return { error: result.error.flatten() };
    }

    // Process validated data
    await sendEmail(result.data);
    return { success: true };
  }, null);

  return (
    <form action={submitAction}>
      <button disabled={isPending}>{isPending ? 'Sending...' : 'Send'}</button>
    </form>
  );
}
````

#### Instant UI Patterns

- Use Suspense boundaries for ALL async operations
- Leverage Server Components for data fetching
- Use the new Actions API for form handling
- Let React Compiler handle optimization

#### Component Templates

````typescript
// Quick component with all states
export function FeatureComponent(): ReactElement {
  const { data, isLoading, error } = useQuery({
    queryKey: ['feature'],
    queryFn: fetchFeature
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorBoundary error={error} />;
  if (!data) return <EmptyState />;

  return <FeatureContent data={data} />;
}

## 🛡️ Data Validation with Zod (MANDATORY FOR ALL EXTERNAL DATA)

### MUST Follow These Validation Rules
- **MUST validate ALL external data**: API responses, form inputs, URL params, environment variables
- **MUST use branded types**: For all IDs and domain-specific values
- **MUST fail fast**: Validate at system boundaries, throw errors immediately
- **MUST use type inference**: Always derive TypeScript types from Zod schemas
- **NEVER trust external data** without validation
- **MUST validate before using** any data from outside the application

### Schema Example (MANDATORY PATTERNS)
```typescript
import { z } from 'zod';

// MUST use branded types for ALL IDs
const UserIdSchema = z.string().uuid().brand<'UserId'>();
type UserId = z.infer<typeof UserIdSchema>;

// MUST include validation for ALL fields
export const userSchema = z.object({
  id: UserIdSchema,
  email: z.string().email(),
  username: z.string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  age: z.number().min(18).max(100),
  role: z.enum(['admin', 'user', 'guest']),
  metadata: z.object({
    lastLogin: z.string().datetime(),
    preferences: z.record(z.unknown()).optional(),
  }),
});

export type User = z.infer<typeof userSchema>;

// MUST validate ALL API responses
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    error: z.string().optional(),
    timestamp: z.string().datetime(),
  });
````

#### Form Validation with React Hook Form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function UserForm(): ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<User>({
    resolver: zodResolver(userSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: User): Promise<void> => {
    // Handle validated data
  };

  return <form onSubmit={handleSubmit(onSubmit)}>{/* Form fields */}</form>;
}
```

### 🔄 React State Management Hierarchy

#### MUST Follow This State Hierarchy (STRICT ORDER)

1. **Local State (useState)**
   - Component-specific UI state
   - Form field values before submission
   - Toggle states, modal visibility

   ```typescript
   const [isOpen, setIsOpen] = useState(false);
   ```

2. **Context (Feature-level)**
   - Cross-component state within a single feature
   - Theme preferences, user settings
   - Feature-specific configuration

   ```typescript
   const ThemeContext = createContext<Theme>('light');
   ```

3. **Server State (TanStack Query)**
   - ALL API data fetching and caching
   - Optimistic updates
   - Background refetching

   ```typescript
   const { data, isLoading } = useQuery({
     queryKey: ['user', id],
     queryFn: fetchUser,
     staleTime: 5 * 60 * 1000,
   });
   ```

4. **Global State (Zustand)**
   - ONLY when truly needed app-wide
   - User authentication state
   - App-wide notifications

   ```typescript
   const useAuthStore = create((set) => ({
     user: null,
     login: (user) => set({ user }),
     logout: () => set({ user: null }),
   }));
   ```

5. **URL State (Search Params)**
   - Shareable application state
   - Filters, pagination, search queries
   - Navigation state
   ```typescript
   const [searchParams, setSearchParams] = useSearchParams();
   const page = searchParams.get('page') || '1';
   ```

## 🧪 Testing Strategy

### Testing Requirements

- **Minimum 80% code coverage** - NO EXCEPTIONS
- **Co-locate tests** in `__tests__` folders next to components
- **Use React Testing Library** for all component tests
- **Test user behavior**, not implementation details
- **Mock external dependencies** appropriately
- **NEVER skip tests** for new features or bug fixes

### Test Execution

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
npm run test:coverage      # Full coverage analysis
```

### Test Example

```typescript
/**
 * @fileoverview Tests for UserProfile component
 * @module features/user/__tests__/UserProfile.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@testing-library/react';

describe('UserProfile', () => {
  it('should update user name on form submission', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(<UserProfile onUpdate={onUpdate} />);

    const input = screen.getByLabelText(/name/i);
    await user.type(input, 'John Doe');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'John Doe' }));
  });
});
```

## 📊 Code Quality Standards

### SonarQube Quality Gates (MUST PASS)

- **Cognitive Complexity**: MAX 15 per function
- **Cyclomatic Complexity**: MAX 10 per function
- **Duplicated Lines**: MAX 3%
- **Technical Debt Ratio**: MAX 5%
- **Critical Issues**: ZERO tolerance

### Component Requirements

- **MAX 200 lines** per component file
- **Single responsibility** principle
- **Handle ALL states**: loading, error, empty, success
- **Include ARIA labels** for accessibility

### ESLint Rules (MANDATORY)

```javascript
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "sonarjs/cognitive-complexity": ["error", 15],
    "sonarjs/no-duplicate-string": ["error", 3]
  }
}
```

## 📝 Documentation Standards

### JSDoc Requirements (MANDATORY)

- **Document ALL exports** with full JSDoc
- **Include @fileoverview** for each module
- **Add @param** for every parameter with description
- **Add @returns** with description (unless void)
- **Include @throws** for any thrown errors
- **Include @example** for complex functions
- **Document component props** with descriptions
- **Use @deprecated** with migration path when deprecating
- **NEVER use single-line comments** for documentation

### Documentation Example

````typescript
/**
 * @fileoverview User authentication service handling login, logout, and session management.
 * @module features/auth/services/authService
 */

/**
 * Calculates the discount price for a product.
 *
 * This method applies a percentage discount to the original price,
 * ensuring the final price doesn't go below the minimum threshold.
 *
 * @param originalPrice - The original price of the product in cents (must be positive)
 * @param discountPercent - The discount percentage (0-100)
 * @param minPrice - The minimum allowed price after discount in cents
 * @returns The calculated discount price in cents
 * @throws {ValidationError} If any parameter is invalid
 *
 * @example
 * ```typescript
 * const discountedPrice = calculateDiscount(10000, 25, 1000);
 * console.log(discountedPrice); // 7500
 * ```
 */
export function calculateDiscount(originalPrice: number, discountPercent: number, minPrice: number): number {
  if (originalPrice <= 0) {
    throw new ValidationError('Original price must be positive');
  }
  const discountAmount = originalPrice * (discountPercent / 100);
  const discountedPrice = originalPrice - discountAmount;
  return Math.max(discountedPrice, minPrice);
}
````

### Component Documentation

````typescript
/**
 * Button component with multiple variants and sizes.
 *
 * Provides a reusable button with consistent styling and behavior
 * across the application. Supports keyboard navigation and screen readers.
 *
 * @component
 * @example
 * ```tsx
 * <Button
 *   variant="primary"
 *   size="medium"
 *   onClick={handleSubmit}
 * >
 *   Submit Form
 * </Button>
 * ```
 */
interface ButtonProps {
  /** Visual style variant of the button */
  variant: 'primary' | 'secondary';

  /** Size of the button @default 'medium' */
  size?: 'small' | 'medium' | 'large';

  /** Click handler for the button */
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /** Content to be rendered inside the button */
  children: React.ReactNode;

  /** Whether the button is disabled @default false */
  disabled?: boolean;
}
````

## 🔐 Security Requirements

### Input Validation (MUST IMPLEMENT ALL)

- **MUST sanitize ALL user inputs** with Zod before processing
- **MUST validate file uploads**: type, size, and content
- **MUST prevent XSS** with proper escaping
- **MUST implement CSP headers** in production
- **NEVER use dangerouslySetInnerHTML** without sanitization
- **NEVER trust external data** without validation

### API Security

- **MUST validate ALL API responses** with Zod schemas
- **MUST handle errors gracefully** without exposing internals
- **NEVER log sensitive data** (passwords, tokens, PII)
- **MUST use HTTPS** for all external API calls
- **MUST implement rate limiting** for public endpoints
- **MUST validate JWT tokens** before processing requests

### Secure Coding Practices

```typescript
// ✅ CORRECT: Validate and sanitize user input
const handleUserInput = async (input: unknown): Promise<void> => {
  const validated = userInputSchema.parse(input);
  // Process validated data
};

// ❌ FORBIDDEN: Direct use of untrusted data
const handleUserInput = async (input: any): Promise<void> => {
  await db.query(`SELECT * FROM users WHERE id = ${input.id}`);
};

// ✅ CORRECT: Safe error handling
try {
  await performOperation();
} catch (error) {
  console.error('Operation failed', {
    type: error instanceof Error ? error.name : 'Unknown',
    timestamp: new Date().toISOString(),
  });
  throw new UserFacingError('Operation could not be completed');
}
```

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

- Comprehensive design checklist in `/ai_docs/branding/design-principles.md`
- Brand style guide in `/ai_docs/branding/style-guide.md`
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

## Context Awareness

- When implementing features, always check existing patterns first
- Prefer composition over inheritance in all designs
- Use existing utilities before creating new ones
- Check for similar functionality in other domains/features

## Common Pitfalls to Avoid

- Creating duplicate functionality
- Overwriting existing tests
- Modifying core frameworks without explicit instruction
- Adding dependencies without checking existing alternatives

## Workflow Patterns

- Prefferably create tests BEFORE implementation (TDD)
- Use "think hard" for architecture decisions
- Break complex tasks into smaller, testable units
- Validate understanding before implementation

## Search Command Requirements

**CRITICAL**: Always use `rg` (ripgrep) instead of traditional `grep` and `find` commands:

```bash
# ❌ Don't use grep
grep -r "pattern" .

# ✅ Use rg instead
rg "pattern"

# ❌ Don't use find with name
find . -name "*.tsx"

# ✅ Use rg with file filtering
rg --files | rg "\.tsx$"
# or
rg --files -g "*.tsx"
```

**Enforcement Rules:**

```
(
    r"^grep\b(?!.*\|)",
    "Use 'rg' (ripgrep) instead of 'grep' for better performance and features",
),
(
    r"^find\s+\S+\s+-name\b",
    "Use 'rg --files | rg pattern' or 'rg --files -g pattern' instead of 'find -name' for better performance",
),
```
