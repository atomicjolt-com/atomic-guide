# AI Chat Assistant

The AI-powered chat assistant provides intelligent, contextually-aware tutoring support for students within their LMS environment.

## Overview

The chat system leverages Cloudflare Workers AI to deliver personalized learning assistance with sub-2-second response times. It maintains conversation context, supports rich media formatting, and adapts responses based on the student's learning profile and current course context.

## Key Features

### Intelligent Responses

- **AI-Powered**: Uses Cloudflare Workers AI models (Llama 3, Mistral, etc.)
- **Context-Aware**: Incorporates course materials, assignment details, and learning objectives
- **Personalized**: Adapts to individual learning styles and progress
- **Multi-Modal**: Supports text, code, mathematical expressions, and diagrams

### Rich Formatting Support

- **Markdown**: Headers, lists, emphasis, links
- **LaTeX Math**: Mathematical equations and formulas
- **Code Blocks**: Syntax highlighting for 20+ languages
- **Tables**: Structured data presentation
- **Media Embeds**: Images, videos, and interactive content

### Real-Time Features

- **Streaming Responses**: Server-sent events for immediate feedback
- **Typing Indicators**: Shows when AI is processing
- **Conversation History**: Maintains context across messages
- **Session Persistence**: Resumes conversations after interruptions

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────┐
│                 Client (React)                   │
│  ┌──────────────────────────────────────────┐  │
│  │         ChatWindow Component              │  │
│  │  ┌────────────┐  ┌──────────────────┐   │  │
│  │  │  Messages  │  │  Input Composer  │   │  │
│  │  └────────────┘  └──────────────────┘   │  │
│  └──────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────┘
                  │ WebSocket/SSE
┌─────────────────▼───────────────────────────────┐
│           Chat API Handler (Hono)               │
│  ┌──────────────────────────────────────────┐  │
│  │  - Authentication                        │  │
│  │  - Rate Limiting                         │  │
│  │  - Context Extraction                    │  │
│  └──────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              AI Service Layer                   │
│  ┌──────────────────────────────────────────┐  │
│  │  - Prompt Engineering                    │  │
│  │  - Model Selection                       │  │
│  │  - Response Streaming                    │  │
│  │  - Token Management                      │  │
│  └──────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│         Cloudflare Workers AI                   │
└──────────────────────────────────────────────────┘
```

### API Endpoints

#### Send Message

```typescript
POST /api/chat/message
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "message": "Explain the quadratic formula",
  "sessionId": "session-123",
  "context": {
    "courseId": "math-101",
    "topicId": "algebra"
  }
}

Response (SSE stream):
data: {"chunk": "The quadratic formula is ", "type": "text"}
data: {"chunk": "x = ", "type": "text"}
data: {"chunk": "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", "type": "latex"}
data: {"done": true, "tokenUsage": 45}
```

#### Get Conversation History

```typescript
GET /api/chat/history/{sessionId}
Authorization: Bearer <jwt>

Response:
{
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-01T12:00:00Z"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "Hello! How can I help you today?",
      "timestamp": "2024-01-01T12:00:01Z"
    }
  ],
  "metadata": {
    "tokenCount": 150,
    "model": "llama-3-8b"
  }
}
```

### Configuration

```typescript
// Environment variables
AI_MODEL = "@cf/meta/llama-3-8b-instruct"
MAX_TOKENS_PER_SESSION = 10000
MAX_MESSAGES_PER_MINUTE = 10
RESPONSE_TIMEOUT = 30000

// Per-tenant settings (stored in D1)
{
  "tenantId": "university-123",
  "chatSettings": {
    "model": "@cf/mistral/mistral-7b-instruct",
    "maxTokens": 15000,
    "temperature": 0.7,
    "systemPrompt": "You are a helpful tutor...",
    "features": {
      "codeExecution": true,
      "webSearch": false,
      "imageGeneration": false
    }
  }
}
```

## User Experience

### Student Interface

1. **Chat Widget**: Floating button or embedded panel
2. **Message Composer**: Rich text input with formatting toolbar
3. **Conversation View**: Threaded messages with timestamps
4. **Quick Actions**: Suggested questions and common tasks
5. **Export Options**: Save or print conversation

### Instructor Features

1. **Conversation Monitoring**: View student interactions (with permission)
2. **Analytics Dashboard**: Usage patterns and common questions
3. **Custom Prompts**: Configure AI behavior for specific courses
4. **Response Templates**: Pre-approved answers for common queries

## Security & Privacy

### Data Protection

- **Encryption**: All messages encrypted in transit and at rest
- **PII Handling**: Automatic redaction of sensitive information
- **Data Retention**: Configurable retention policies (default 30 days)
- **GDPR Compliance**: Right to deletion and data portability

### Access Control

- **Authentication**: JWT-based with LTI context
- **Authorization**: Role-based permissions (student, instructor, admin)
- **Rate Limiting**: Per-user and per-IP limits
- **Audit Logging**: All interactions logged for security review

## Performance Optimization

### Caching Strategy

- **Response Cache**: Frequently asked questions cached in KV
- **Context Cache**: Course materials cached for quick retrieval
- **Model Cache**: AI model loaded in Durable Objects

### Scalability

- **Edge Deployment**: Global distribution via Cloudflare Workers
- **Auto-Scaling**: Automatic scaling based on demand
- **Load Balancing**: Distributed across multiple regions

## Integration Points

### LMS Integration

- **LTI 1.3**: Full advantage/deep linking support
- **Canvas API**: Direct integration for enhanced context
- **Grade Passback**: Optional assessment integration

### External Services

- **Knowledge Base**: FAQ integration via Vectorize
- **Content Library**: Access to course materials
- **Analytics Platform**: Usage data export

## Monitoring & Analytics

### Metrics Tracked

- Response time (p50, p95, p99)
- Token usage per session/user/tenant
- Error rates and types
- User satisfaction ratings
- Common question patterns

### Dashboards

- Real-time usage monitoring
- Performance metrics
- Cost analysis (token usage)
- Quality metrics (helpfulness ratings)

## Troubleshooting

### Common Issues

| Issue             | Solution                                               |
| ----------------- | ------------------------------------------------------ |
| Slow responses    | Check AI model latency, consider switching models      |
| Context lost      | Verify session persistence, check Durable Object state |
| Formatting issues | Update markdown parser, check CSP headers              |
| Rate limit errors | Adjust limits in configuration                         |

## Development

### Local Testing

```bash
# Start dev server with mock AI
MOCK_AI=true npm run dev

# Test chat endpoint
curl -X POST http://localhost:5988/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

### Adding Features

1. Extend `AIService` for new capabilities
2. Update `ChatWindow` component for UI changes
3. Modify `PromptBuilder` for context enhancement
4. Add feature flags for gradual rollout

## Future Enhancements

- **Voice Input/Output**: Speech-to-text and text-to-speech
- **Multi-Language Support**: Automatic translation
- **Collaborative Chat**: Group study sessions
- **AI Tutoring Paths**: Guided learning sequences
- **Advanced Analytics**: Learning pattern recognition
