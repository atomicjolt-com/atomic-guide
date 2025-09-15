# Repository Guidelines

## Project Structure & Module Organization
- `src/` — Cloudflare Worker backend (handlers, services, repositories, durable-objects). Entry: `src/index.ts`.
- `client/` — React UI (components, pages, store, hooks, styles). Entry: `client/app.tsx`.
- `public/` — Static assets. Build output in `dist/`.
- `scripts/` — DB/KV tooling, migrations, seeding, manifest inject.
- `migrations/`, `seeds/` — D1 schema changes and seed data.
- `tests/` — Cross-cutting suites (`api/`, `integration/`, `performance/`, `security`).

## Build, Test, and Development Commands
- `npm run dev` — Start Vite dev server (visit `http://localhost:5989/embed`).
- `npm run build` — Type-check (`tsc`) and build; inject manifest.
- `npm run preview` — Serve the production build locally.
- `npm test` — Vitest unit tests; `npm run test:integration` for integration.
- `npm run lint` / `npm run lint-fix` — ESLint check/fix; `npm run format` — Prettier.
- Deploy/observe: `npm run deploy`, `npm run tail`, `npm run check` (dry-run deploy).
- Data: `db:migrate`, `db:migrate:remote`, `db:rollback`, `db:seed`, `db:reset`, `db:status`, `db:query`, `db:export`.

## Architecture Rules
- Enforce repository pattern: `Handler → Service → Repository → DatabaseService → D1` (no direct DB access in handlers/services).
- Vertical slice features under `src/features/<feature>/{server,client,shared}`; share cross-cutting code in `src/shared`.

## Coding Style & Naming Conventions
- TypeScript-first; explicit return types; avoid `any` (prefer `unknown`).
- Validate all external data with Zod; use `z.infer` and branded ID types.
- Prettier (2-space) + ESLint (`eslint.config.js`).
- Files: kebab-case modules; PascalCase React components. Prefer named exports.

## Testing Guidelines
- Vitest; React Testing Library for UI. Test behavior, not implementation.
- Minimum 80% coverage on changed areas.
- Prefer co-located `__tests__` folders; use `tests/` for cross-cutting suites.
- Run before pushing: `npm test && npm run test:integration`.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `test:`, `chore:`, with optional scope (e.g., `feat(auth): …`).
- PRs must: describe changes and rationale, link issues, include screenshots for UI changes, update docs/seeds/migrations as needed, and pass `lint`, `test`, and `build`.

## Security & Configuration
- Secrets: use `.dev.vars` (copy from `.dev.vars.example`); never commit secrets.
- Validate JWTs; never log sensitive data (passwords, tokens, PII).
- Cloudflare bindings in `wrangler.jsonc` (e.g., `DB`, `VIDEO_STORAGE`, `AI`, `VIDEO_QUEUE`, `FAQ_INDEX`).
- D1/KV setup: `npm run db:setup`, `npm run kv:setup`. Validate with `npm run check`.

## LTI Notes
- Do not modify the `<LtiLaunchCheck>` wrapper.
- Client receives `window.LAUNCH_SETTINGS`; include JWT in Authorization for API calls.
