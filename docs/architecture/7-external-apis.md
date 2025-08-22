# 7. External APIs

## OpenAI API

- **Purpose:** Generate assessment questions and process student responses
- **Documentation:** https://platform.openai.com/docs/api-reference
- **Base URL(s):** https://api.openai.com/v1
- **Authentication:** Bearer token (API key)
- **Rate Limits:** 3,500 RPM for GPT-4, 90,000 TPM

**Key Endpoints Used:**

- `POST /chat/completions` - Generate assessment content and responses

**Integration Notes:** Use streaming responses for real-time chat experience, implement exponential backoff for rate limiting

## Canvas LMS API

- **Purpose:** Grade passback and roster retrieval
- **Documentation:** https://canvas.instructure.com/doc/api/
- **Base URL(s):** https://{institution}.instructure.com/api/v1
- **Authentication:** OAuth2 bearer token via LTI
- **Rate Limits:** Variable by institution (typically 700/hour)

**Key Endpoints Used:**

- `POST /api/lti/courses/{course_id}/line_items` - Create gradebook columns
- `POST /api/lti/courses/{course_id}/line_items/{line_item_id}/scores` - Submit grades
- `GET /api/lti/courses/{course_id}/names_and_roles` - Get course roster

**Integration Notes:** Cache roster data in KV, implement request queuing for rate limit management
