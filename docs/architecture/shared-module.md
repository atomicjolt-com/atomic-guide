# Shared Module Architecture

This document describes the shared module (`src/shared/`) which contains cross-cutting concerns and utilities shared across multiple features in Atomic Guide.

## Purpose

The shared module provides common functionality that is genuinely needed by multiple features, avoiding code duplication while maintaining clear boundaries between features.

## Directory Structure

```
shared/
├── client/          # Client-side shared code
│   ├── components/  # Reusable UI components
│   ├── hooks/      # Common React hooks
│   ├── services/   # Shared client services
│   ├── store/      # Base store configuration
│   └── utils/      # Client utilities
├── server/          # Server-side shared code
│   ├── services/   # Core services (AI, DB, etc.)
│   ├── middleware/ # Common middleware
│   ├── db/        # Database utilities
│   └── utils/     # Server utilities
├── schemas/        # Common Zod schemas
├── types/         # Shared TypeScript types
└── config/        # Application configuration
```

## What Belongs in Shared?

### ✅ Should be Shared

- **Generic UI Components**: Button, Modal, ErrorBoundary, LoadingSpinner
- **Common Utilities**: Formatters, validators, sanitizers
- **Core Services**: AIService, DatabaseService, ModelRegistry
- **Common Schemas**: User, pagination, errors, API responses
- **Infrastructure Types**: Database models, API contracts
- **Configuration**: Environment settings, feature flags

### ❌ Should NOT be Shared

- Feature-specific business logic
- Components with feature-specific behavior
- Services that only one feature uses
- Domain-specific schemas
- Feature-specific state management
- Business rules and workflows

## Design Guidelines

### 1. Truly Generic

Only add code that is used by 2 or more features. If something is only used by one feature, it belongs in that feature's directory.

### 2. No Business Logic

Keep feature-specific logic in the features themselves. Shared code should be infrastructure and utilities only.

### 3. Well Documented

All exports require comprehensive JSDoc documentation since changes affect multiple features.

### 4. Stable APIs

Changes to shared code affect multiple features, so APIs must be stable and backwards compatible.

### 5. High Test Coverage

Shared code needs thorough testing as bugs affect the entire application.

## Key Components

### Server Services

#### AIService
Core AI model interactions for all features:
```typescript
import { AIService } from '@shared/server/services/AIService';
```

#### DatabaseService
Common database operations and connection management:
```typescript
import { DatabaseService } from '@shared/server/services/DatabaseService';
```

#### ModelRegistry
AI model configuration and management:
```typescript
import { ModelRegistry } from '@shared/server/services/ModelRegistry';
```

#### PromptBuilder
Utilities for constructing AI prompts:
```typescript
import { PromptBuilder } from '@shared/server/services/PromptBuilder';
```

#### StorageFallback
Storage abstraction layer for different backends:
```typescript
import { StorageFallback } from '@shared/server/services/StorageFallback';
```

### Client Components

#### ErrorMessage
Standardized error display component:
```typescript
import { ErrorMessage } from '@shared/client/components/ErrorMessage';
```

#### CodeBlock
Syntax-highlighted code display:
```typescript
import { CodeBlock } from '@shared/client/components/CodeBlock';
```

#### LoadingSpinner
Consistent loading states:
```typescript
import { LoadingSpinner } from '@shared/client/components/LoadingSpinner';
```

#### Modal
Reusable modal dialog:
```typescript
import { Modal } from '@shared/client/components/Modal';
```

### Common Hooks

#### useAuth
Authentication state and methods:
```typescript
import { useAuth } from '@shared/client/hooks/useAuth';
```

#### useDebounce
Debounced value updates:
```typescript
import { useDebounce } from '@shared/client/hooks/useDebounce';
```

#### useLocalStorage
Persistent client-side storage:
```typescript
import { useLocalStorage } from '@shared/client/hooks/useLocalStorage';
```

### Utilities

#### Server Utilities

- **responseFormatter** - Standardize API responses
- **sanitizer** - Input/output sanitization
- **tokenizer** - Text tokenization for AI
- **encryption** - Cryptographic operations
- **retry** - Retry logic with exponential backoff
- **logger** - Structured logging

#### Client Utilities

- **formatters** - Date, number, currency formatting
- **validators** - Common validation functions
- **classNames** - CSS class name utilities
- **storage** - Local/session storage helpers

### Common Schemas

#### API Schemas
```typescript
import { 
  ApiResponseSchema,
  PaginationSchema,
  ErrorSchema 
} from '@shared/schemas/api';
```

#### User Schemas
```typescript
import { 
  UserSchema,
  UserProfileSchema,
  PreferencesSchema 
} from '@shared/schemas/user';
```

## Import Patterns

### From Features
```typescript
// Import from shared using path alias
import { AIService } from '@shared/server/services';
import { Button } from '@shared/client/components';
import { useAuth } from '@shared/client/hooks';
import type { User } from '@shared/types';
```

### Within Shared
```typescript
// Use relative imports within shared
import { logger } from '../utils/logger';
import type { ApiResponse } from '../types';
```

## Adding to Shared

Before adding new code to shared:

1. **Verify Multiple Usage**: Confirm at least 2 features need it
2. **Review Existing Code**: Check if similar functionality exists
3. **Design for Reuse**: Make it generic and configurable
4. **Document Thoroughly**: Add complete JSDoc documentation
5. **Add Tests**: Include comprehensive test coverage
6. **Update This Doc**: Keep the shared module documentation current

## Migration Strategy

When identifying duplicate code across features:

1. **Analyze Usage**: Understand how each feature uses the code
2. **Extract Common Parts**: Identify truly shared functionality
3. **Create Generic Version**: Design flexible, reusable API
4. **Add to Shared**: Place in appropriate shared subdirectory
5. **Update Features**: Refactor features to use shared version
6. **Test Thoroughly**: Ensure all features still work correctly

## Performance Considerations

- **Lazy Loading**: Large shared components should support lazy loading
- **Tree Shaking**: Structure exports to enable tree shaking
- **Bundle Size**: Monitor impact on bundle size
- **Code Splitting**: Use dynamic imports where appropriate

## Maintenance

### Regular Reviews

- Quarterly review of shared code usage
- Remove unused shared code
- Consolidate similar utilities
- Update documentation

### Deprecation Process

1. Mark as deprecated with migration guide
2. Update all feature usage
3. Maintain for one release cycle
4. Remove in next major version

## Related Documentation

- [Vertical Slice Architecture](./vertical-slice-refactoring.md) - Overall architecture
- [Features Directory](./features-directory.md) - Feature organization
- [Code Organization](./1-code-organization.md) - Project structure
- [Import Guidelines](../development/imports.md) - Import conventions