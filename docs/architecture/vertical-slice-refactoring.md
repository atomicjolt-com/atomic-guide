# Vertical Slice Architecture Refactoring Plan

## Overview

This document outlines the transformation from a layered architecture to a vertical slice architecture, organizing code by business features rather than technical layers.

## Architecture Philosophy

### Core Principles

1. **Feature Cohesion**: All code related to a feature lives together
2. **Shared Foundation**: Common functionality extracted to prevent duplication
3. **Clear Boundaries**: Features are self-contained with minimal cross-dependencies
4. **Incremental Migration**: System remains functional throughout refactoring

## Target Structure

```
src/
├── features/                  # Feature-based vertical slices
│   ├── chat/                 # Chat feature domain
│   │   ├── client/           # Client-side code
│   │   │   ├── components/   # React components
│   │   │   ├── hooks/        # Feature-specific hooks
│   │   │   ├── store/        # Redux slices and RTK Query
│   │   │   └── services/     # Client services
│   │   ├── server/           # Server-side code
│   │   │   ├── handlers/     # API route handlers
│   │   │   ├── services/     # Business logic
│   │   │   └── durable-objects/ # Stateful objects
│   │   ├── shared/           # Feature-internal shared code
│   │   │   ├── types/        # TypeScript types
│   │   │   └── schemas/      # Zod schemas
│   │   └── tests/            # Feature tests
│   │
│   ├── assessment/           # Assessment & deep linking
│   ├── content/              # Content extraction & awareness
│   ├── dashboard/            # Analytics & insights
│   ├── lti/                  # LTI protocol handling
│   ├── settings/             # User preferences
│   └── faq/                  # Knowledge base
│
└── shared/                    # Cross-feature shared code
    ├── client/
    │   ├── components/       # Reusable UI components
    │   ├── hooks/            # Common React hooks
    │   ├── services/         # Shared client services
    │   ├── store/            # Base store configuration
    │   └── utils/            # Client utilities
    ├── server/
    │   ├── services/         # Shared server services
    │   ├── middleware/       # Common middleware
    │   ├── db/              # Database utilities
    │   └── utils/           # Server utilities
    ├── schemas/              # Shared data schemas
    ├── types/               # Common TypeScript types
    └── config/              # Application configuration
```

## Feature Domains

### 1. Chat Feature

**Purpose**: AI-powered conversational interface

**Components**:

- Chat UI (FAB, Window, Messages)
- Message streaming
- Conversation management
- Rich media support (LaTeX, code blocks)
- Suggestion system

**Shared Dependencies**:

- AIService (from shared)
- ErrorBoundary (from shared)
- CodeBlock component (from shared)

### 2. Assessment Feature

**Purpose**: Deep linking and assessment configuration

**Components**:

- Assessment builder UI
- Question management
- Rubric configuration
- Deep link generation
- LTI content item creation

**Shared Dependencies**:

- Form components (from shared)
- Validation utilities (from shared)

### 3. Content Feature

**Purpose**: LMS content extraction and awareness

**Components**:

- Content extractor
- Privacy controls
- Manual content input
- Content analysis

**Shared Dependencies**:

- Sanitization utilities (from shared)
- Parsing utilities (from shared)

### 4. Dashboard Feature

**Purpose**: Analytics and learning insights

**Components**:

- Learning patterns visualization
- Chat history
- Privacy settings
- Suggestion analytics

**Shared Dependencies**:

- Chart components (from shared)
- Analytics utilities (from shared)

### 5. LTI Feature

**Purpose**: LTI protocol implementation

**Components**:

- Launch handling
- Registration
- JWT management
- Platform configuration

**Shared Dependencies**:

- JWT utilities (from shared)
- Authentication hooks (from shared)

### 6. Settings Feature

**Purpose**: User preferences management

**Components**:

- Preference UI
- Settings persistence
- Theme management

**Shared Dependencies**:

- Form components (from shared)
- Storage utilities (from shared)

### 7. FAQ Feature

**Purpose**: Knowledge base and FAQ system

**Components**:

- FAQ search
- Vector-based retrieval
- FAQ management

**Shared Dependencies**:

- AIService (from shared)
- Search utilities (from shared)

## Shared Module Organization

### Shared Client Components

