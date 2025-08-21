# Tech Stack Alignment

**Existing Technology Stack:**

| Category          | Current Technology | Version | Usage in Enhancement   | Notes                           |
| ----------------- | ------------------ | ------- | ---------------------- | ------------------------------- |
| Runtime           | Cloudflare Workers | Latest  | Core platform runtime  | Maintains edge performance      |
| Framework         | Hono               | 4.9.1   | API routing backbone   | Extended with new routes        |
| LTI Libraries     | @atomicjolt/lti-\* | 3.3.x   | LTI 1.3 authentication | Unchanged, foundational         |
| Storage - Config  | KV Namespaces      | N/A     | Platform configs, JWKS | Retained as-is                  |
| Storage - Session | Durable Objects    | N/A     | OIDC state, real-time  | Extended for struggle detection |
| Build Tool        | Vite               | 5.x     | Asset bundling         | Extended for React              |
| Language          | TypeScript         | 5.9.2   | Type safety            | Consistent across new code      |
| Testing           | Vitest             | 3.1.4   | Unit/integration tests | Extended test coverage          |

**New Technology Additions:**

| Technology                  | Version | Purpose                      | Rationale                              | Integration Method            |
| --------------------------- | ------- | ---------------------------- | -------------------------------------- | ----------------------------- |
| Cloudflare D1               | Latest  | Multi-tenant relational data | Complex queries, tenant isolation      | New binding in wrangler.jsonc |
| React                       | 18.x    | Post-launch UI components    | Rich interactions, component reuse     | Vite configuration extension  |
| @atomicjolt/atomic-elements | Latest  | UI component library         | Consistent LTI-friendly components     | npm dependency                |
| @atomicjolt/atomic-fuel     | Latest  | LTI state & JWT management   | Proven LTI integration patterns        | Redux middleware              |
| @atomicjolt/lti-components  | Latest  | LTI launch validation        | Secure launch verification             | React component wrapper       |
| Cloudflare MCP Server       | Latest  | AI client integration        | Native OAuth support, edge deployment  | New worker route at /mcp      |
| Redux Toolkit               | 2.x     | Client state management      | Predictable state, DevTools, RTK Query | Client-side store             |
| React Router                | 6.x     | SPA navigation               | Dashboard routing                      | Post-launch pages only        |
| Apollo Client               | 3.x     | GraphQL client               | Efficient data fetching, caching       | Network layer with JWT auth   |
| i18next                     | 23.x    | Internationalization         | Multi-language support                 | React context provider        |
| date-fns                    | 3.x     | Date manipulation            | Locale-aware date formatting           | Utility functions             |
| React Modal                 | 3.x     | Accessible modals            | WCAG compliant dialogs                 | Component library             |
| Tippy.js                    | 6.x     | Tooltips and popovers        | Interactive help overlays              | React wrapper components      |
| core-js                     | 3.x     | JavaScript polyfills         | Legacy browser support                 | Runtime polyfills             |
| es6-promise                 | 4.x     | Promise polyfill             | IE11 compatibility                     | Runtime polyfill              |
| Cloudflare AI               | Latest  | Cognitive processing         | Edge inference, low latency            | Worker AI binding             |
