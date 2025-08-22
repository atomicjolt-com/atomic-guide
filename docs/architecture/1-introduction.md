# 1. Introduction

This document outlines the complete fullstack architecture for Atomic Guide Deep Linking Assessment Features, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

## Starter Template or Existing Project

**Existing Project:** Atomic Guide LTI 1.3 Tool Provider

- **Type:** Brownfield enhancement to production Cloudflare Workers-based LTI tool
- **Repository:** Existing monorepo structure with `/src` for backend and `/client` for frontend
- **Key Constraints:**
  - Must maintain backward compatibility with existing LTI 1.3 authentication flows
  - Preserve current Cloudflare KV namespace structures
  - Extend existing Hono routing patterns
  - Follow established `@atomicjolt/lti-endpoints` integration patterns
  - Build upon current Vite bundling configuration

## Change Log

| Date       | Version | Description                                                                 | Author  |
| ---------- | ------- | --------------------------------------------------------------------------- | ------- |
| 2025-08-22 | 1.0     | Initial architecture for deep linking assessment features based on PRD v1.0 | Winston |
| 2025-08-22 | 1.1     | Added Canvas postMessage integration details and D1 database schema         | Winston |
| 2025-08-22 | 1.2     | Incorporated React migration path for assessment UI components              | Winston |
