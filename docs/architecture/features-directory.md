# Features Directory - Vertical Slice Architecture

This document describes the feature-based vertical slice architecture used in Atomic Guide.

## Directory Structure

Each feature in `src/features/` follows a consistent self-contained structure:

```
[feature-name]/
├── client/           # Client-side code
│   ├── components/   # React components
│   ├── hooks/       # Feature-specific hooks
│   ├── store/       # Redux slices & RTK Query
│   └── services/    # Client services
├── server/          # Server-side code
│   ├── handlers/    # API route handlers
│   ├── services/    # Business logic
│   └── durable-objects/ # Stateful objects
├── shared/          # Feature-internal shared code
│   ├── types/       # TypeScript types
│   └── schemas/     # Zod schemas
└── tests/          # Feature tests
```

## Current Features

- **chat/** - AI-powered chat functionality with LaTeX and code support
- **assessment/** - Deep linking and AI-powered assessment generation
- **content/** - Content extraction and context awareness
- **dashboard/** - Analytics and learning insights visualization
- **lti/** - LTI protocol handling and platform integration
- **settings/** - User preferences and configuration
- **faq/** - Knowledge base with semantic search
- **learner-dna/** - Synthetic data generation for learning analytics

## Import Guidelines

### Within a Feature

Use relative imports for internal feature code:

```typescript
import { ChatWindow } from './components';
import { chatApi } from './store';
import type { ChatMessage } from './shared/types';
```

### From Shared Module

Use path aliases for cross-cutting concerns:

```typescript
import { AIService } from '@shared/server/services';
import { Button } from '@shared/client/components';
import { useAuth } from '@shared/client/hooks';
```

### Cross-Feature Imports (Discouraged)

Only import types when absolutely necessary:

```typescript
// Only for types, never for implementations
import type { ChatMessage } from '@features/chat/shared/types';
```

## Adding a New Feature

1. **Create directory structure** - Follow the standard layout above
2. **Move related code** - Migrate from legacy locations if applicable
3. **Create barrel exports** - Add index.ts files for clean imports
4. **Update imports** - Fix all import paths to use new structure
5. **Add documentation** - Document the feature in `/docs/features/`
6. **Add tests** - Include comprehensive test coverage

## Design Principles

### High Cohesion

Each feature contains all code related to its business domain:

- UI components specific to the feature
- API handlers and business logic
- Data schemas and types
- Tests for all layers

### Loose Coupling

Features should minimize dependencies:

- Communicate through well-defined APIs
- Share only through the `@shared` module
- Avoid circular dependencies
- Use events for cross-feature communication when needed

### Encapsulation

Features hide their internal implementation:

- Export only necessary public APIs
- Keep internal services private
- Use barrel exports to control visibility
- Document public interfaces clearly

## Benefits

1. **Developer Experience** - Easy to find and understand related code
2. **Team Scalability** - Teams can work on features independently
3. **Code Organization** - Clear boundaries and responsibilities
4. **Testing** - Feature-specific test suites
5. **Refactoring** - Changes isolated to feature boundaries
6. **Onboarding** - New developers can focus on specific features

## Migration Status

| Feature     | Status         | Notes                          |
| ----------- | -------------- | ------------------------------ |
| Chat        | ✅ Completed   | Fully migrated with tests      |
| Assessment  | ✅ Completed   | Deep linking integrated        |
| Content     | ⏳ In Progress | Extraction service ready       |
| Dashboard   | ✅ Completed   | Analytics integrated           |
| LTI         | ✅ Completed   | Protocol handling complete     |
| Settings    | ✅ Completed   | Preferences management ready   |
| FAQ         | ✅ Completed   | Semantic search operational    |
| Learner DNA | ✅ Completed   | Synthetic data framework ready |

## Best Practices

1. **Keep features focused** - Single responsibility per feature
2. **Minimize shared code** - Only truly cross-cutting concerns
3. **Document APIs** - Clear contracts between features
4. **Test boundaries** - Integration tests for feature interactions
5. **Version carefully** - Consider impact on dependent features

## Related Documentation

- [Vertical Slice Architecture](./vertical-slice-refactoring.md) - Detailed architecture guide
- [Shared Module](./shared-module.md) - Cross-cutting concerns
- [Code Organization](./1-code-organization.md) - Overall project structure
