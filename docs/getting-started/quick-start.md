# Quick Start Guide

Get Atomic Guide running in 5 minutes! This guide assumes you've completed the [installation](./installation.md).

## 🚀 5-Minute Setup

### Step 1: Clone and Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/atomicjolt-com/atomic-guide.git
cd atomic-guide

# Install dependencies
npm install
```

### Step 2: Setup Infrastructure (2 minutes)

```bash
# Create database and KV namespaces
npm run db:setup
npm run kv:setup

# Run migrations
npm run db:migrate
```

### Step 3: Start Development (1 minute)

```bash
# Start the development server
npm run dev
```

✅ **Application is now running at** `http://localhost:5988/test`

## 🎯 Try These Features

### 1. AI Chat Assistant

Navigate to the test page and try:

- Ask a math question: "Explain the quadratic formula"
- Request code help: "Show me a Python fibonacci function"
- Test LaTeX rendering: "Write the integral of x^2"

### 2. Assessment Generation

Click "Generate Assessment" and:

- Enter a topic (e.g., "Photosynthesis")
- Select question types (multiple choice, essay)
- Review the AI-generated quiz

### 3. FAQ Search

Try the semantic search:

- Search for "how to integrate"
- Click suggested questions
- See context-aware answers

## 🔧 Basic Configuration

### Enable AI Features

Edit `wrangler.jsonc`:

```json
{
  "ai": {
    "binding": "AI"
  }
}
```

### Configure LTI (for LMS Integration)

```bash
# Your tool's registration URL
https://your-domain.com/lti/register

# Test with an LMS sandbox
Canvas: https://canvas.instructure.com
Moodle: https://sandbox.moodledemo.net
```

## 📝 Common Tasks

### Add a Test User

```bash
npm run db:query
```

Then run:

```sql
INSERT INTO users (id, email, name, role)
VALUES ('test-1', 'test@example.com', 'Test User', 'student');
```

### View Logs

```bash
# Development logs
npm run dev

# Production logs (after deploy)
npm run tail
```

### Run Tests

```bash
# Quick test
npm test

# Watch mode for development
npm test -- --watch
```

## 🚀 Deploy to Production

### 1. Configure Production

Update `wrangler.jsonc`:

```json
{
  "env": {
    "production": {
      "vars": {
        "ENVIRONMENT": "production"
      }
    }
  }
}
```

### 2. Deploy

```bash
# Deploy to Cloudflare
npm run deploy

# Verify deployment
npm run tail
```

### 3. Access Your App

Your app is now live at:

- `https://atomic-guide.YOUR-SUBDOMAIN.workers.dev`
- Or your custom domain if configured

## 🎓 LTI Integration Quick Start

### 1. Register with an LMS

Use your registration URL:

```
https://your-domain.com/lti/register
```

### 2. Add to Course

In your LMS:

1. Go to Course Settings
2. Add External Tool
3. Paste registration URL
4. Save and launch

### 3. Test the Integration

- Launch from LMS
- Verify user context
- Test deep linking
- Check grade passback

## 💡 Quick Tips

### Development Workflow

```bash
# Terminal 1: Run dev server
npm run dev

# Terminal 2: Run tests
npm test -- --watch

# Terminal 3: Database queries
npm run db:query
```

### Debugging

```bash
# Check TypeScript
npm run check

# Lint code
npm run lint

# View database
npm run db:list
```

### Performance

```bash
# Build for production
npm run build

# Analyze bundle
npm run build -- --analyze
```

## 📚 Example Code

### Create a Simple API Endpoint

```typescript
// src/features/custom/server/handlers/myApi.ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Atomic Guide!' });
});

export default app;
```

### Add a React Component

```tsx
// src/features/custom/client/components/MyComponent.tsx
export function MyComponent() {
  return (
    <div className="p-4">
      <h1>Welcome to Atomic Guide</h1>
    </div>
  );
}
```

## 🆘 Quick Troubleshooting

| Issue          | Quick Fix                                 |
| -------------- | ----------------------------------------- |
| Port in use    | Change port: `npm run dev -- --port 3001` |
| Database error | Reset: `npm run db:reset`                 |
| Build fails    | Check types: `npm run check`              |
| Tests fail     | Update snapshots: `npm test -- -u`        |

## 📖 Next Steps

Now that you're up and running:

1. **[Configuration Guide](./configuration.md)** - Customize your setup
2. **[Development Guide](../development/setup.md)** - Start building features
3. **[Architecture Overview](../architecture/)** - Understand the system
4. **[API Reference](../api/endpoints.md)** - Integrate with the backend

## 🎉 Congratulations!

You've successfully set up Atomic Guide! Join our community:

- [GitHub Discussions](https://github.com/atomicjolt-com/atomic-guide/discussions)
- [Report Issues](https://github.com/atomicjolt-com/atomic-guide/issues)
- [Contributing Guide](../contributing/guidelines.md)
