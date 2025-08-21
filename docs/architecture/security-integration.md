# Security Integration

**Existing Security Measures:**

- **Authentication:** LTI 1.3 OAuth/OIDC flow
- **Authorization:** JWT validation with RSA signatures
- **Data Protection:** HTTPS only, secure cookies
- **Security Tools:** Cloudflare WAF, DDoS protection

**Enhancement Security Requirements:**

## Data Privacy & Protection

- **Learner Consent:** Explicit opt-in for cognitive profiling stored in D1
- **Data Encryption:** All PII encrypted at rest in D1 using Cloudflare encryption
- **Right to Delete:** API endpoint for GDPR/FERPA compliance
- **Audit Logging:** All data access logged with timestamps and user IDs

## MCP OAuth Security

- **Token Scoping:** OAuth tokens limited to specific learner profiles
- **Refresh Strategy:** Short-lived access tokens (1 hour), longer refresh tokens
- **Client Registration:** Dynamic registration with approved AI clients only
- **Rate Limiting:** Per-client API limits to prevent abuse

## Tenant Isolation

- **Database Level:** Separate D1 instance per tenant
- **Query Validation:** Tenant ID verified in every database operation
- **Cross-Tenant Protection:** Middleware validates tenant context
- **Admin Access:** Separate admin API with additional authentication

**Security Testing:**

- **Existing Security Tests:** LTI signature validation tests preserved
- **New Security Test Requirements:** OAuth flow tests, tenant isolation tests
- **Penetration Testing:** Required before production launch
