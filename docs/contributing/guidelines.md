# Contributing Guidelines

Welcome to the Atomic Guide project! This document outlines the guidelines and processes for contributing to the codebase.

## Getting Started

### Prerequisites

- **Node.js** 20+ with npm
- **Git** with SSH key configured
- **Wrangler CLI** installed globally
- **TypeScript** knowledge required
- **React 19** and **Cloudflare Workers** familiarity recommended

### Initial Setup

1. **Fork and Clone**

   ```bash
   git clone git@github.com:your-username/atomic-guide.git
   cd atomic-guide
   ```

2. **Install Dependencies**

   ```bash
   npm ci
   ```

3. **Environment Setup**

   ```bash
   cp .env.example .env.local
   # Fill in required environment variables
   ```

4. **Verify Setup**

   ```bash
   npm run check
   npm test
   npm run lint
   ```

5. **Local Development**
   ```bash
   npm run dev
   # Visit http://localhost:5988/test
   ```

## Development Workflow

### 1. Issue Assignment

- Browse [open issues](https://github.com/your-org/atomic-guide/issues)
- Comment on issues you'd like to work on
- Wait for maintainer assignment before starting work
- Create new issues for bugs or feature requests before implementing

### 2. Branch Strategy

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b bugfix/issue-description

# Or for documentation
git checkout -b docs/section-name
```

### 3. Development Process

1. **Follow TypeScript strict requirements** (see CLAUDE.md)
2. **Implement changes** with proper error handling
3. **Add/update tests** with minimum 80% coverage
4. **Update documentation** if needed
5. **Run quality checks** before committing

### 4. Quality Assurance

```bash
# Run all checks before committing
npm run check      # TypeScript compilation and build
npm test          # Full test suite
npm run lint      # ESLint checks
npm run lint-fix  # Auto-fix linting issues
```

### 5. Commit Guidelines

Follow [Conventional Commits](https://conventionalcommits.org/):

```bash
# Format: type(scope): description
git commit -m "feat(chat): implement real-time messaging with WebSockets"
git commit -m "fix(lti): resolve Canvas grade passback authentication issue"
git commit -m "docs(api): add WebSocket endpoint documentation"
git commit -m "test(assessment): add deep linking integration tests"
```

**Commit Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring without functionality changes
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependency updates, build config)
- `perf`: Performance improvements
- `ci`: CI/CD pipeline changes

## Code Standards

### 1. TypeScript Requirements (MANDATORY)

```typescript
// ✅ CORRECT: Explicit return types and proper error handling
export async function processVideoTranscription(videoId: string, transcription: string): Promise<TranscriptionResult> {
  try {
    const result = TranscriptionSchema.parse({ videoId, transcription });
    return await this.processTranscription(result);
  } catch (error) {
    throw new ProcessingError(`Failed to process transcription: ${error.message}`);
  }
}

// ❌ FORBIDDEN: No any types, missing return types
export async function processVideoTranscription(videoId: any, transcription: any) {
  return await this.processTranscription({ videoId, transcription });
}
```

### 2. React Component Standards

````typescript
// ✅ CORRECT: Proper React 19 typing and documentation
/**
 * Video upload component with progress tracking and error handling.
 *
 * @component
 * @example
 * ```tsx
 * <VideoUploader
 *   onUploadComplete={(video) => console.log('Uploaded:', video.id)}
 *   maxSizeBytes={100 * 1024 * 1024}
 * />
 * ```
 */
interface VideoUploaderProps {
  /** Callback fired when upload completes successfully */
  onUploadComplete: (video: UploadedVideo) => void;

  /** Maximum file size in bytes @default 50MB */
  maxSizeBytes?: number;

  /** Accepted video formats @default ['mp4', 'mov', 'avi'] */
  acceptedFormats?: string[];
}

export function VideoUploader({
  onUploadComplete,
  maxSizeBytes = 50 * 1024 * 1024,
  acceptedFormats = ['mp4', 'mov', 'avi']
}: VideoUploaderProps): ReactElement {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });

  // Implementation...
  return <div>Upload component</div>;
}
````

### 3. Testing Standards

```typescript
// ✅ CORRECT: Comprehensive test coverage
/**
 * @fileoverview Tests for VideoUploader component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoUploader } from './VideoUploader';

describe('VideoUploader', () => {
  it('should upload video and call onUploadComplete', async () => {
    const mockOnUploadComplete = vi.fn();
    const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });

    render(<VideoUploader onUploadComplete={mockOnUploadComplete} />);

    const input = screen.getByLabelText(/upload video/i);
    fireEvent.change(input, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          filename: 'test.mp4'
        })
      );
    });
  });

  it('should reject files that exceed size limit', () => {
    const mockOnUploadComplete = vi.fn();
    const largeFile = new File(['x'.repeat(100 * 1024 * 1024)], 'large.mp4', { type: 'video/mp4' });

    render(<VideoUploader onUploadComplete={mockOnUploadComplete} maxSizeBytes={50 * 1024 * 1024} />);

    const input = screen.getByLabelText(/upload video/i);
    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    expect(mockOnUploadComplete).not.toHaveBeenCalled();
  });
});
```

### 4. Error Handling Standards

```typescript
// ✅ CORRECT: Proper error handling with context
export class VideoProcessingError extends Error {
  constructor(
    message: string,
    public readonly videoId: string,
    public readonly stage: 'upload' | 'transcription' | 'analysis',
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'VideoProcessingError';
  }
}

export async function processVideo(videoId: string): Promise<ProcessedVideo> {
  try {
    const video = await this.getVideo(videoId);
    if (!video) {
      throw new VideoProcessingError('Video not found', videoId, 'upload');
    }

    const transcription = await this.generateTranscription(video);
    const analysis = await this.analyzeContent(transcription);

    return { video, transcription, analysis };
  } catch (error) {
    if (error instanceof VideoProcessingError) {
      throw error; // Re-throw domain errors
    }

    // Wrap unexpected errors
    throw new VideoProcessingError(`Unexpected error processing video: ${error.message}`, videoId, 'analysis', error);
  }
}
```

## Feature Development

### 1. Feature Structure

Follow the vertical slice architecture:

```
src/features/your-feature/
├── client/
│   ├── components/
│   │   ├── FeatureComponent.tsx
│   │   ├── __tests__/
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useFeatureData.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── FeatureService.ts
│   │   └── index.ts
│   └── store/
│       ├── featureSlice.ts
│       └── index.ts
├── server/
│   ├── handlers/
│   │   ├── featureApi.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── FeatureService.ts
│   │   └── index.ts
│   └── durable-objects/
│       └── FeatureDurableObject.ts
├── shared/
│   ├── types/
│   │   ├── Feature.ts
│   │   └── index.ts
│   └── schemas/
│       ├── featureSchema.ts
│       └── index.ts
└── tests/
    ├── integration/
    └── unit/
```

### 2. Database Changes

For database schema changes:

1. **Create migration file**:

   ```bash
   # Create new migration
   touch migrations/$(date +%Y%m%d%H%M%S)_add_feature_table.sql
   ```

2. **Write migration**:

   ```sql
   -- migrations/20241201120000_add_feature_table.sql

   -- Add new table for feature
   CREATE TABLE feature_data (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     context_id TEXT NOT NULL,
     data JSON NOT NULL,
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   );

   -- Add indexes for performance
   CREATE INDEX idx_feature_data_user_context ON feature_data(user_id, context_id);
   CREATE INDEX idx_feature_data_created ON feature_data(created_at);
   ```

3. **Test migration**:
   ```bash
   npm run db:migrate     # Test locally
   npm run db:status      # Verify migration applied
   ```

### 3. API Development

Follow consistent API patterns:

```typescript
// src/features/your-feature/server/handlers/featureApi.ts

/**
 * @fileoverview API handlers for feature management
 */

import { Hono } from 'hono';
import { FeatureService } from '../services/FeatureService';
import { featureSchema } from '../../shared/schemas';

const featureApi = new Hono<{ Bindings: Env }>();

/**
 * Create new feature item
 * POST /api/features
 */
featureApi.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = featureSchema.parse(body);

    const featureService = new FeatureService(c.env.DB);
    const result = await featureService.create(validatedData);

    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    console.error('Feature creation failed:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to create feature',
      },
      400
    );
  }
});

