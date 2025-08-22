# 12. Unified Project Structure

```
atomic-guide/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml
│       └── deploy.yaml
├── src/                        # Backend (Cloudflare Worker)
│   ├── assessment/             # New assessment module
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── durable-objects/
│   │   └── routes.ts
│   ├── middleware/             # Existing + new middleware
│   ├── services/               # Existing services
│   ├── utils/                  # Shared utilities
│   └── index.ts                # Main Hono app
├── client/                     # Frontend
│   ├── components/
│   │   ├── assessment/         # New React components
│   │   └── legacy/             # Existing vanilla JS
│   ├── hooks/                  # React hooks
│   ├── services/               # API clients
│   ├── stores/                 # Zustand stores
│   ├── utils/
│   ├── app.ts                  # Existing entry
│   ├── app-init.ts             # Existing OIDC
│   └── assessment.tsx          # New assessment entry
├── packages/                   # Shared packages (new)
│   └── shared/
│       ├── src/
│       │   ├── types/          # TypeScript interfaces
│       │   │   ├── assessment.ts
│       │   │   ├── conversation.ts
│       │   │   └── index.ts
│       │   └── constants/      # Shared constants
│       └── package.json
├── migrations/                 # D1 migrations (new)
│   ├── 001_initial_schema.sql
│   └── 002_add_analytics.sql
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── prd.md
│   ├── brief.md
│   └── deep-linking-assessment-architecture.md
├── public/                     # Static assets
├── .env.example
├── wrangler.jsonc              # Cloudflare config
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```
