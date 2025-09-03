# Atomic Guide

AI-Powered Educational Assistant for Learning Management Systems - Intelligent tutoring, automated assessments, and real-time learning analytics at the edge.

## 🚀 Live Demo

**Application**: [https://guide.atomicjolt.xyz](https://guide.atomicjolt.xyz)  
**LTI Registration**: `https://guide.atomicjolt.xyz/lti/register`

## 🎯 What is Atomic Guide?

Atomic Guide is an AI-powered educational platform that seamlessly integrates with Learning Management Systems (LMS) via LTI 1.3. Built on Cloudflare's edge computing infrastructure, it provides:

- **🤖 AI Chat Assistant** - Context-aware tutoring with LaTeX and code support
- **📝 Automated Assessments** - AI-generated quizzes with deep linking
- **📊 Learning Analytics** - Real-time insights and performance tracking
- **📚 Content Intelligence** - Semantic search across course materials
- **⚡ Edge Performance** - Sub-50ms response times globally

## 🏃 Quick Start

```bash
# Clone the repository
git clone https://github.com/atomicjolt-com/atomic-guide.git
cd atomic-guide

# Install dependencies
npm install

# Set up infrastructure
npm run db:setup    # Create D1 database
npm run kv:setup    # Create KV namespaces

# Run migrations and seed data
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

Visit `http://localhost:5988/test` to see the application.

## 📖 Documentation

Complete documentation is available in the [docs](./docs) directory:

- **[Getting Started Guide](./docs/getting-started/)** - Installation and setup
- **[Architecture Overview](./docs/architecture/)** - System design and components
- **[Development Guide](./docs/development/)** - Commands, testing, and debugging
- **[API Reference](./docs/api/)** - Endpoints and authentication
- **[LTI Integration](./docs/lti-developer-guide.md)** - LMS integration guide
- **[Deployment Guide](./docs/deployment/)** - Production deployment

For a complete documentation index, see [docs/index.md](./docs/index.md).

## 🛠️ Key Technologies

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) (V8 isolates)
- **Framework**: [Hono](https://hono.dev/) (lightweight web framework)
- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at the edge)
- **AI**: [Workers AI](https://developers.cloudflare.com/workers-ai/)
- **Vector Search**: [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/)
- **Real-time**: [Durable Objects](https://developers.cloudflare.com/workers/learning/using-durable-objects/)

## 📦 Project Structure

```
src/
├── features/          # Feature-based vertical slices
│   ├── chat/         # AI chat functionality
│   ├── assessment/   # Assessment generation
│   ├── dashboard/    # Analytics dashboard
│   └── lti/         # LTI protocol handling
└── shared/           # Cross-feature shared code
```

See [Architecture Documentation](./docs/architecture/vertical-slice-refactoring.md) for details.

## 🧑‍💻 Development

### Common Commands

```bash
npm run dev          # Start development server
npm test            # Run tests
npm run build       # Build production bundle
npm run deploy      # Deploy to Cloudflare
npm run lint        # Run ESLint
npm run db:migrate  # Run database migrations
```

See [Development Guide](./docs/development/commands.md) for all available commands.

### Testing

```bash
npm test                     # Run all tests
npm test -- --watch         # Watch mode
npm run test:integration    # Integration tests
```

## 🚀 Deployment

1. Configure Cloudflare account in `wrangler.jsonc`
2. Run database migrations: `npm run db:migrate:remote`
3. Deploy: `npm run deploy`

See [Deployment Guide](./docs/deployment/cloudflare.md) for detailed instructions.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./docs/contributing/guidelines.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏢 About Atomic Jolt

[Atomic Jolt](https://www.atomicjolt.com) builds innovative educational technology solutions. We specialize in LTI integrations, AI-powered learning tools, and scalable EdTech platforms.

## 🆘 Support

- **Documentation**: [docs/index.md](./docs/index.md)
- **Issues**: [GitHub Issues](https://github.com/atomicjolt-com/atomic-guide/issues)
- **Discussions**: [GitHub Discussions](https://github.com/atomicjolt-com/atomic-guide/discussions)
- **Commercial Support**: [Contact Atomic Jolt](https://www.atomicjolt.com/contact)

---

Built with ❤️ by [Atomic Jolt](https://www.atomicjolt.com)