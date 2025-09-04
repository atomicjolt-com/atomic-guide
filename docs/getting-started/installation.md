# Installation Guide

This guide will help you set up Atomic Guide for local development or production deployment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (v9 or higher) - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)
- **Cloudflare Account** - [Sign up](https://dash.cloudflare.com/sign-up) (free tier works)

## System Requirements

- **Operating System**: macOS, Linux, or Windows with WSL2
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 2GB free space
- **Network**: Internet connection for Cloudflare services

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/atomicjolt-com/atomic-guide.git
cd atomic-guide
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:

- React 19 and TypeScript
- Cloudflare Workers SDK
- Vite build tools
- Testing frameworks

### 3. Install Wrangler CLI

If not already installed globally:

```bash
npm install -g wrangler
```

### 4. Authenticate with Cloudflare

```bash
wrangler login
```

This will open your browser for authentication. Grant the necessary permissions.

### 5. Verify Installation

Check that all tools are installed correctly:

```bash
# Check Node version
node --version  # Should be v18+

# Check npm version
npm --version   # Should be v9+

# Check Wrangler
wrangler --version

# Check TypeScript
npx tsc --version
```

## Environment Setup

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your settings:

```bash
# Development settings
NODE_ENV=development
LOG_LEVEL=debug

# LTI Configuration
LTI_TOOL_NAME="Atomic Guide"
LTI_TOOL_DOMAIN="localhost:5988"

# AI Services (optional for local dev)
AI_MODEL="@cf/meta/llama-3-8b-instruct"
```

### 3. Configure Wrangler

Update `wrangler.jsonc` with your Cloudflare account details:

```json
{
  "name": "atomic-guide",
  "account_id": "YOUR_ACCOUNT_ID",
  "workers_dev": true
}
```

Find your account ID:

```bash
wrangler whoami
```

## Infrastructure Setup

### 1. Create D1 Database

```bash
npm run db:setup
```

This creates a Cloudflare D1 database and updates your configuration.

### 2. Create KV Namespaces

```bash
npm run kv:setup
```

This creates all required KV namespaces for:

- LTI key storage
- Platform configurations
- Session management
- Cache storage

### 3. Run Database Migrations

```bash
npm run db:migrate
```

This sets up the database schema for:

- User profiles
- Chat sessions
- Assessment data
- Analytics tracking

### 4. Seed Sample Data (Optional)

```bash
npm run db:seed
```

Adds sample data for testing and development.

## Verify Installation

### 1. Start Development Server

```bash
npm run dev
```

### 2. Access the Application

Open your browser to:

- Application: `http://localhost:5988/test`
- Home page: `http://localhost:5988`

### 3. Run Tests

Verify everything is working:

```bash
npm test
```

## Common Installation Issues

### Issue: Wrangler Authentication Failed

**Solution**: Clear credentials and re-authenticate:

```bash
wrangler logout
wrangler login
```

### Issue: Database Creation Failed

**Solution**: Ensure you have the correct permissions:

```bash
wrangler d1 list  # Should show your databases
```

### Issue: Port Already in Use

**Solution**: Change the port in `package.json`:

```json
"dev": "vite --port 5989"
```

### Issue: TypeScript Errors

**Solution**: Ensure TypeScript is properly configured:

```bash
npm run check
```

## IDE Setup

### Visual Studio Code

Install recommended extensions:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense

### WebStorm/IntelliJ

- Enable TypeScript service
- Configure ESLint integration
- Set up Prettier on save

## Next Steps

- [Quick Start Guide](./quick-start.md) - Get up and running quickly
- [Configuration Guide](./configuration.md) - Configure LTI and services
- [Development Guide](../development/setup.md) - Start developing features

## Getting Help

- [Troubleshooting Guide](../development/debugging.md)
- [GitHub Issues](https://github.com/atomicjolt-com/atomic-guide/issues)
- [Community Discord](https://discord.gg/atomicjolt)