/**
 * Get feature items for user/context
 * GET /api/features?userId=123&contextId=456
 */
featureApi.get('/', async (c) => {
  try {
    const userId = c.req.query('userId');
    const contextId = c.req.query('contextId');

    if (!userId || !contextId) {
      return c.json(
        {
          success: false,
          error: 'userId and contextId are required',
        },
        400
      );
    }

    const featureService = new FeatureService(c.env.DB);
    const items = await featureService.getByUserContext(userId, contextId);

    return c.json({ success: true, data: items });
  } catch (error) {
    console.error('Feature retrieval failed:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to retrieve features',
      },
      500
    );
  }
});

export { featureApi };
```

## Testing Requirements

### 1. Test Categories

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test feature workflows end-to-end
- **API Tests**: Test all API endpoints
- **Component Tests**: Test React components with user interactions

### 2. Coverage Requirements

- **Minimum 80% total coverage** - NO EXCEPTIONS
- **100% coverage for critical paths** (authentication, payments, data security)
- **All public APIs must have tests**
- **All React components must have tests**

### 3. Test Organization

```typescript
// Feature test structure
describe('Feature: Video Processing', () => {
  describe('VideoUploader Component', () => {
    it('should upload video successfully', async () => {
      // Component test
    });

    it('should handle upload errors gracefully', async () => {
      // Error scenario test
    });
  });

  describe('Video Processing API', () => {
    it('should process uploaded video', async () => {
      // API integration test
    });

    it('should return 400 for invalid video format', async () => {
      // API error test
    });
  });

  describe('VideoService', () => {
    it('should generate transcription from video', async () => {
      // Service unit test
    });
  });
});
```

## Documentation Requirements

### 1. Code Documentation

All public functions, classes, and components must have JSDoc:

````typescript
/**
 * Processes video files and generates transcriptions and analytics.
 *
 * This service handles the complete video processing pipeline including:
 * - File validation and upload
 * - Transcription generation using Workers AI
 * - Content analysis and insights
 * - Database storage and caching
 *
 * @example
 * ```typescript
 * const processor = new VideoProcessor(env);
 * const result = await processor.processVideo(videoFile, {
 *   generateTranscription: true,
 *   analyzeContent: true
 * });
 * ```
 */
export class VideoProcessor {
  /**
   * Process a video file through the complete pipeline.
   *
   * @param videoFile - The uploaded video file to process
   * @param options - Processing options and feature flags
   * @returns Promise resolving to processing results
   * @throws {VideoProcessingError} If processing fails at any stage
   */
  async processVideo(videoFile: File, options: ProcessingOptions): Promise<ProcessingResult> {
    // Implementation...
  }
}
````

### 2. Feature Documentation

New features require documentation in `docs/`:

```markdown
# docs/features/your-feature.md

