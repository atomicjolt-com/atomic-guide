# Features Directory - Vertical Slice Architecture

This directory contains feature-based vertical slices of the application. Each feature is self-contained with its own client, server, and test code.

## Structure

Each feature follows this structure:

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

## Features

- **chat/** - AI-powered chat functionality
- **assessment/** - Deep linking and assessment configuration
- **content/** - Content extraction and awareness
- **dashboard/** - Analytics and learning insights
- **lti/** - LTI protocol handling
- **settings/** - User preferences
- **faq/** - Knowledge base and FAQ system

## Import Guidelines

### Within a Feature
Use relative imports:
```typescript
import { ChatWindow } from './components';
import { chatApi } from './store';
```

### From Shared Module
Use path aliases:
```typescript
import { AIService } from '@shared/server/services';
import { Button } from '@shared/client/components';
```

### Cross-Feature (discouraged)
Only import types when necessary:
```typescript
import type { ChatMessage } from '@features/chat/shared/types';
```

## Adding a New Feature

1. Create the feature directory structure
2. Move related code from legacy locations
3. Create barrel exports (index.ts files)
4. Update imports to use new paths
5. Add feature documentation

## Migration Status

- ✅ Chat - Migrated
- ✅ Assessment - Migrated
- ⏳ Content - In Progress
- ⏳ Dashboard - Pending
- ⏳ LTI - Pending
- ⏳ Settings - Pending
- ⏳ FAQ - Pending