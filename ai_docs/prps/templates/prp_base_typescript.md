name: "TypeScript PRP Template - Implementation-Focused with Precision Standards"
description: |

---

## Goal

**Feature Goal**: [Specific, measurable end state of what needs to be built]

**Deliverable**: [Concrete artifact - React component, API route, integration, etc.]

**Success Definition**: [How you'll know this is complete and working]

## User Persona (if applicable)

**Target User**: [Specific user type - developer, end user, admin, etc.]

**Use Case**: [Primary scenario when this feature will be used]

**User Journey**: [Step-by-step flow of how user interacts with this feature]

**Pain Points Addressed**: [Specific user frustrations this feature solves]

## Why

- [Business value and user impact]
- [Integration with existing features]
- [Problems this solves and for whom]

## What

[User-visible behavior and technical requirements]

### Success Criteria

- [ ] [Specific measurable outcomes]

## All Needed Context

### Context Completeness Check

_Before writing this PRP, validate: "If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- url: [Complete URL with section anchor]
  why: [Specific methods/concepts needed for implementation]
  critical: [Key insights that prevent common implementation errors]

- url: [https://docs.realtime.cloudflare.com/api#/]
  why: [Specific methods/concepts needed for using Cloudflare RealTimeKit APIs]
  critical: [Key documentation for API usage]

- url: [https://docs.realtime.cloudflare.com/web-core?framework=react]
  why: [Specific methods/concepts needed for using Cloudflare RealTimeKit React Core SDKs]
  critical: [Key documentation for RealTimeKit React Core SDK usage]

- url: [https://docs.realtime.cloudflare.com/react-ui-kit]
  why: [Specific methods/concepts needed for using Cloudflare RealTimeKit React UI Kit]
  critical: [Key documentation for RealTimeKit React UI Kit usage]

- file: [exact/path/to/pattern/file.tsx]
  why: [Specific pattern to follow - component structure, hook usage, etc.]
  pattern: [Brief description of what pattern to extract]
  gotcha: [Known constraints or limitations to avoid]

- docfile: [ai_docs/prps/research/typescript_specific.md]
  why: [Custom documentation for complex TypeScript/React patterns]
  section: [Specific section if document is large]
```

### Available MCP

Refer to context7-mcp to retrive documentation on packages and libraries as needed.

### Sequential thinking

Use sequential-thinking to record chain of thought and to track progress

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase

```bash

```

### Desired Codebase tree with files to be added and responsibility of file

```bash

```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: [Library name] requires [specific setup]
// Example: 'use client' directive must be at top of file, affects entire component tree
// Example: This application runs as a Cloudflare worker. Be aware of Cloudflare worker specific node requirements
// Example: We use TypeScript strict mode and require proper typing
```

## Implementation Blueprint

### Types

After modifying wrangler.jsonc or adding new env variables to .dev.vars you MUST generate new types:

```bash
npm run types
```

### Data models and structure

Create the core data models, we ensure type safety and consistency.

```typescript
Examples:
 - Zod schemas for validation
 - TypeScript interfaces/types
 - Database schema types
 - API response types
 - Component prop types

```

### Cloudflare D1

D1 is a SQLLite compliant database.

- New migrations should be added to /migrations in the form 0XXX_feature_name.sql
- After creating a new migration ensure it contains valid SQL and is idempotent

- New seed data may be added to /seeds in the form 0XXX_feature_seed.sql
- After creating a new seed ensure it contains valid SQL and is idempotent

```bash
# Run migrations
npm run db:migrate

# Run seeds
npm run db:seed`

# List db tables
npm run db:list

# run db query
npm run db:query
```

### Cloudflare KV

KV is a Cloudflare key-value store

### Cloudflare R2

R2 is available for file storage

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE src/routes/{route}.ts
  - IMPLEMENT: Hono route running on Cloudflare working
  - FOLLOW pattern: src/routes/{route.ts} (collection of related routes)
  - NAMING: Route exports, TypeScript props
  - DEPENDENCIES: Imports as needed
  - PLACEMENT: routes in src/routes/

Task 2: CREATE src/libs/{lib}.ts
  - IMPLEMENT: Libraries to support functionality required in the Cloudflare worker
  - FOLLOW pattern: src/libs/{lib.ts} (collection of related functionality)
  - NAMING: Function exports, TypeScript props
  - DEPENDENCIES: Imports as needed
  - PLACEMENT: Libraries in src/libs/

Task 3: CREATE src/db/{model}.ts
  - IMPLEMENT: Models for interacting with Cloudflare D1 database
  - FOLLOW pattern: src/db/{model.ts} (model with related SQL functionality)
  - NAMING: Function exports, TypeScript props
  - DEPENDENCIES: Imports as needed
  - PLACEMENT: Libraries in src/db/

Task 4: CREATE src/services/{service}.ts
  - IMPLEMENT: Services that support functionality required by routes
  - FOLLOW pattern: src/services/{service.ts} (service with related functionality. e.g. making db or api calls)
  - NAMING: Function exports, TypeScript props
  - DEPENDENCIES: Imports as needed
  - PLACEMENT: Libraries in src/services/

Task 5: CREATE types/{domain}.types.ts
  - IMPLEMENT: TypeScript interfaces and types for domain models. Used by both client and server.
  - FOLLOW pattern: types/existing.types.ts (interface structure, export patterns)
  - NAMING: PascalCase for interfaces, camelCase for properties
  - PLACEMENT: Type definitions in types/

Task 6: CREATE client/components/{domain}/{ComponentName}.tsx
  - IMPLEMENT: React component with proper TypeScript props interface
  - FOLLOW pattern: client/components/existing/ExistingComponent.tsx (component structure, props typing)
  - NAMING: PascalCase for components, camelCase for props, kebab-case for CSS classes
  - DEPENDENCIES: Import types from Task 1
  - PLACEMENT: Component layer in components/{domain}/

Task 7: CREATE client/lib/{resource}.ts
  - IMPLEMENT: utility libraries needed to support components
  - FOLLOW pattern: client/lib/existing.ts (utility libraries)
  - NAMING: Named exports, camelCase for functions, proper TypeScript typing
  - DEPENDENCIES: Import types and components from previous tasks
  - PLACEMENT: Functions client/lib/

Task 8: CREATE client/hooks/use{DomainAction}.ts
  - IMPLEMENT: Custom React hooks for state management and API calls
  - FOLLOW pattern: client/hooks/useExisting.ts (hook structure, TypeScript generics, error handling)
  - NAMING: use{ActionName} with proper TypeScript return types
  - DEPENDENCIES: Import types from Task 1, API endpoints from Task 3
  - PLACEMENT: Custom hooks in client/hooks/

Task 9: CREATE client/components/{domain}/{ComponentName}.test.tsx
  - IMPLEMENT: vitest tests for components and hooks
  - FOLLOW pattern: existing.test.tsx (test structure, mocking patterns)
  - NAMING: describe blocks, test naming conventions, TypeScript test typing
  - COVERAGE: All components and hooks with positive and negative test cases
  - PLACEMENT: Tests alongside the code they test

Task 10: CREATE src/test/{test_helper}.ts
  - IMPLEMENT: Test helpers
  - FOLLOW pattern: src/test/{test_helper.ts} (function to assist with common and reusable testing needs)
  - NAMING: Function exports, TypeScript props
  - DEPENDENCIES: Imports as needed
  - PLACEMENT: Libraries in src/test/
```

### Implementation Patterns & Key Details

```typescript
// Show critical patterns and gotchas - keep concise, focus on non-obvious details

// Example: Component pattern
interface {Domain}Props {
  // PATTERN: Strict TypeScript interfaces (follow lib/types/existing.types.ts)
  data: {Domain}Data;
  onAction?: (id: string) => void;
}

export function {Domain}Component({ data, onAction }: {Domain}Props) {
  // PATTERN: Client/Server component patterns (check existing components)
  // GOTCHA: 'use client' needed for event handlers, useState, useEffect
  // CRITICAL: Server Components for data fetching, Client Components for interactivity

  return (
    // PATTERN: Consistent styling approach (see components/ui/)
    <div className="existing-class-pattern">
      {/* Follow existing component composition patterns */}
    </div>
  );
}

// Example: API route pattern
export async function GET(request: Request): Promise<Response> {
  // PATTERN: Request validation and error handling (see src/routes/existing.ts)
  // GOTCHA: [TypeScript-specific constraint or Cloudflare Worker / Hono requirement]
  // RETURN: Response object with proper TypeScript typing
}

// Example: Custom hook pattern
export function use{Domain}Action(): {Domain}ActionResult {
  // PATTERN: Hook structure with TypeScript generics (see hooks/useExisting.ts)
  // GOTCHA: [React hook rules and TypeScript typing requirements]
}
```

### Integration Points

```yaml
DATABASE:
  - migration: "Add table 'feature_data' with proper indexes"
  - client: '@/lib/database/client'
  - pattern: 'createClient() for client components, createServerClient() for server components'

CONFIG:
  - add to: .env.local
  - pattern: 'NEXT_PUBLIC_* for client-side env vars'
  - pattern: "FEATURE_TIMEOUT = process.env.FEATURE_TIMEOUT || '30000'"

ROUTES:
  - file structure: app/feature-name/page.tsx
  - api routes: app/api/feature-name/route.ts
  - middleware: middleware.ts (root level)
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file creation - fix before proceeding
npm run lint                    # ESLint checks with TypeScript rules
npx tsc --noEmit               # TypeScript type checking (no JS output)
npm run format                 # Prettier formatting

# Project-wide validation
npm run lint:fix               # Auto-fix linting issues
npm run type-check             # Full TypeScript validation

# Expected: Zero errors. If errors exist, READ output and fix before proceeding.
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test each component/hook as it's created
npm test -- __tests__/{domain}.test.tsx
npm test -- __tests__/use{Hook}.test.ts

# Full test suite for affected areas
npm test -- components/{domain}/
npm test -- hooks/

# Coverage validation (if available)
npm test -- --coverage --watchAll=false

# Expected: All tests pass. If failing, debug root cause and fix implementation.
```

### Level 3: Integration Testing (System Validation)

```bash
# Development server validation
npm run dev &
sleep 5  # Allow server startup time

# Page load validation
curl -I http://localhost:3000/{feature-page}
# Expected: 200 OK response

# API endpoint validation
curl -X POST http://localhost:3000/api/{resource} \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  | jq .  # Pretty print JSON response

# Production build validation
npm run build
# Expected: Successful build with no TypeScript errors or warnings

# Component rendering validation (if SSR/SSG)
curl http://localhost:3000/{page} | grep -q "expected-content"

# Expected: All integrations working, proper responses, no hydration errors
```

### Level 4: Creative & Domain-Specific Validation

```bash
# TypeScript Specific Validation:

# Production build performance
npm run build && npm run check  # Bundle analyzer if available

# Type safety validation
npx tsc --noEmit --strict        # Strict TypeScript checking

npm run lint

# MCP Server Validation Examples:
# Playwright MCP (for E2E testing)
playwright-mcp --test-user-flows --browser chromium

# Custom TypeScript/React Validation
# React Testing Library integration tests
# Storybook visual regression tests (if available)
# TypeScript strict mode compliance

# Expected: All creative validations pass, performance/accessibility standards met
```

## Final Validation Checklist

### Technical Validation

- [ ] All 4 validation levels completed successfully
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run check`
- [ ] No formatting issues: `npm run format --check`
- [ ] Production build succeeds: `npm run build`

### Feature Validation

- [ ] All success criteria from "What" section met
- [ ] Manual testing successful: [specific commands from Level 3]
- [ ] Error cases handled gracefully with proper TypeScript error types
- [ ] Integration points work as specified
- [ ] User persona requirements satisfied (if applicable)

### Code Quality Validation

- [ ] Follows existing TypeScript/React patterns and naming conventions
- [ ] File placement matches desired codebase tree structure
- [ ] Anti-patterns avoided (check against Anti-Patterns section)
- [ ] Dependencies properly managed with correct TypeScript typings
- [ ] Configuration changes properly integrated

### TypeScript Specific

- [ ] Proper TypeScript interfaces and types defined
- [ ] Client component patterns followed correctly
- [ ] 'use client' directives used appropriately

### Documentation & Deployment

- [ ] Code is self-documenting with clear TypeScript types
- [ ] Props interfaces properly documented
- [ ] Environment variables documented if new ones added
- [ ] Project README.md has been updated to reflect code changes

### UIX validation

- [ ] All new UI is clean and functional
- [ ] User experience is tested and validated
- [ ] All UIX requirements have been met
- [ ] All UI complies with WCAG 2.1 standards

### Branding validation

- [ ] All css and visual elements comply with docs/branding/atomic-jolt-style-guide.pdf
- [ ] CSS is well formed and is added to public/styles.css
- [ ] Inline css is limited to edge cases. IMPORTANT!! do not use inline css.

---

## Anti-Patterns to Avoid

- ❌ Don't create new patterns when existing ones work
- ❌ Don't skip validation because "it should work"
- ❌ Don't ignore failing tests - fix them
- ❌ Don't hardcode values that should be config
- ❌ Don't catch all exceptions - be specific
