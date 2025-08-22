# Design System Implementation

## Atomic Jolt Brand Integration

The architecture implements the Atomic Jolt design system as specified in the front-end specification:

**Brand Colors:**

- Primary: Atomic Yellow (#FFDD00) - CTAs, active states, progress indicators
- Success: Green (#027A48) - Correct answers, achievements
- Error: Red (#B42318) - Errors, urgent alerts
- Warning: Amber (#FDB022) - Warnings, medium priority
- Info: Blue (#2563EB) - Information, secondary actions

**Typography:**

- Primary Font: Rubik (all UI text)
- Monospace: Rubik Mono (code snippets)
- Type Scale: 32px (H1) down to 11px (caption)
- Font Weights: 300 (Light), 400 (Regular), 500 (Medium)

**Spacing & Layout:**

- 8-point grid system for consistent spacing
- Maximum content width: 1200px (portal UI)
- Chat panel: 380px (desktop), 100% - 32px (mobile)
- Minimum touch targets: 44x44px

**Visual Effects:**

- Shadows: 3 elevation levels for depth
- Border radius: 6px (small), 8px (medium), 12px (large)
- Transitions: 150ms (micro), 300ms (standard), 500ms (slow)
