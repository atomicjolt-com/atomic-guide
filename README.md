# Atomic Guide

AI-Powered Educational Assistant for Learning Management Systems - Intelligent tutoring, automated assessments, and real-time learning analytics at the edge.

## 🚀 Quick Start

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

**Live Demo**: [https://guide.atomicjolt.xyz](https://guide.atomicjolt.xyz)
**LTI Registration**: `https://guide.atomicjolt.xyz/lti/register`

## 📖 Documentation

For complete documentation, see the [docs](./docs/) directory or start with:

- **[Documentation Index](./docs/index.md)** - Complete documentation overview
- **[Getting Started](./docs/getting-started/)** - Installation and setup guide
- **[Development Guide](./docs/development/)** - Commands, testing, and debugging
- **[Architecture](./docs/architecture/)** - System design and technical details
- **[API Reference](./docs/api/)** - Endpoints and integration guide

## 🛠️ Key Features

- **🤖 AI Chat Assistant** - Context-aware tutoring with LaTeX and code support
- **📝 Automated Assessments** - AI-generated quizzes with deep linking
- **📊 Learning Analytics** - Real-time insights and performance tracking
- **📚 Content Intelligence** - Semantic search across course materials
- **🔌 LTI 1.3 Integration** - Seamless LMS integration
- **⚡ Edge Performance** - Sub-50ms response times globally

## 🧑‍💻 Development

```bash
npm run dev          # Start development server
npm test            # Run tests
npm run build       # Build production bundle
npm run deploy      # Deploy to Cloudflare
```

See [Development Commands](./docs/development/commands.md) for the complete list.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/index.md](./docs/index.md)
- **Issues**: [GitHub Issues](https://github.com/atomicjolt-com/atomic-guide/issues)
- **Commercial Support**: [Contact Atomic Jolt](https://www.atomicjolt.com/contact)

---

Built with ❤️ by [Atomic Jolt](https://www.atomicjolt.com)
