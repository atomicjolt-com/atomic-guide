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

Visit `http://localhost:5989/embed` to see the application.

**Authentication**: The application requires authentication. You can:
1. **Email/Password**: Sign up at `http://localhost:5990/auth/signup`
2. **OAuth Providers**: Sign in with Google or GitHub at `http://localhost:5990/auth/login`
3. Access the application at `http://localhost:5990/embed`

**OAuth Setup**: See [OAuth Setup Guide](./docs/authentication/oauth-setup.md) for configuring Google and GitHub authentication.

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

### Core Learning Platform
- **🤖 AI Chat Assistant** - Context-aware tutoring with LaTeX and code support
- **📝 Automated Assessments** - AI-generated quizzes with deep linking
- **📊 Learning Analytics** - Real-time insights and performance tracking
- **📚 Content Intelligence** - Semantic search across course materials
- **🔌 LTI 1.3 Integration** - Seamless LMS integration
- **⚡ Edge Performance** - Sub-50ms response times globally
- **🔐 Authentication System** - Secure login with OAuth (Google/GitHub) support
- **🎯 Struggle Detection** - Real-time learning difficulty detection with proactive interventions

### 🧬 NEW: Learner DNA & Predictive Intelligence (v1.4+)
- **🎯 Cognitive Profiling** - Privacy-first learning pattern recognition that builds personalized student profiles
- **🔮 Predictive Interventions** - AI-powered early warning system that predicts struggles 15-20 minutes before they occur
- **💡 Proactive Recommendations** - Intelligent suggestions delivered automatically based on real-time behavioral analysis
- **👩‍🏫 Instructor Alerts** - Early warning notifications with specific, actionable intervention recommendations
- **🛡️ Privacy Controls** - Comprehensive consent management with transparent data collection and student agency
- **📈 Learning Velocity** - Personalized time-to-mastery predictions based on individual cognitive patterns

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
