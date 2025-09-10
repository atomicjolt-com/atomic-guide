# 27. Design System Implementation

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

## Accessibility & Responsive Design Implementation

### WCAG 2.1 AA Compliance

**Visual Accessibility:**

- Color contrast ratios: 4.5:1 for normal text, 3:1 for large text (18px+)
- Focus indicators: 2px solid #FFDD00 outline with 2px offset
- Text sizing: Support 200% zoom without horizontal scrolling
- Minimum 14px for body text with user-adjustable preferences

**Interaction Accessibility:**

- All interactive elements keyboard navigable via Tab
- Logical tab order following visual flow
- Skip links for repetitive content
- Screen reader support with semantic HTML5 and ARIA labels
- Touch targets: Minimum 44x44px with 8px spacing

**Cognitive Accessibility (AAA considerations):**

- Consistent navigation across pages
- Clear, simple language (8th grade reading level target)
- No automatic timeouts without warning
- Progress indicators for multi-step processes
- Help available on every screen via AI Guide

### Responsive Breakpoints

| Breakpoint | Min Width | Max Width | Target Devices | Key Adaptations                     |
| ---------- | --------- | --------- | -------------- | ----------------------------------- |
| Mobile     | 320px     | 767px     | Phones         | Single column, FAB above thumb zone |
| Tablet     | 768px     | 1023px    | Tablets        | Two column, FAB in side rail        |
| Desktop    | 1024px    | 1439px    | Laptops        | Full layout, FAB bottom-right       |
| Wide       | 1440px    | -         | Large monitors | Maximum 1200px content width        |

### Animation & Micro-interactions

**Key Animations:**

- FAB pulse: 2s breathing animation (opacity 0.6 to 1.0) when struggle detected
- Chat message appearance: 300ms slide-in with ease-out
- Card flip: 400ms 3D rotation for flash cards
- Progress milestone: Scale(1.2) pulse with spring easing
- Success celebration: 400ms scale pulse for achievements

**Reduced Motion Support:**
When `prefers-reduced-motion: reduce`:

- Replace animations with instant transitions
- Keep only essential motion (loading indicators)
- Disable auto-playing videos and parallax effects
