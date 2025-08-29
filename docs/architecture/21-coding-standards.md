# 21. Coding Standards

## Critical Fullstack Rules

- **Type Sharing:** Always define types in packages/shared and import from there
- **API Calls:** Never make direct HTTP calls - use the service layer
- **Environment Variables:** Access only through config objects, never process.env directly
- **Error Handling:** All API routes must use the standard error handler
- **State Updates:** Never mutate state directly - use proper state management patterns
- **Canvas Integration:** Always use postMessage API for content extraction, never scrape DOM
- **AI Responses:** Always implement streaming for chat responses to maintain UX
- **Database Access:** Use repository pattern, never direct D1 queries in handlers
- **WebSocket State:** Manage through Durable Objects only, not in Worker memory
- **Grade Calculations:** Use shared grading service for consistency across components
- **Existing API Compatibility:** Never modify existing LTI endpoints, only extend
- **Database Integration:** Always use tenant_id in D1 queries for isolation
- **Logging Consistency:** Use structured logging with request IDs

## Naming Conventions

| Element               | Frontend             | Backend          | Example                  |
| --------------------- | -------------------- | ---------------- | ------------------------ |
| Components            | PascalCase           | -                | `ChatAssessment.tsx`     |
| Hooks                 | camelCase with 'use' | -                | `useWebSocket.ts`        |
| API Routes            | -                    | kebab-case       | `/api/assessment-config` |
| Database Tables       | -                    | snake_case       | `conversation_messages`  |
| TypeScript Interfaces | PascalCase           | PascalCase       | `AssessmentConfig`       |
| Constants             | UPPER_SNAKE_CASE     | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`     |

## TypeScript Conventions

```typescript
// Use interfaces for data shapes
interface LearnerProfile {
  id: string;
  tenantId: string;
  cognitiveProfile: CognitiveData;
}

// Use type for unions/aliases
type SignalType = 'hover' | 'scroll' | 'idle' | 'click';

// Explicit return types for public functions
export async function processSignal(signal: BehavioralSignal): Promise<void> {
  // Implementation
}
```

## React Component Patterns

```typescript
// Functional components with typed props
interface DashboardProps {
  learnerId: string;
  profile: LearnerProfile;
}

export default function LearnerDashboard({ learnerId, profile }: DashboardProps) {
  // Use hooks at top level
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectCurrentSession);

  // RTK Query hooks for data fetching
  const { data: learnerData, isLoading } = useGetLearnerProfileQuery(learnerId);
  const [updateProfile] = useUpdateLearnerProfileMutation();

  return <div className={styles.dashboard}>...</div>;
}
```
