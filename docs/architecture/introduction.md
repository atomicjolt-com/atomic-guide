# Introduction

This document outlines the architectural approach for enhancing the existing LTI 1.3 starter application into **Atomic Guide/Focus** - a Progressive Cognitive Learning Infrastructure platform that achieves 50-80% improvement in knowledge retention through retrieval practice (Adesope et al., 2017) and 35-50% improvement through optimal spaced repetition (Cepeda et al., 2008). Its primary goal is to serve as the guiding architectural blueprint for AI-driven development of new features while ensuring seamless integration with the existing LTI 1.3 foundation.

**Related Documentation:**
- **Front-End Specification:** See `docs/front-end-spec.md` for comprehensive UI/UX design system, user flows, wireframes, and component specifications
- **Product Requirements:** See `docs/prd.md` for complete product requirements and functional specifications

**Target Outcomes:**

- Reduce STEM gateway course failure rates by 15-25% using adaptive difficulty adjustment (Chrysafiadi et al., 2023)
- Create portable "Learner DNA" profiles with individualized forgetting curves and optimal spacing intervals
- Increase engagement by 35% through conversational assessment (Yildirim-Erbasli & Bulut, 2023)
- Enable cross-course intelligence with 70-80% accuracy in predicting performance challenges

**Relationship to Existing Architecture:**
This document supplements the existing LTI starter architecture by defining how new cognitive learning components will integrate with current authentication, routing, and storage systems. Where conflicts arise between new patterns (D1 multi-tenant databases, React components) and existing patterns (KV storage, vanilla JS), this document provides guidance on maintaining consistency during the transition while preserving all working LTI 1.3 functionality.

## Existing Project Analysis

**Current Project State:**

- **Primary Purpose:** LTI 1.3 tool provider starter application with Canvas LMS integration
- **Current Tech Stack:** Cloudflare Workers (Hono framework), KV namespaces, Durable Objects, Vite bundling
- **Architecture Style:** Serverless edge computing with event-driven LTI handlers
- **Deployment Method:** Cloudflare Workers with custom domain routing

**Available Documentation:**

- CLAUDE.md with development commands and architecture overview
- Comprehensive PRD defining Atomic Guide requirements
- Front-end UI/UX Specification (docs/front-end-spec.md) with design system, user flows, and component specifications
- Existing codebase demonstrating LTI 1.3 patterns

**Identified Constraints:**

- Must maintain backward compatibility with existing LTI launches
- Frame-friendly security requirements for LMS embedding
- KV namespace limitations for relational data (driving D1 adoption)

**Key Integration Insights (from Mind Mapping):**

- Foundation provides 80% of required authentication infrastructure
- Natural extension points exist in client entry system
- Durable Objects perfectly suited for real-time struggle detection
- Incremental enhancement path available without breaking changes

## Change Log

| Change               | Date       | Version | Description                                                         | Author              |
| -------------------- | ---------- | ------- | ------------------------------------------------------------------- | ------------------- |
| Initial Architecture | 2025-08-20 | 1.0     | Created brownfield architecture for Atomic Guide enhancement        | Winston (Architect) |
| AI Guide Chat Update | 2025-08-20 | 1.1     | Added AI Guide chat interface architecture and real-time components | Winston (Architect) |
| React Migration      | 2025-08-20 | 1.2     | Documented React-based LTI launch with atomic-fuel integration      | Winston (Architect) |
| Canvas postMessage   | 2025-08-20 | 1.3     | Added Canvas postMessage integration architecture and security      | Winston (Architect) |
| Empirical foundation | 2025-08-20 | 1.4     | Added empirical foundations, cognitive algorithms, and use cases    | Winston (Architect) |
| Front-End Spec       | 2025-08-21 | 1.5     | Integrated UI/UX specification with design system and personas      | Winston (Architect) |
