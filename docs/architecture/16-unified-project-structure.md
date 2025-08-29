# 16. Unified Project Structure

```
atomic-guide/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml
│       └── deploy.yaml
├── src/                        # Backend (Cloudflare Worker)
│   ├── assessment/             # Assessment module
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── durable-objects/
│   │   └── routes.ts
│   ├── api/                    # API handlers
│   │   ├── handlers/
│   │   │   ├── cognitive.ts
│   │   │   ├── learners.ts
│   │   │   ├── interventions.ts
│   │   │   └── chat.ts
│   │   └── websocket.ts
│   ├── mcp/                    # MCP implementation
│   │   ├── AtomicGuideMCP.ts
│   │   ├── tools.ts
│   │   ├── resources.ts
│   │   └── prompts.ts
│   ├── middleware/             # Existing + new middleware
│   ├── services/               # Business logic
│   │   ├── CognitiveEngine.ts
│   │   ├── StruggleDetector.ts
│   │   ├── InterventionService.ts
│   │   ├── ChatService.ts
│   │   ├── ContentExtractor.ts
│   │   └── FAQKnowledgeBase.ts
│   ├── models/                 # Data models
│   │   ├── learner.ts
│   │   ├── session.ts
│   │   ├── knowledge.ts
│   │   └── chat.ts
│   ├── db/                     # D1 utilities
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   └── queries.ts
│   ├── utils/                  # Shared utilities
│   └── index.ts                # Main Hono app
├── client/                     # Frontend
│   ├── components/
│   │   ├── assessment/         # Assessment React components
│   │   ├── cognitive/          # Cognitive learning components
│   │   ├── chat/               # Chat UI components
│   │   ├── dashboard/          # Dashboard components
│   │   ├── privacy/            # Privacy controls
│   │   └── legacy/             # Existing vanilla JS
│   ├── hooks/                  # React hooks
│   ├── services/               # API clients
│   ├── store/                  # Redux store
│   │   ├── configure_store.ts
│   │   ├── slices/
│   │   └── api/
│   ├── slices/                 # Redux Tookit slices
│   ├── libs/                   # Utility libraries
│   ├── styles/                 # CSS with design system
│   │   ├── base.css
│   │   ├── variables.css
│   │   ├── typography.css
│   │   ├── animations.css
│   │   └── components/
│   ├── utils/
│   ├── app.tsx                 # Main application entry point
│   ├── app-init.ts             # Existing OIDC
│   └── assessment.tsx          # New assessment entry
├── packages/                   # Shared packages (new)
│   └── shared/
│       ├── src/
│       │   ├── types/          # TypeScript interfaces
│       │   └── constants/      # Shared constants
│       └── package.json
├── migrations/                 # D1 migrations (new)
│   ├── 001_initial_schema.sql
│   └── 002_add_analytics.sql
├── scripts/                    # Build & deployment
│   ├── inject-manifest.js      # Existing
│   └── setup-d1.js            # NEW: D1 setup
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── prd.md
│   ├── front-end-spec.md
│   └── new_architecture.md
├── public/                     # Static assets
├── .env.example
├── wrangler.jsonc              # Cloudflare config
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```
