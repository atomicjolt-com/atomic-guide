# Shared Module

This directory contains cross-cutting concerns and utilities shared across multiple features.

## Structure

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

## What Goes in Shared?

### ✅ Should be Shared
- Generic UI components (Button, Modal, ErrorBoundary)
- Common utilities (formatters, validators)
- Core services (AIService, DatabaseService)
- Common schemas (user, pagination, errors)
- Shared types and interfaces

### ❌ Should NOT be Shared
- Feature-specific business logic
- Components with feature-specific behavior
- Services that only one feature uses
- Domain-specific schemas

## Guidelines

1. **Truly Generic**: Only add code used by 2+ features
2. **No Business Logic**: Keep feature logic in features
3. **Well Documented**: All exports need JSDoc
4. **Stable APIs**: Changes affect multiple features
5. **High Test Coverage**: Shared code needs thorough testing

## Key Services

### Server Services
- **AIService** - Core AI model interactions
- **DatabaseService** - Common database operations
- **ModelRegistry** - AI model management
- **PromptBuilder** - Prompt construction utilities
- **StorageFallback** - Storage abstraction layer

### Client Components
- **ErrorMessage** - Standard error display
- **CodeBlock** - Code syntax highlighting
- **LoadingSpinner** - Loading states (to be added)
- **Modal** - Modal dialogs (to be added)

### Utilities
- **responseFormatter** - API response standardization
- **sanitizer** - Input/output sanitization
- **tokenizer** - Text tokenization
- **encryption** - Cryptographic operations
- **retry** - Retry logic with backoff