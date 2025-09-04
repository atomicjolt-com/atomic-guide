# API Endpoints Reference

Complete reference for all Atomic Guide API endpoints.

## Base URL

```
Production: https://guide.atomicjolt.xyz/api
Development: http://localhost:5988/api
```

## Authentication

All API endpoints require JWT authentication via Bearer token:

```http
Authorization: Bearer <jwt_token>
```

## Chat API

### Send Message

```http
POST /api/chat/message
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "message": "string",
  "sessionId": "string",
  "context": {
    "courseId": "string",
    "topicId": "string"
  }
}
```

**Response** (Server-Sent Events):

```
data: {"chunk": "text", "type": "text"}
data: {"chunk": "\\LaTeX", "type": "latex"}
data: {"done": true, "tokenUsage": 150}
```

### Get History

```http
GET /api/chat/history/{sessionId}
Authorization: Bearer <jwt>
```

**Response**:

```json
{
  "messages": [
    {
      "id": "string",
      "role": "user|assistant",
      "content": "string",
      "timestamp": "ISO 8601"
    }
  ],
  "metadata": {
    "tokenCount": 1500,
    "model": "llama-3-8b"
  }
}
```

## Assessment API

### Create Assessment

```http
POST /api/assessments/create
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "title": "string",
  "courseId": "string",
  "type": "formative|summative",
  "questions": [...],
  "settings": {
    "timeLimit": 3600,
    "attempts": 3
  }
}
```

### Get Assessment

```http
GET /api/assessments/{id}
Authorization: Bearer <jwt>
```

### Submit Assessment

```http
POST /api/assessments/{id}/submit
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "responses": [
    {
      "questionId": "string",
      "answer": "any"
    }
  ]
}
```

### Get Results

```http
GET /api/assessments/{id}/results
Authorization: Bearer <jwt>
```

## Analytics API

### Get Dashboard

```http
GET /api/analytics/dashboard
Authorization: Bearer <jwt>
Query Parameters:
  - courseId: string
  - timeRange: day|week|month|semester
  - metrics: performance,engagement,struggle
```

### Get Student Analytics

```http
GET /api/analytics/student/{studentId}
Authorization: Bearer <jwt>
```

### Export Analytics

```http
POST /api/analytics/export
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "format": "pdf|csv|json",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  }
}
```

## FAQ API

### Search FAQs

```http
GET /api/faq/search
Query Parameters:
  - q: string (search query)
  - limit: number (max results)
  - category: string (filter by category)
```

### Get FAQ

```http
GET /api/faq/{id}
```

### Submit Feedback

```http
POST /api/faq/{id}/feedback
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "helpful": boolean,
  "comment": "string"
}
```

## LTI API

### LTI Launch

```http
POST /lti/launch
Content-Type: application/x-www-form-urlencoded

id_token=<jwt>&state=<state>
```

### Deep Linking

```http
POST /lti/deep_link
Content-Type: application/x-www-form-urlencoded

JWT=<deep_linking_jwt>
```

### JWKS Endpoint

```http
GET /lti/jwks
```

**Response**:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "n": "...",
      "e": "AQAB",
      "kid": "..."
    }
  ]
}
```

## User API

### Get Profile

```http
GET /api/user/profile
Authorization: Bearer <jwt>
```

### Update Settings

```http
PUT /api/user/settings
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "theme": "light|dark",
  "notifications": boolean,
  "privacy": {...}
}
```

## Content API

### Extract Content

```http
POST /api/content/extract
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "url": "string",
  "type": "page|pdf|video"
}
```

### Get Resources

```http
GET /api/content/resources
Authorization: Bearer <jwt>
Query Parameters:
  - courseId: string
  - type: document|video|quiz
```

## Admin API

### Get Tenants

```http
GET /api/admin/tenants
Authorization: Bearer <admin_jwt>
```

### Update Configuration

```http
PUT /api/admin/config
Content-Type: application/json
Authorization: Bearer <admin_jwt>

{
  "setting": "value"
}
```

## WebSocket API

### Chat WebSocket

```javascript
ws://localhost:5988/ws/chat

// Send message
{
  "type": "message",
  "content": "Hello",
  "sessionId": "123"
}

// Receive message
{
  "type": "response",
  "content": "Hi there!",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Error Responses

All endpoints return standard error format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {...},
    "timestamp": "ISO 8601"
  }
}
```

### Error Codes

| Code             | HTTP Status | Description              |
| ---------------- | ----------- | ------------------------ |
| UNAUTHORIZED     | 401         | Invalid or missing token |
| FORBIDDEN        | 403         | Insufficient permissions |
| NOT_FOUND        | 404         | Resource not found       |
| VALIDATION_ERROR | 400         | Invalid request data     |
| RATE_LIMIT       | 429         | Too many requests        |
| SERVER_ERROR     | 500         | Internal server error    |

## Rate Limiting

Default rate limits:

- Chat API: 100 requests/minute
- Assessment API: 10 requests/minute
- Analytics API: 50 requests/minute
- General API: 200 requests/minute

Headers returned:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination:

```http
GET /api/resources?page=2&limit=20
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## Versioning

API version specified in URL or header:

```http
GET /api/v2/chat/message
Accept: application/vnd.atomicguide.v2+json
```

## CORS

Allowed origins configured per environment:

- Production: LMS domains only
- Development: `http://localhost:*`

## SDK Examples

### JavaScript/TypeScript

```typescript
import { AtomicGuideClient } from '@atomicjolt/guide-client';

const client = new AtomicGuideClient({
  baseUrl: 'https://guide.atomicjolt.xyz',
  token: 'jwt_token',
});

// Send chat message
const response = await client.chat.sendMessage({
  message: 'Hello',
  sessionId: '123',
});

// Get analytics
const analytics = await client.analytics.getDashboard({
  courseId: 'cs101',
  timeRange: 'week',
});
```

### Python

```python
from atomicguide import Client

client = Client(
    base_url="https://guide.atomicjolt.xyz",
    token="jwt_token"
)

# Send chat message
response = client.chat.send_message(
    message="Hello",
    session_id="123"
)

# Get analytics
analytics = client.analytics.get_dashboard(
    course_id="cs101",
    time_range="week"
)
```
