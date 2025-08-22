# Infrastructure and Deployment Integration

**Existing Infrastructure:**

- **Current Deployment:** Cloudflare Workers with custom domain (lti-worker.atomicjolt.win)
- **Infrastructure Tools:** Wrangler CLI, GitHub Actions
- **Environments:** Local development (localhost:8787), Production (Cloudflare edge)

**Enhancement Deployment Strategy:**

- **Deployment Approach:** Blue-green deployment with gradual rollout per tenant
- **Infrastructure Changes:** Add D1 database bindings, AI model bindings, increase CPU limits
- **Pipeline Integration:** Extend existing GitHub Actions to include D1 migrations
- **Risk Mitigation:** Feature flags per tenant, KV fallback layer for D1 failures

**Updated wrangler.jsonc Configuration:**

```jsonc
{
  // Existing KV namespaces preserved
  "kv_namespaces": [...existing...],

  // NEW: D1 database bindings (per tenant)
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "atomic-guide-primary",
      "database_id": "uuid-here"
    }
  ],

  // NEW: AI model binding
  "ai": {
    "binding": "AI"
  },

  // Existing Durable Objects extended
  "durable_objects": {
    "bindings": [
      {
        "name": "OIDC_STATE",
        "class_name": "OIDCStateDurableObject"
      },
      {
        "name": "STRUGGLE_DETECTOR",  // NEW
        "class_name": "StruggleDetectorDO"
      },
      {
        "name": "CHAT_CONVERSATIONS",  // NEW: Chat state management
        "class_name": "ChatConversationDO"
      }
    ]
  }
}
```

**Critical Infrastructure Considerations (from SWOT Analysis):**

**Strengths to Leverage:**

- Edge computing provides global <100ms response times
- Zero-downtime blue-green deployments with instant rollback
- Automatic scaling without configuration
- Built-in DDoS protection and SSL

**Weaknesses to Address:**

- **D1 Performance Monitoring:** Implement comprehensive metrics before production
- **CPU Limit Management:** Design algorithms to work within 50ms constraint
- **Fallback Architecture:** KV cache layer provides read-only mode if D1 fails
- **Enhanced Observability:** Custom logging to D1 metrics tables

**Risk Mitigation Strategies:**

- **Progressive Rollout:** Start with 1-2 pilot institutions
- **Performance Gates:** D1 must demonstrate performant queries with proper indexing before full adoption
- **Hybrid Storage:** Keep critical configs in KV, learner data in D1
- **AI Complexity Threshold:** Use Cloudflare AI for simple inference, external APIs for complex

**Rollback Strategy:**

- **Rollback Method:** Wrangler rollback to previous deployment, D1 point-in-time recovery
- **Feature Flags:** Per-tenant feature toggles stored in KV
- **Monitoring:** Cloudflare Analytics + custom D1 metrics tables
- **Disaster Recovery:** Daily D1 exports to R2 bucket for cross-region backup
