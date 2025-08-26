# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

- `npm run dev` - Start local development server at http://localhost:8787
- `npm run build` - Build production bundle with TypeScript compilation and manifest injection
- `npm run check` - Validate TypeScript, build, and do a dry-run deployment
- `npm run deploy` - Build and deploy to Cloudflare Workers
- `npm test` - Run Vitest test suite
- `npm run tail` - Stream live logs from deployed worker
- `npm run types` - Generate Wrangler types

### Testing

- Run all tests: `npm test`
- Run tests in watch mode: `npm test -- --watch`
- Run a specific test file: `npm test -- path/to/test.ts`

### Code Quality

- Format code: `npx prettier --write .`
- Check formatting: `npx prettier --check .`
- Lint code: `npx eslint .`
- Type check: `tsc` or `npm run check`

## Architecture Overview

This is a Cloudflare Workers-based LTI 1.3 tool implementation using a serverless edge architecture:

### Core Components

1. **Server-Side (Cloudflare Worker)**
   - Entry point: `src/index.ts` - Hono app handling all LTI routes and services
   - LTI endpoints managed via `@atomicjolt/lti-endpoints` package
   - State management through Cloudflare KV namespaces and Durable Objects
   - Dynamic registration support with configurable tool settings

2. **Client-Side (SPA)**
   - Entry points: `client/app.tsx` (LTI launch), `client/home.ts` (home page), `client/app-init.ts` (OIDC init)
   - Built with Vite, deployed as static assets
   - Handles post-launch interactions including deep linking and names/roles services

3. **Storage Architecture (Cloudflare KV)**
   - `KEY_SETS`: Tool's RSA key pairs for JWT signing
   - `REMOTE_JWKS`: Cached platform JWK sets
   - `CLIENT_AUTH_TOKENS`: OAuth client credentials
   - `PLATFORMS`: Platform configurations from dynamic registration
   - `OIDC_STATE` (Durable Object): Manages OIDC state during authentication flow

4. **Configuration**
   - `definitions.ts`: Central constants for paths, names, and URLs
   - `src/config.ts`: Tool configuration for dynamic registration
   - `wrangler.jsonc`: Cloudflare Workers deployment configuration

### LTI Flow

1. Platform initiates at `/lti/init` with OIDC authentication request
2. Worker validates and redirects to platform's auth endpoint
3. Platform returns to `/lti/redirect` with auth response
4. Worker validates JWT and redirects to `/lti/launch` with state
5. Launch page validates and loads client application

### Key Integration Points

- Dynamic registration: `/lti/register` endpoint for automatic platform setup
- Deep linking: Client-side handling with server JWT signing at `/lti/sign_deep_link`
- Names and roles service: `/lti/names_and_roles` for roster retrieval
- Asset serving: Vite-built files served from `public/` with manifest injection
- The entry point for the front end, React application that is launched via LTI can be found in client/app.tsx
- The entry point for the application home page is client/home.ts

## Initial Setup

### KV Namespace Creation

If deploying manually (not using one-click deploy), create required KV namespaces:

```bash
# Tool key pairs
npx wrangler kv:namespace create KEY_SETS
npx wrangler kv:namespace create KEY_SETS --preview

# Platform JWK sets cache
npx wrangler kv:namespace create REMOTE_JWKS
npx wrangler kv:namespace create REMOTE_JWKS --preview

# Client auth tokens
npx wrangler kv:namespace create CLIENT_AUTH_TOKENS
npx wrangler kv:namespace create CLIENT_AUTH_TOKENS --preview

# Platform configurations
npx wrangler kv:namespace create PLATFORMS
npx wrangler kv:namespace create PLATFORMS --preview
```

Update `wrangler.jsonc` with the returned IDs.

### Dynamic Registration

- Registration URL: `https://yourdomain.com/lti/register`
- Tool configuration: `src/config.ts`
- Platform response handling: `src/register.ts`
- Tool definitions (names, URLs): `definitions.ts`

## Troubleshooting

### Common Issues

- **KV namespace errors**: Ensure IDs in `wrangler.jsonc` match created namespaces
- **JWKS endpoint failures**: Check platform configuration and network access
- **LTI launch failures**: Verify platform JWT validation and redirect URLs
- **Build failures**: Run `tsc` to check TypeScript errors before deployment
- **Asset loading issues**: Check manifest.json injection and public/ directory

### Debugging

- View logs: `npm run tail` or `npx wrangler tail`
- Check deployment: `npm run check` (dry-run deploy with validation)
- Test locally: `npm run dev` (http://localhost:8787)

## Important Context

- All LTI protocol handling is abstracted through `@atomicjolt/lti-*` packages
- Client scripts are injected dynamically based on manifest.json for cache busting
- Frame options are set to ALLOWALL for LMS iframe embedding
- TypeScript strict mode enforced - run `tsc` before deploying

## QA

## Visual Development

### Design Principles

- Comprehensive design checklist in `/context/design-principles.md`
- Brand style guide in `/context/style-guide.md`
- When making visual (front-end, UI/UX) changes, always refer to these files for guidance

### Quick Visual Check

IMMEDIATELY after implementing any front-end change:

1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against `/docs/branding/design-principles.md` and `/docs/branding/style-guide.md`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages`

This verification ensures changes meet design standards and user requirements.

### Comprehensive Design Review

Invoke the `@agent-design-review` subagent for thorough design validation when:

- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- Needing comprehensive accessibility and responsiveness testing
