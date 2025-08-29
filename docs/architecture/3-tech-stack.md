# 3. Tech Stack

| Category             | Technology                          | Version  | Purpose                            | Rationale                                                                                 |
| -------------------- | ----------------------------------- | -------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Frontend Language    | TypeScript                          | 5.3+     | Type-safe frontend development     | Existing codebase standard, prevents runtime errors                                       |
| Frontend Framework   | React (new) / Vanilla JS (existing) | 18.2+    | UI component development           | Progressive migration path documented in architecture                                     |
| UI Component Library | @atomicjolt/atomic-elements         | Latest   | LTI-friendly components            | Consistent LTI integration patterns (see [LTI Developer Guide](./lti-developer-guide.md)) |
| State Management     | Redux Toolkit                       | 2.x      | Global state + chat state          | Redux for app state and for chat components                                               |
| React API            | RTK Query                           | 2.x      | API requests                       | Integrates with Redux Toolkit                                                             |
| Backend Language     | TypeScript                          | 5.3+     | Type-safe backend development      | Existing Worker codebase standard                                                         |
| Backend Framework    | Hono                                | 3.11+    | HTTP routing and middleware        | Already integrated with LTI endpoints                                                     |
| API Style            | REST + WebSocket                    | -        | API communication + real-time chat | REST for CRUD, WebSocket for conversations                                                |
| Database             | Cloudflare D1 (new) + KV (existing) | latest   | Relational + key-value storage     | D1 for assessment data, KV for LTI config                                                 |
| Search               | Cloudflare Vectorize                | latest   | Semantic search                    | Vectorize for any data that needs to be searched                                          |
| Cache                | Cloudflare KV + Worker Cache API    | latest   | Response caching                   | Existing caching infrastructure                                                           |
| File Storage         | Cloudflare R2                       | latest   | Assessment media storage           | Cost-effective for generated content                                                      |
| Authentication       | JWT                                 | existing | User authentication                | Existing OAuth2/JWT implementation                                                        |
| Frontend Testing     | Vitest                              | 1.0+     | Unit/integration testing           | Existing test framework                                                                   |
| Backend Testing      | Vitest                              | 1.0+     | Worker testing                     | Consistent with frontend                                                                  |
| E2E Testing          | Playwright                          | 1.40+    | End-to-end testing                 | Canvas iframe testing support                                                             |
| Build Tool           | Vite                                | 5.0+     | Asset bundling                     | Existing build configuration                                                              |
| Bundler              | Vite/Rollup                         | 5.0+     | Module bundling                    | Part of Vite toolchain                                                                    |
| IaC Tool             | Wrangler                            | 3.22+    | Cloudflare deployment              | Existing deployment tool                                                                  |
| CI/CD                | GitHub Actions                      | -        | Automated deployment               | Existing CI/CD pipeline                                                                   |
| Monitoring           | Cloudflare Analytics + Tail logs    | latest   | Performance monitoring             | Built-in Worker monitoring                                                                |
| Logging              | Cloudflare Logpush                  | latest   | Centralized logging                | Production log aggregation                                                                |
| CSS Framework        | CSS Modules                         | 3.3+     | Component styling                  | Scoped styles with utility classes                                                        |
| AI Integration       | Cloudflare AI + OpenAI/Anthropic    | latest   | Cognitive processing & chat        | Edge inference + advanced AI capabilities                                                 |
| MCP Server           | Cloudflare MCP                      | latest   | AI client integration              | Native OAuth support, edge deployment                                                     |
| Internationalization | i18next                             | 23.x     | Multi-language support             | Comprehensive i18n solution                                                               |
| Date Handling        | date-fns                            | 3.x      | Date manipulation                  | Locale-aware date formatting                                                              |
| Accessibility        | React Modal + Tippy.js              | 3.x/6.x  | WCAG compliant UI                  | Accessible modals and tooltips                                                            |
