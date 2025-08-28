# Atomic Jolt Style Guide

This style guide defines the core design principles, typography, colors, UI elements, shadows, and theme guidance for consistent branding across all platforms.

---

## Typography

**Typeface:** `Rubik`
Supports **uppercase, lowercase, numbers, and symbols** (`abcdefghijklmnopqrstuvwxyz 1234567890!@#$%^&*()`).

### Headings

- **Heading 1 (Desktop)**

  - Font size: 56px / 3.5rem
  - Line height: 120%

- **Heading 1 (Mobile)**

  - Font size: 40px / 2.5rem
  - Line height: 120%

- **Heading 2 (Desktop)**

  - Font size: 48px / 3rem
  - Line height: 120%

- **Heading 2 (Mobile)**

  - Font size: 36px / 2.25rem
  - Line height: 120%

- **Heading 3 (Desktop)**

  - Font size: 32px / 2rem
  - Line height: 120%

- **Heading 3 (Mobile)**

  - Font size: 32px / 2rem
  - Line height: 130%

- **Heading 4**

  - Font size: 24px / 1.5rem
  - Line height: 140%

- **Heading 5**

  - Font size: 20px / 1.25rem
  - Line height: 140%

- **Heading 6 (Desktop)**

  - Font size: 18px / 1.125rem
  - Line height: 140%

- **Heading 6 (Mobile)**
  - Font size: 14px / 1rem
  - Line height: 150%

### Tagline

- Font size: 18px / 1rem
- Line height: 150%

### Body Text

- **Large**

  - Font size: 24px
  - Line height: 150%

- **Regular**

  - Font size: 16px
  - Line height: 150%

- **Small**

  - Font size: 14px
  - Line height: 150%

- **Tiny**
  - Font size: 14px
  - Line height: 150%

---

## Colours

### Primitive Colours

Primitive colors are the **foundational tokens** of the design system.
They should **not be altered directly**; instead, build semantic roles (e.g., `background-primary`, `text-muted`) from these primitives.

### Brand Colours

- Yellow: `#FFDD00`
- Yellow Dark: `#EBCB00`
- Yellow Light: `#FFEB66`
- Off-white: `#FFFDF0`
- Black: `#000000`
- White: `#FFFFFF`

### Neutral Palette

- Black: `#000000`
- White: `#FFFFFF`
- Neutral Lightest: `#EEEEEE`
- Neutral Light: `#D0D0D0`
- Neutral: `#666666`
- Neutral Dark: `#333333`
- Neutral Darkest: `#111111`

### System Colours

- Success Green: `#027A48`
- Success Green Light: `#ECFDF3`
- Error Red: `#B42318`
- Error Red Light: `#FEF3F2`

**Usage Notes**

- **Brand colors** define identity and branding elements.
- **Neutrals** are used for backgrounds, borders, and text.
- **System colors** are reserved for status/feedback (success, error).
- **Use white backgrounds**.

---

## UI Elements

### Buttons

- **Variants:**

  - Solid filled (brand yellow or black background)
  - Outline (border with transparent background)
  - Ghost (minimal, text-only with hover/active states)

- **Affordances:**

  - Support arrow icons (→) to indicate action.
  - Active and hover states use **yellow highlights**.

- **Theme Adaptation:**
  - Light theme: yellow or black on white backgrounds.
  - Dark theme: yellow or white on black backgrounds.

---

### Inputs

- **Text Fields** (Name, Email, Message)

  - Labels above inputs.
  - Placeholder text inside.
  - Helper text below when needed.

- **Dropdowns**

  - Label above, selection styled with neutral borders.
  - Active states highlight with brand yellow.

- **Radio Buttons**
  - Circular, with yellow fill for active state.
  - Clear contrast between options.

---

### Tags

- **Shape:** Pill/rounded rectangle.
- **Style:** Uppercase text (e.g., `CATEGORY`).
- **Theme Adaptation:**
  - Light: black text on white/yellow background.
  - Dark: white text on black/yellow background.

---

## Shadows

Shadows provide depth and hierarchy. Seven levels are defined:

- **xxsmall**
- **xsmall**
- **small**
- **medium**
- **large**
- **xlarge**
- **xxlarge**

**Usage Guidelines:**

- `xxsmall–small`: Inputs, cards, lightweight elements.
- `medium–large`: Modals, dropdowns, elevated surfaces.
- `xlarge–xxlarge`: Overlays, dialogs, focus-grabbing UI.

---

## Theme Support

The design system supports **Light Mode and Dark Mode**.

- **Light Theme:** Black/neutral text on white/yellow backgrounds.
- **Dark Theme:** White text on black backgrounds, yellow as accent.
- All components (buttons, inputs, tags) adapt accordingly.

---

## General Guidelines

1. **Consistency First:** Always use defined tokens and components; avoid ad hoc colors or typography.
2. **Accessibility:** Maintain sufficient contrast (especially in dark mode).
3. **Scalability:** Typography scales down appropriately on mobile.
4. **Feedback Indicators:** Always use system colors for success/error.
5. **Hierarchy:** Use shadows and typography to establish visual order.

---
