# 19. Deployment Architecture

## Deployment Strategy

**Frontend Deployment:**

- **Platform:** Cloudflare Pages (integrated with Workers)
- **Build Command:** `npm run build:client`
- **Output Directory:** `dist/client`
- **CDN/Edge:** Cloudflare's global CDN

**Backend Deployment:**

- **Platform:** Cloudflare Workers
- **Build Command:** `npm run build`
- **Deployment Method:** Wrangler CLI / GitHub Actions

## CI/CD Pipeline

```yaml