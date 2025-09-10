# 20. Security and Performance

## Security Requirements

**Frontend Security:**

- CSP Headers: `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.openai.com`
- XSS Prevention: React's automatic escaping, sanitize user input with DOMPurify
- Secure Storage: JWT in sessionStorage (not localStorage), sensitive data encrypted

**Backend Security:**

- Input Validation: Zod schemas for all endpoints
- Rate Limiting: 100 requests/minute per user using Cloudflare Rate Limiting
- CORS Policy: Restrict to Canvas domains and localhost for development

**Authentication Security:**

- Token Storage: sessionStorage for JWT, httpOnly cookies for refresh tokens
- Session Management: 24-hour token expiry, automatic refresh
- MCP OAuth Security: Token scoping limited to specific learner profiles

**Data Privacy & Protection:**

- Learner Consent: Explicit opt-in for cognitive profiling stored in D1
- Data Encryption: All PII encrypted at rest in D1 using Cloudflare encryption
- Right to Delete: API endpoint for GDPR/FERPA compliance
- Audit Logging: All data access logged with timestamps and user IDs

**Tenant Isolation:**

- Database Level: Separate D1 instance per tenant
- Query Validation: Tenant ID verified in every database operation
- Cross-Tenant Protection: Middleware validates tenant context
- Admin Access: Separate admin API with additional authentication

## Performance Optimization

**Frontend Performance:**

- Bundle Size Target: <200KB gzipped for assessment components
- Loading Strategy: Code splitting by route, lazy load assessment UI
- Caching Strategy: Service Worker for static assets, 1-hour cache for API responses
- Initial Load: <3s on 3G connection
- Time to Interactive: <5s on average hardware
- Interaction Response: <100ms for user inputs
- Animation FPS: Consistent 60fps for all animations

**Backend Performance:**

- Response Time Target: <100ms for API, <3s for AI responses
- Database Optimization: Indexes on frequently queried columns, connection pooling
- Caching Strategy: KV cache for config data (5 min TTL), Edge cache for static responses
- Chat Rate Limiting: 10,000 tokens per learner per day, 20 messages per minute
- FAQ cache hit target: 40% of queries (instant response)

**Performance Critical Paths:**

1. **Struggle Detection Pipeline (<50ms):**
   - Canvas event capture via custom JS (0ms)
   - MessageChannel communication (1ms)
   - PostMessage validation & processing (2ms)
   - WebSocket to Durable Object (5ms)
   - Pattern matching algorithm (20ms)
   - Intervention trigger (30ms)

2. **AI Chat Response Pipeline (<200ms target):**
   - Message reception via WebSocket (5ms)
   - Canvas context extraction (30ms)
   - Learner DNA retrieval from cache/D1 (15ms)
   - AI API call (100-150ms)
   - Response streaming initiation (20ms)

3. **Profile Update Pipeline (<500ms):**
   - Batch signal aggregation (100ms)
   - Cloudflare AI inference (200ms)
   - D1 profile update (100ms)
   - Cache invalidation (100ms)