# Feature Name

## Overview

Brief description of what the feature does and why it's useful.

## Usage

How users interact with the feature.

## API Reference

Documentation of any new API endpoints.

## Implementation Details

Technical details for other developers.

## Testing

How to test the feature.
```

## Pull Request Process

### 1. Pre-PR Checklist

- [ ] Code follows TypeScript strict requirements
- [ ] All tests pass (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code coverage meets minimum 80%
- [ ] Documentation updated if needed
- [ ] Migration files created for database changes
- [ ] Feature tested manually in development

### 2. PR Description Template

```markdown
## Summary

Brief description of changes made.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Edge cases considered

## Database Changes

- [ ] Migration file created
- [ ] Migration tested locally
- [ ] Rollback plan documented

## Documentation

- [ ] Code documentation updated
- [ ] Feature documentation added
- [ ] API documentation updated
- [ ] README updated if needed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Screenshots attached for UI changes
- [ ] Breaking changes documented
```

### 3. Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one maintainer approval required
3. **Testing**: Reviewer must verify test coverage and functionality
4. **Documentation Review**: Documentation changes reviewed for clarity
5. **Deployment**: Maintainers handle deployment after approval

## Security Considerations

### 1. Input Validation

Always validate external input with Zod schemas:

```typescript
// ✅ CORRECT: Validate all external input
export async function handleUserInput(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const validatedInput = UserInputSchema.parse(body);

    // Process validated input
    const result = await this.processInput(validatedInput);

    return new Response(JSON.stringify(result));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response('Invalid input', { status: 400 });
    }
    throw error;
  }
}
```

### 2. Authentication

Never bypass authentication checks:

```typescript
// ✅ CORRECT: Always verify authentication
export async function protectedHandler(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env);

    // Proceed with authenticated request
    return await handleAuthenticatedRequest(request, payload);
  } catch (error) {
    return new Response('Invalid token', { status: 401 });
  }
}
```

### 3. Data Privacy

Handle sensitive data appropriately:

```typescript
// ✅ CORRECT: Sanitize logging and responses
export function logUserActivity(activity: UserActivity): void {
  console.log('User activity:', {
    userId: activity.userId,
    action: activity.action,
    timestamp: activity.timestamp,
    // Never log: passwords, tokens, PII
    metadata: sanitizeMetadata(activity.metadata),
  });
}

function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const { password, token, email, ...safe } = metadata;
  return safe;
}
```

## Getting Help

### 1. Documentation

- **Project Overview**: `/README.md`
- **Developer Guide**: `/CLAUDE.md`
- **API Documentation**: `/docs/api/`
- **Architecture**: `/docs/architecture/`

### 2. Communication

- **Issues**: Use GitHub Issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Email security@yourdomain.com for security issues

### 3. Development Support

- **Setup Issues**: Check `/docs/development/setup.md`
- **Testing**: See `/docs/development/testing.md`
- **Deployment**: Review `/docs/deployment/`

## Recognition

Contributors are recognized through:

- **GitHub Contributors page**
- **Release notes mentions**
- **Annual contributor appreciation**

Thank you for contributing to Atomic Guide! 🚀
