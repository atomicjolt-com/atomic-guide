# Testing Guide

Comprehensive guide for testing Atomic Guide, including unit tests, integration tests, and end-to-end testing strategies.

## Testing Overview

### Testing Stack

- **Test Runner**: [Vitest](https://vitest.dev/) - Fast, Vite-native test runner
- **Component Testing**: [React Testing Library](https://testing-library.com/react)
- **E2E Testing**: [Playwright](https://playwright.dev/)
- **Mocking**: [MSW](https://mswjs.io/) for API mocking
- **Coverage**: Built-in Vitest coverage with c8

### Test Organization

```
tests/
├── unit/              # Unit tests for utilities and services
├── components/        # React component tests
├── integration/       # API and service integration tests
├── e2e/              # End-to-end user flow tests
├── fixtures/         # Test data and mocks
└── setup/            # Test configuration files
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Watch mode for development
npm test -- --watch

# Run specific test file
npm test -- ChatWindow.test.tsx

# Run tests matching pattern
npm test -- --grep "authentication"

# Run with coverage
npm test -- --coverage

# Run integration tests only
npm run test:integration

# Run E2E tests
npm run test:e2e
```

### Test Filtering

```bash
# Run tests in specific directory
npm test -- tests/components

# Run only changed files
npm test -- --changed

# Run tests related to changed files
npm test -- --related

# Skip specific tests
npm test -- --exclude="*.slow.test.ts"
```

## Writing Tests

### Unit Tests

#### Testing Pure Functions

```typescript
// tests/unit/utils/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail, validateMessage } from '@/shared/utils/validation';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
    });
  });

  describe('validateMessage', () => {
    it('should validate message length', () => {
      expect(validateMessage('Hello')).toBe(true);
      expect(validateMessage('')).toBe(false);
      expect(validateMessage('a'.repeat(10001))).toBe(false);
    });
  });
});
```

#### Testing Services

```typescript
// tests/unit/services/AIService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '@/shared/server/services/AIService';

describe('AIService', () => {
  let service: AIService;
  let mockAI: any;

  beforeEach(() => {
    mockAI = {
      run: vi.fn()
    };
    service = new AIService(mockAI);
  });

  it('should generate completion', async () => {
    mockAI.run.mockResolvedValue({
      response: 'Generated text'
    });

    const result = await service.generateCompletion('prompt');
    
    expect(mockAI.run).toHaveBeenCalledWith(
      '@cf/meta/llama-3-8b-instruct',
      expect.objectContaining({
        prompt: 'prompt'
      })
    );
    expect(result).toBe('Generated text');
  });

  it('should handle errors gracefully', async () => {
    mockAI.run.mockRejectedValue(new Error('AI service error'));

    await expect(service.generateCompletion('prompt'))
      .rejects.toThrow('Failed to generate completion');
  });
});
```

### Component Tests

#### Basic Component Test

```typescript
// tests/components/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@testing-library/react';
import { Button } from '@/shared/client/components/Button';

describe('Button Component', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when specified', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should apply variant styles', () => {
    render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });
});
```

#### Testing with Redux

```typescript
// tests/components/ChatWindow.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ChatWindow } from '@/features/chat/client/components/ChatWindow';
import { chatSlice } from '@/features/chat/client/store/chatSlice';

describe('ChatWindow with Redux', () => {
  const renderWithRedux = (initialState = {}) => {
    const store = configureStore({
      reducer: {
        chat: chatSlice.reducer
      },
      preloadedState: initialState
    });

    return render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>
    );
  };

  it('should display messages from store', () => {
    renderWithRedux({
      chat: {
        messages: [
          { id: '1', content: 'Hello', role: 'user' },
          { id: '2', content: 'Hi there!', role: 'assistant' }
        ]
      }
    });

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });
});
```

#### Testing Async Components

```typescript
// tests/components/AssessmentList.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { AssessmentList } from '@/features/assessment/client/components/AssessmentList';

const server = setupServer(
  rest.get('/api/assessments', (req, res, ctx) => {
    return res(ctx.json([
      { id: '1', title: 'Quiz 1' },
      { id: '2', title: 'Quiz 2' }
    ]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AssessmentList', () => {
  it('should load and display assessments', async () => {
    render(<AssessmentList />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Quiz 1')).toBeInTheDocument();
      expect(screen.getByText('Quiz 2')).toBeInTheDocument();
    });
  });

  it('should handle loading errors', async () => {
    server.use(
      rest.get('/api/assessments', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    render(<AssessmentList />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load assessments')).toBeInTheDocument();
    });
  });
});
```

### Integration Tests

#### API Integration Test

```typescript
// tests/integration/chat-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Chat API Integration', () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should handle chat messages', async () => {
    const response = await worker.fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        message: 'Hello'
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('response');
  });

  it('should require authentication', async () => {
    const response = await worker.fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' })
    });

    expect(response.status).toBe(401);
  });
});
```

#### Database Integration Test

```typescript
// tests/integration/database.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { D1Database } from '@cloudflare/workers-types';
import { UserService } from '@/features/user/server/services/UserService';

describe('Database Integration', () => {
  let db: D1Database;
  let userService: UserService;

  beforeEach(async () => {
    // Use test database
    db = getMiniflareBindings().DB;
    userService = new UserService(db);
    
    // Clean database
    await db.exec('DELETE FROM users');
  });

  it('should create and retrieve user', async () => {
    const user = await userService.createUser({
      email: 'test@example.com',
      name: 'Test User'
    });

    expect(user.id).toBeDefined();

    const retrieved = await userService.getUserById(user.id);
    expect(retrieved?.email).toBe('test@example.com');
  });

  it('should handle unique constraints', async () => {
    await userService.createUser({
      email: 'test@example.com',
      name: 'User 1'
    });

    await expect(
      userService.createUser({
        email: 'test@example.com',
        name: 'User 2'
      })
    ).rejects.toThrow('Email already exists');
  });
});
```

### End-to-End Tests

#### Playwright E2E Test

```typescript
// tests/e2e/chat-flow.test.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5988/test');
  });

  test('should send and receive chat messages', async ({ page }) => {
    // Type message
    await page.fill('[data-testid="chat-input"]', 'Hello, AI assistant');
    
    // Send message
    await page.click('[data-testid="send-button"]');
    
    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]'))
      .toBeVisible({ timeout: 10000 });
    
    // Verify message appears
    await expect(page.locator('text=Hello, AI assistant')).toBeVisible();
  });

  test('should handle markdown formatting', async ({ page }) => {
    await page.fill('[data-testid="chat-input"]', 'Show me markdown');
    await page.click('[data-testid="send-button"]');
    
    // Wait for formatted response
    await expect(page.locator('h2')).toBeVisible();
    await expect(page.locator('code')).toBeVisible();
  });
});
```

#### LTI Launch E2E Test

```typescript
// tests/e2e/lti-launch.test.ts
import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

test.describe('LTI Launch', () => {
  test('should complete LTI 1.3 launch flow', async ({ page }) => {
    // Generate test JWT
    const token = jwt.sign(
      {
        iss: 'https://platform.example.com',
        aud: 'test-client-id',
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest'
      },
      'test-secret'
    );

    // Initiate OIDC flow
    await page.goto(`http://localhost:5988/lti/init?token=${token}`);
    
    // Should redirect to platform auth
    await expect(page).toHaveURL(/platform\.example\.com/);
    
    // Complete auth and redirect back
    await page.goto(`http://localhost:5988/lti/redirect?state=test`);
    
    // Should launch application
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
  });
});
```

## Test Coverage

### Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        'src/types/'
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
});
```

