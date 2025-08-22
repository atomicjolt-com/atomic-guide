# 17. Coding Standards

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

## Naming Conventions

| Element               | Frontend             | Backend          | Example                  |
| --------------------- | -------------------- | ---------------- | ------------------------ |
| Components            | PascalCase           | -                | `ChatAssessment.tsx`     |
| Hooks                 | camelCase with 'use' | -                | `useWebSocket.ts`        |
| API Routes            | -                    | kebab-case       | `/api/assessment-config` |
| Database Tables       | -                    | snake_case       | `conversation_messages`  |
| TypeScript Interfaces | PascalCase           | PascalCase       | `AssessmentConfig`       |
| Constants             | UPPER_SNAKE_CASE     | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`     |
