# User Interface Design Goals

## Overall UX Vision

Create an invisible intelligence layer that enhances existing learning workflows without adding cognitive burden. The interface should feel like a natural extension of the LMS, appearing only when needed with contextual, personalized interventions that respect the learner's cognitive state and privacy preferences. The system must actively communicate privacy protection and provide user control over all interventions.

## Key Interaction Paradigms

- **AI Guide Chat Interface:** Persistent floating action button (FAB) that expands into conversational AI interface, positioned to avoid LMS UI elements
- **Context-Aware Conversations:** Chat understands current page content, allowing questions like "explain this concept" or "why is this important" without specifying what "this" is
- **Ambient Intelligence:** UI elements appear contextually based on detected struggle patterns, not constant overlays
- **Progressive Disclosure:** Start minimal, reveal complexity only as learners demonstrate readiness
- **Non-Disruptive Assistance:** Interventions that enhance focus rather than breaking it with smart throttling
- **Cognitive State Awareness:** Interface adapts based on detected attention, confusion, or overload signals
- **Privacy-First Design:** Clear privacy indicators showing what's being tracked and user-controlled quiet modes
- **Role-Based Experiences:** Distinct interfaces optimized for students, faculty, coaches, and administrators

## Core Screens and Views

- **AI Guide Chat Interface:**
  - Floating action button (FAB) with pulsing animation during detected struggle
  - Expandable chat window with message history and typing indicators
  - Context badge showing current page/assignment being discussed
  - Quick action buttons for common queries ("Explain this", "Give me an example", "Why is this important?")
  - Minimize/maximize controls to continue learning while keeping chat accessible
- **LTI Launch Landing:** Initial profile creation and onboarding flow within LMS with privacy preferences
- **Student Learning Dashboard:** Personal cognitive insights, progress visualization, and privacy controls
- **Intervention Overlay:** Context-sensitive help with sensitivity slider and dismiss options
- **Mobile Study Companion:** Responsive review schedules and quick progress checks
- **Privacy Control Center:** Data management, tracking transparency widget, and profile export options
- **Faculty Analytics Dashboard:** 30-second aggregate insights with one-click struggling student reports
- **Academic Success Coach Portal:** Early warning system with customizable alert thresholds
- **Admin Configuration Panel:** Institution-wide settings and compliance audit tools

## Accessibility: WCAG AA

Full compliance with WCAG AA standards including keyboard navigation, screen reader support, and cognitive accessibility features. Customizable intervention thresholds for students with disabilities, ensuring the system adapts to diverse baseline cognitive patterns without stigmatization.

## Branding

Atomic Guide follows the Atomic Jolt brand identity to maintain consistency across the product portfolio:

**Visual Identity:**

- **Primary Brand Color:** Atomic Jolt Yellow (#FFDD00) for key interactive elements and CTAs
- **Typography:** Rubik font family for all UI text, ensuring readability and modern aesthetic
- **Color System:**
  - Success indicators: Green (#027A48) for achievements and progress
  - Error/alert states: Red (#B42318) for critical warnings
  - Neutral UI: Grays (#666666, #333333) for secondary elements
  - Background: Off-white (#FFFDF0) for reduced eye strain during long study sessions

**Design Principles:**

- Clean, academic aesthetic that complements the LMS interface without competing for attention
- Subtle use of color psychology to indicate cognitive states (green for optimal learning zone, yellow for engagement, red for intervention needed)
- Positive framing that celebrates growth rather than highlighting deficits
- Professional appearance suitable for institutional decision-makers while remaining approachable for students
- Consistent with Atomic Jolt's established design language across all products

## Target Device and Platforms: Web Responsive

Desktop/laptop optimized for in-depth study sessions with full intervention capabilities. Mobile-first design for review features, schedule checking, and quick progress monitoring. Tablet-optimized for reading and review sessions. Parent portal access via mobile-friendly digest emails when applicable.