### Running Coverage

```bash
# Generate coverage report
npm test -- --coverage

# Open HTML report
open coverage/index.html

# Check coverage thresholds
npm test -- --coverage --threshold
```

### Coverage Requirements

- **Minimum 80% coverage** for all metrics
- **100% coverage** for critical paths (auth, payments)
- **Exclude** generated files and type definitions

## Mocking Strategies

### Mocking External Services

```typescript
// tests/mocks/ai.ts
import { vi } from 'vitest';

export const mockAI = {
  run: vi.fn().mockImplementation((model, options) => {
    if (options.prompt.includes('error')) {
      throw new Error('AI service error');
    }
    return Promise.resolve({
      response: 'Mocked AI response'
    });
  })
};
```

### Mocking Time

```typescript
import { vi } from 'vitest';

describe('Time-dependent tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use mocked time', () => {
    expect(new Date().getFullYear()).toBe(2024);
  });
});
```

### Mocking Network Requests

```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/user', (req, res, ctx) => {
    return res(ctx.json({
      id: '123',
      name: 'Test User'
    }));
  }),
  
  rest.post('/api/chat', async (req, res, ctx) => {
    const { message } = await req.json();
    return res(ctx.json({
      response: `Echo: ${message}`
    }));
  })
];
```

## Testing Best Practices

### Test Structure

```typescript
describe('Feature/Component Name', () => {
  // Setup
  beforeEach(() => {
    // Common setup
  });

  // Group related tests
  describe('when condition', () => {
    it('should expected behavior', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });

  // Clean up
  afterEach(() => {
    // Cleanup
  });
});
```

### Testing Principles

1. **Test behavior, not implementation**
2. **Keep tests isolated and independent**
3. **Use descriptive test names**
4. **Follow AAA pattern (Arrange, Act, Assert)**
5. **Avoid testing framework code**
6. **Mock external dependencies**
7. **Test edge cases and error conditions**

### Common Patterns

#### Testing Error Boundaries

```typescript
it('should handle errors gracefully', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );
  
  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  spy.mockRestore();
});
```

#### Testing Loading States

```typescript
it('should show loading state', async () => {
  render(<AsyncComponent />);
  
  // Initially loading
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  
  // Wait for content
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
```

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - run: npm ci
      
      - run: npm test -- --coverage
      
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Debugging Tests

### Debug Output

```typescript
it('should debug test', () => {
  const data = { foo: 'bar' };
  
  // Use debug for detailed output
  screen.debug();
  
  // Log specific elements
  console.log(screen.getByRole('button'));
  
  // Pretty print objects
  console.log(JSON.stringify(data, null, 2));
});
```

### Interactive Mode

```bash
# Run tests in UI mode
npm test -- --ui

# Debug specific test
npm test -- --inspect-brk
```

## Next Steps

- [Debugging Guide](./debugging.md) - Debug failing tests
- [Setup Guide](./setup.md) - Configure test environment
- [CI/CD Guide](../deployment/ci-cd.md) - Automate testing