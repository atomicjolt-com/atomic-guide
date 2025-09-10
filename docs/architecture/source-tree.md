# Source Tree

This is a reference to the comprehensive source tree documentation.

For detailed source tree structure and organization, see: [source-tree-integration.md](./source-tree-integration.md)

## Quick Reference

The project follows vertical slice architecture:

```
src/
├── features/           # Feature-based vertical slices
│   └── [feature]/
│       ├── client/     # React components, hooks, store
│       ├── server/     # Handlers, services, repositories
│       └── shared/     # Types, schemas
└── shared/            # Cross-feature code
```

Please refer to the linked document for the complete source tree specification and integration guidelines.