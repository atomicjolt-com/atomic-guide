# 1. Introduction

This document provides the complete unified architecture for Atomic Guide Deep Linking Assessment Features, now organized using vertical slice architecture. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack while maintaining seamless integration with the existing LTI 1.3 foundation.

This architecture document combines:

- **Vertical slice architecture** organizing code by features rather than technical layers
- Complete fullstack technical specifications for deep linking assessment features
- Brownfield enhancement patterns for Progressive Cognitive Learning Infrastructure
- Proven research foundations achieving 50-80% improvement in knowledge retention
- Integration strategies preserving all existing LTI 1.3 functionality (detailed in [LTI Developer Guide](./lti-developer-guide.md))

## Architectural Approach

**Architecture Pattern:** Vertical Slice Architecture

- Features organized by business domain, not technical layers
- Shared module for cross-cutting concerns
- Clear feature boundaries with minimal cross-dependencies
- See [vertical-slice-refactoring.md](./architecture/vertical-slice-refactoring.md) for migration details

## Project Context

**Existing Project:** Atomic Guide LTI 1.3 Tool Provider

- **Type:** Brownfield enhancement to production Cloudflare Workers-based LTI tool
- **Repository:** Existing monorepo structure with `/src` for backend and `/client` for frontend
- **Key Constraints:**
  - Must maintain backward compatibility with existing LTI 1.3 authentication flows
  - Preserve current Cloudflare KV namespace structures
  - Extend existing Hono routing patterns
  - Follow established `@atomicjolt/lti-endpoints` integration patterns
  - Build upon current Vite bundling configuration

**Target Outcomes:**

- Reduce STEM gateway course failure rates by 15-25% using adaptive difficulty adjustment
- Create portable "Learner DNA" profiles with individualized forgetting curves
- Increase engagement by 35% through conversational assessment
- Enable cross-course intelligence with 70-80% accuracy in predicting performance

## Related Documentation

- **Front-End Specification:** See `docs/front-end-spec.md` for comprehensive UI/UX design system
- **Product Requirements:** See `docs/prd.md` for complete product requirements

## Change Log

| Date       | Version | Description                                                                 | Author  |
| ---------- | ------- | --------------------------------------------------------------------------- | ------- |
| 2025-08-22 | 1.0     | Initial architecture for deep linking assessment features based on PRD v1.0 | Winston |
| 2025-08-22 | 1.1     | Added Canvas postMessage integration details and D1 database schema         | Winston |
| 2025-08-22 | 1.2     | Incorporated React migration path for assessment UI components              | Winston |
| 2025-08-20 | 1.3     | Created brownfield architecture for Atomic Guide enhancement                | Winston |
| 2025-08-20 | 1.4     | Added empirical foundations, cognitive algorithms, and use cases            | Winston |
| 2025-08-21 | 1.5     | Integrated UI/UX specification with design system and personas              | Winston |
| 2025-08-22 | 2.0     | Merged comprehensive fullstack and brownfield architectures                 | Winston |
| 2025-12-29 | 3.0     | Refactored to vertical slice architecture with feature-based organization   | Claude  |
| 2025-01-01 | 3.1     | Fixed section numbering, added site feature, documented shared services     | Winston |
