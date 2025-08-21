# Testing Strategy

**Integration with Existing Tests:**

- **Existing Test Framework:** Vitest with @cloudflare/vitest-pool-workers
- **Test Organization:** Tests colocated with source files (\*.test.ts)
- **Coverage Requirements:** Maintain existing coverage, target 80% for new code

**New Testing Requirements:**

## Unit Tests for New Components

- **Framework:** Vitest + React Testing Library
- **Location:** Adjacent to component files (Component.test.tsx)
- **Coverage Target:** 80% for business logic, 60% for UI components
- **Integration with Existing:** Share test utilities and mocks

## Integration Tests

- **Scope:** API endpoints, D1 operations, MCP OAuth flows
- **Existing System Verification:** Test LTI flows still work with enhancements
- **New Feature Testing:** End-to-end cognitive profiling scenarios

## Regression Testing

- **Existing Feature Verification:** Automated suite for all LTI operations
- **Automated Regression Suite:** GitHub Actions on every PR
- **Manual Testing Requirements:** Canvas iframe integration, struggle detection

**Test Data Management:**

```typescript
// Use factories for test data
export const learnerProfileFactory = (overrides?: Partial<LearnerProfile>) => ({
  id: 'test-learner-id',
  tenantId: 'test-tenant',
  cognitiveProfile: {
    /* defaults */
  },
  ...overrides,
});
```