- `Button`, `Input`, `Select` - Form primitives
- `Modal`, `Dialog` - Overlay components
- `ErrorBoundary` - Error handling
- `LoadingSpinner` - Loading states
- `CodeBlock` - Code display
- `Card`, `Panel` - Layout components

### Shared Server Services

- `AIService` - Core AI interactions
- `DatabaseService` - Common DB operations
- `ModelRegistry` - AI model management
- `PromptBuilder` - Prompt construction
- `StorageFallback` - Storage abstraction

### Shared Utilities

- `responseFormatter` - API response standardization
- `sanitizer` - Input sanitization
- `tokenizer` - Text processing
- `encryption` - Cryptographic operations
- `retry` - Retry logic
- `validators` - Common validation functions

### Shared Schemas

- `userSchema` - User data validation
- `apiResponseSchema` - API response structure
- `paginationSchema` - Pagination parameters
- `errorSchema` - Error response structure

## Import Patterns

### TypeScript Path Aliases

```json
{
  "compilerOptions": {
    "paths": {
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@/types": ["src/shared/types"],
      "@/schemas": ["src/shared/schemas"]
    }
  }
}
```

### Import Examples

```typescript
// Importing from shared
import { AIService } from '@shared/server/services';
import { Button } from '@shared/client/components';
import { useAuth } from '@shared/client/hooks';

// Importing within a feature
import { ChatWindow } from './components';
import { chatApi } from './store';

// Cross-feature imports (discouraged)
import type { ChatMessage } from '@features/chat/shared/types';
```

## Migration Strategy

### Phase 1: Foundation (Week 1)

1. Create directory structure
2. Setup TypeScript paths
3. Move shared utilities
4. Configure build system

### Phase 2: Shared Module (Week 1-2)

1. Extract common components
2. Move shared services
3. Consolidate utilities
4. Setup shared schemas

### Phase 3: Feature Migration (Weeks 2-4)

1. Chat feature (isolated, good starting point)
2. Assessment feature (newer, fewer dependencies)
3. Content feature
4. Dashboard feature
5. Settings & FAQ features
6. LTI feature (most integrated, do last)

### Phase 4: Cleanup (Week 4)

1. Remove old directories
2. Update all imports
3. Fix tests
4. Update documentation

## Testing Strategy

### Test Organization

```
features/
└── chat/
    └── tests/
        ├── unit/           # Unit tests
        ├── integration/    # Integration tests
        └── e2e/           # End-to-end tests
```

### Test Guidelines

- Each feature maintains its own test suite
- Shared modules have comprehensive test coverage
- Integration tests verify feature interactions
- E2E tests validate complete user flows

## Build Configuration Updates

### Vite Configuration

```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@features': '/src/features',
      '@shared': '/src/shared',
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: 'client/app.tsx',
        appInit: 'client/app-init.ts',
        home: 'client/home.ts',
      },
    },
  },
});
```

## Benefits

1. **Better Organization**: Related code lives together
2. **Easier Navigation**: Find all feature code in one place
3. **Team Autonomy**: Teams can work on features independently
4. **Clear Dependencies**: Explicit imports show relationships
5. **Maintainability**: Changes isolated to features
6. **Testability**: Features can be tested in isolation
7. **Onboarding**: New developers understand features quickly

## Considerations

1. **Main Entry Points**: Keep `src/index.ts` as Worker entry
2. **LTI Routes**: Remain in main router (framework requirement)
3. **Backward Compatibility**: Maintain during migration
4. **CI/CD Updates**: Update any hardcoded paths
5. **Documentation**: Keep architecture docs current

## Success Metrics

- ✅ All features organized in vertical slices
- ✅ Shared module prevents code duplication
- ✅ Clear feature boundaries established
- ✅ Tests passing with new structure
- ✅ Build system configured for new paths
- ✅ Documentation updated
- ✅ Team trained on new structure

## Decision Log

| Decision                    | Rationale                                             | Date       |
| --------------------------- | ----------------------------------------------------- | ---------- |
| Vertical Slice Architecture | Better feature cohesion and team autonomy             | 2024-12-29 |
| Shared module approach      | Prevent code duplication while maintaining boundaries | 2024-12-29 |
| Incremental migration       | Minimize disruption to ongoing development            | 2024-12-29 |
| Feature-first organization  | Align code structure with business domains            | 2024-12-29 |
