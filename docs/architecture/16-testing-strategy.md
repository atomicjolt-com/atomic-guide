# 16. Testing Strategy

## Testing Pyramid

```
         E2E Tests (10%)
        /              \
    Integration Tests (30%)
   /                      \
Frontend Unit (30%)  Backend Unit (30%)
```

## Test Organization

### Frontend Tests

```
tests/
├── unit/
│   ├── components/
│   │   └── ChatAssessment.test.tsx
│   ├── hooks/
│   │   └── useWebSocket.test.ts
│   └── services/
│       └── assessmentApi.test.ts
├── integration/
│   └── assessment-flow.test.tsx
```

### Backend Tests

```
tests/
├── unit/
│   ├── handlers/
│   │   └── configHandler.test.ts
│   ├── services/
│   │   └── aiService.test.ts
│   └── repositories/
│       └── conversationRepository.test.ts
├── integration/
│   └── api-endpoints.test.ts
```

### E2E Tests

```
tests/
└── e2e/
    ├── deep-linking.spec.ts
    ├── student-assessment.spec.ts
    └── instructor-dashboard.spec.ts
```

## Test Examples

### Frontend Component Test

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatAssessment } from '@/components/assessment/ChatAssessment';

describe('ChatAssessment', () => {
  it('sends message when input submitted', async () => {
    const mockSend = vi.fn();
    vi.mock('@/hooks/useWebSocket', () => ({
      useWebSocket: () => ({ sendMessage: mockSend, isConnected: true })
    }));

    render(<ChatAssessment assessmentConfigId="123" pageContent="test" />);

    const input = screen.getByRole('textbox');
    const button = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(button);

    expect(mockSend).toHaveBeenCalledWith({
      type: 'chat',
      content: 'Test message',
      context: { pageContent: 'test' }
    });
  });
});
```

### Backend API Test

```typescript
import { describe, it, expect } from 'vitest';
import { createConfigHandler } from '@/assessment/handlers/configHandler';

describe('Config Handler', () => {
  it('creates assessment configuration', async () => {
    const mockContext = {
      req: {
        json: () =>
          Promise.resolve({
            assessment_type: 'chat',
            mastery_threshold: 80,
            grading_schema: 'mastery',
          }),
      },
      get: () => ({ platform_id: 'test', user_id: 'instructor1' }),
      json: vi.fn(),
    };

    await createConfigHandler(mockContext as any);

    expect(mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        assessment_type: 'chat',
        mastery_threshold: 80,
      }),
      201,
    );
  });
});
```

### E2E Test

```typescript
import { test, expect } from '@playwright/test';

test('instructor can configure deep link assessment', async ({ page }) => {
  // Launch from Canvas
  await page.goto('/lti/launch?token=test-token');

  // Navigate to deep link config
  await page.click('text=Configure Assessment');

  // Set configuration
  await page.selectOption('#assessment-type', 'chat');
  await page.fill('#mastery-threshold', '75');
  await page.selectOption('#grading-schema', 'mastery');

  // Save configuration
  await page.click('button:has-text("Save")');

  // Verify success
  await expect(page.locator('.success-message')).toBeVisible();
  await expect(page.locator('.success-message')).toContainText('Configuration saved');
});
```
