# 5. API Specification

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Atomic Guide Assessment API
  version: 1.0.0
  description: Deep linking assessment endpoints for Canvas LTI integration
servers:
  - url: https://atomic-guide.atomicjolt.com/api
    description: Production API

paths:
  /assessment/config:
    post:
      summary: Create assessment configuration
      security:
        - ltiJWT: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AssessmentConfig'
      responses:
        201:
          description: Configuration created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AssessmentConfig'

  /assessment/config/{id}:
    get:
      summary: Get assessment configuration
      security:
        - ltiJWT: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        200:
          description: Configuration retrieved

  /assessment/conversation:
    post:
      summary: Start new conversation
      security:
        - ltiJWT: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                assessment_config_id:
                  type: string
                page_content:
                  type: string
      responses:
        201:
          description: Conversation started
          content:
            application/json:
              schema:
                type: object
                properties:
                  conversation_id:
                    type: string
                  websocket_url:
                    type: string

  /assessment/conversation/{id}/message:
    post:
      summary: Send message in conversation
      security:
        - ltiJWT: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                context:
                  type: object
      responses:
        200:
          description: Message processed

  /assessment/grade:
    post:
      summary: Submit grade to Canvas AGS
      security:
        - ltiJWT: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                conversation_id:
                  type: string
                score:
                  type: number
      responses:
        200:
          description: Grade submitted

  /assessment/analytics:
    get:
      summary: Get instructor analytics
      security:
        - ltiJWT: []
      parameters:
        - in: query
          name: course_id
          schema:
            type: string
        - in: query
          name: assignment_id
          schema:
            type: string
      responses:
        200:
          description: Analytics data
          content:
            application/json:
              schema:
                type: object
                properties:
                  student_progress:
                    type: array
                  common_misconceptions:
                    type: array
                  completion_rates:
                    type: object

components:
  schemas:
    AssessmentConfig:
      type: object
      required:
        - assessment_type
        - mastery_threshold
        - grading_schema
      properties:
        assessment_type:
          type: string
          enum: [chat, flashcards, fill_blank]
        mastery_threshold:
          type: number
          minimum: 70
          maximum: 100
        grading_schema:
          type: string
          enum: [mastery, percentage, engagement]
        ai_config:
          type: object
          properties:
            temperature:
              type: number
            max_tokens:
              type: integer
            system_prompt:
              type: string

  securitySchemes:
    ltiJWT:
      type: http
      scheme: bearer
      bearerFormat: JWT
```
