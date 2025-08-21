# Accessibility & Responsive Design Implementation

## WCAG 2.1 AA Compliance

Per the front-end specification, the architecture ensures accessibility through:

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

## Responsive Breakpoints

| Breakpoint | Min Width | Max Width | Target Devices | Key Adaptations |
|------------|-----------|-----------|----------------|----------------|
| Mobile | 320px | 767px | Phones | Single column, FAB above thumb zone |
| Tablet | 768px | 1023px | Tablets | Two column, FAB in side rail |
| Desktop | 1024px | 1439px | Laptops | Full layout, FAB bottom-right |
| Wide | 1440px | - | Large monitors | Maximum 1200px content width |

## Animation & Micro-interactions

Following the front-end spec motion principles:

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

## Performance Critical Paths

1. Canvas event capture via custom JS (0ms)
2. MessageChannel communication (1ms)
3. PostMessage validation & processing (2ms)
4. WebSocket to Durable Object (5ms)
5. Pattern matching algorithm (20ms)
6. Intervention trigger (30ms)
   Total: ~38-50ms (within 100ms budget)

**AI Chat Response Pipeline (<200ms target):**

1. Message reception via WebSocket (5ms)
2. Canvas context extraction (10ms)
3. Learner DNA retrieval from cache/D1 (15ms)
4. AI API call (100-150ms)
5. Response streaming initiation (20ms)
   Total: ~150-200ms (streaming for perceived speed)

**Profile Update Pipeline (<500ms):**

1. Batch signal aggregation
2. Cloudflare AI inference
3. D1 profile update
4. Cache invalidation

**Chat Rate Limiting (FR14):**

- Token budget: 10,000 tokens per learner per day
- Rate limit: 20 messages per minute per learner
- FAQ cache hit target: 40% of queries (instant response)
- Conversation history: Last 20 messages retained in memory

**Front-End Performance Goals:**
- Initial Load: <3s on 3G connection
- Time to Interactive: <5s on average hardware
- Interaction Response: <100ms for user inputs
- Animation FPS: Consistent 60fps for all animations
- Bundle Size: <200kb initial JavaScript bundle

## Failure Isolation & Recovery

**Component Isolation Strategy:**

- Canvas Monitor failure → Core LTI functionality preserved
- Cognitive Engine failure → Graceful degradation to basic tracking
- MCP OAuth failure → Internal features continue working
- D1 failure → KV cache provides read-only fallback
- AI Chat failure → FAQ fallback and cached responses

**Circuit Breaker Patterns:**

- D1 connection pool exhaustion → Temporary KV cache
- AI inference timeout → Rule-based algorithm fallback
- WebSocket disconnection → Exponential backoff retry
- Redux store overflow → Selective state pruning
- AI API failure → FAQ knowledge base + cached responses (FR17)
- Chat rate limit exceeded → Graceful throttling with user notification
