# Source Tree Integration

**Existing Project Structure:**

```

atomic-guide/
├── client/ # Client-side entry points
├── src/ # Server-side Cloudflare Worker
├── public/ # Static assets
├── definitions.ts # Constants and paths
└── wrangler.jsonc # Worker configuration

```

**New File Organization:**

```

atomic-guide/
├── client/ # Existing + React components
│ ├── app.tsx # React-based LTI launch entry point
│ ├── root.tsx # Root React component
│ ├── components/ # NEW: React components
│ │ ├── dashboard/
│ │ │ ├── LearnerDashboard.tsx
│ │ │ └── FacultyDashboard.tsx
│ │ ├── cognitive/
│ │ │ ├── ProfileView.tsx
│ │ │ └── InterventionOverlay.tsx
│ │ ├── chat/ # NEW: AI Guide chat components per front-end spec
│ │ │ ├── ChatFAB.tsx # Floating action button (48x48px, Atomic Yellow)
│ │ │ ├── ChatWindow.tsx # Main chat interface (380px width desktop)
│ │ │ ├── MessageList.tsx # Conversation display with message bubbles
│ │ │ ├── MessageInput.tsx # Input with voice & quick actions (72px height)
│ │ │ ├── ContextBadge.tsx # Current page indicator (56px header)
│ │ │ ├── RichMessage.tsx # LaTeX/code/media rendering
│ │ │ └── ActivityCard.tsx # Flash cards, quizzes, practice problems
│ │ └── privacy/
│ │ └── PrivacyControls.tsx
│ ├── hooks/ # NEW: React hooks
│ │ ├── useCanvasMonitor.ts
│ │ ├── useLearnerProfile.ts
│ │ ├── useChat.ts # Chat WebSocket management
│ │ └── useContentExtractor.ts # Canvas DOM extraction
│ ├── store/ # NEW: Redux store
│ │ ├── configure_store.ts # Redux store configuration with atomic-fuel
│ │ ├── index.ts
│ │ ├── slices/
│ │ │ ├── learnerSlice.ts
│ │ │ ├── sessionSlice.ts
│ │ │ └── jwtSlice.ts # JWT management from atomic-fuel
│ │ └── api/ # RTK Query endpoints
│ │ ├── cognitiveApi.ts # Cognitive analytics API
│ │ ├── chatApi.ts # Chat endpoints
│ │ ├── learnerApi.ts # Learner profile API
│ │ └── baseApi.ts # Base API configuration with JWT
│ ├── libs/ # Utility libraries
│ │ ├── i18n.ts # Localization setup
│ │ ├── datepicker.ts # Date picker initialization
│ │ ├── moment.ts # Moment.js timezone config
│ │ └── get_size.ts # Canvas iframe sizing
│ └── styles/ # NEW: CSS with Atomic Jolt design system
│ ├── base.css # Base styles & resets
│ ├── variables.css # Design tokens from front-end spec
│ ├── typography.css # Rubik font system
│ ├── animations.css # Micro-interactions & transitions
│ └── components/
│ ├── dashboard.module.css
│ ├── chat.module.css # Chat-specific styles
│ └── overlay.module.css # Persistent overlay styles
├── src/ # Server-side Worker
│ ├── index.ts # Existing + new routes
│ ├── api/ # NEW: API handlers
│ │ ├──
│ │ │ ├── cognitive.ts
│ │ │ ├── learners.ts
│ │ │ ├── interventions.ts
│ │ │ └── chat.ts # Chat message handling
│ │ └── websocket.ts # WebSocket upgrade handler
│ ├── mcp/ # NEW: MCP implementation
│ │ ├── AtomicGuideMCP.ts
│ │ ├── tools.ts
│ │ ├── resources.ts
│ │ └── prompts.ts
│ ├── services/ # NEW: Business logic
│ │ ├── CognitiveEngine.ts
│ │ ├── StruggleDetector.ts
│ │ ├── InterventionService.ts
│ │ ├── ChatService.ts # AI chat orchestration
│ │ ├── ContentExtractor.ts # Canvas page parsing
│ │ └── FAQKnowledgeBase.ts # Cached responses (FR17)
│ ├── models/ # NEW: Data models
│ │ ├── learner.ts
│ │ ├── session.ts
│ │ ├── knowledge.ts
│ │ └── chat.ts # Chat conversation models
│ └── db/ # NEW: D1 utilities
│ ├── schema.sql # Includes chat_conversations, chat_messages
│ ├── migrations/
│ └── queries.ts
├── scripts/ # Build & deployment
│ ├── inject-manifest.js # Existing
│ └── setup-d1.js # NEW: D1 setup
└── tests/ # Test files
├── api/
└── components/

````

**CSS Architecture Pattern:**

```css
/* variables.css - Design tokens from front-end spec */
:root {
  /* Core Brand Colors */
  --color-primary: #FFDD00; /* Atomic Yellow */
  --color-primary-hover: #F5D000;
  --color-success: #027A48;
  --color-error: #B42318;
  --color-warning: #FDB022;
  --color-info: #2563EB;

  /* Text Colors */
  --color-text: #333333;
  --color-text-secondary: #666666;
  --color-text-tertiary: #999999;

  /* Backgrounds */
  --color-bg: #FFFFFF;
  --color-bg-off-white: #FFFDF0;
  --color-bg-gray: #F5F5F5;

  /* Typography - Rubik Font System */
  --font-family: 'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-mono: 'Rubik Mono', 'Courier New', monospace;
  --font-size-h1: 32px;
  --font-size-h2: 24px;
  --font-size-h3: 20px;
  --font-size-body-lg: 16px;
  --font-size-body: 14px;
  --font-size-small: 12px;
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --line-height-base: 1.5;

  /* Spacing - 8-point Grid System */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --spacing-3xl: 64px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.15);
  --shadow-lg: 0 10px 20px rgba(0,0,0,0.20);
  --shadow-focus: 0 0 0 3px rgba(255,221,0,0.25);

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 50%;

  /* Transitions */
  --transition-micro: 150ms ease-in-out;
  --transition-standard: 300ms ease-in-out;
  --transition-slow: 500ms ease-in-out;

  /* Minimum Touch Targets */
  --touch-target-min: 44px;
}

/* Component styles using CSS modules */
.dashboard {
  font-family: var(--font-family);
  color: var(--color-text);
  padding: var(--spacing-md);
}
````

**Integration Guidelines:**

- **File Naming:** React components use PascalCase.tsx, utilities use camelCase.ts
- **Folder Organization:** Feature-based grouping within client/components and src/api
- **Import/Export Patterns:** Named exports for utilities, default exports for React components
- **CSS Organization:** CSS modules with custom properties for theming, imported directly in components
