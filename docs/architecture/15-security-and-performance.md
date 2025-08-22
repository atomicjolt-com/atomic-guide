# 15. Security and Performance

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
- Password Policy: N/A - using LTI authentication

## Performance Optimization

**Frontend Performance:**

- Bundle Size Target: <200KB gzipped for assessment components
- Loading Strategy: Code splitting by route, lazy load assessment UI
- Caching Strategy: Service Worker for static assets, 1-hour cache for API responses

**Backend Performance:**

- Response Time Target: <100ms for API, <3s for AI responses
- Database Optimization: Indexes on frequently queried columns, connection pooling
- Caching Strategy: KV cache for config data (5 min TTL), Edge cache for static responses
