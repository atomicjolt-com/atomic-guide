# 12. Backend Architecture

## Service Architecture

### Function Organization

```
src/
├── assessment/
│   ├── handlers/
│   │   ├── configHandler.ts
│   │   ├── conversationHandler.ts
│   │   ├── gradeHandler.ts
│   │   └── analyticsHandler.ts
│   ├── services/
│   │   ├── aiService.ts
│   │   ├── canvasService.ts
│   │   ├── assessmentService.ts
│   │   ├── CognitiveEngine.ts
│   │   ├── StruggleDetector.ts
│   │   ├── InterventionService.ts
│   │   ├── ChatService.ts
│   │   ├── ContentExtractor.ts
│   │   └── FAQKnowledgeBase.ts
│   ├── repositories/
│   │   ├── conversationRepository.ts
│   │   ├── configRepository.ts
│   │   └── progressRepository.ts
│   ├── durable-objects/
│   │   ├── ConversationManager.ts
│   │   ├── StruggleDetectorDO.ts
│   │   └── ChatConversationDO.ts
│   └── routes.ts
├── api/
│   ├── handlers/
│   │   ├── cognitive.ts
│   │   ├── learners.ts
│   │   ├── interventions.ts
│   │   └── chat.ts
│   └── websocket.ts
├── mcp/
│   ├── AtomicGuideMCP.ts
│   ├── tools.ts
│   ├── resources.ts
│   └── prompts.ts
├── middleware/
│   ├── ltiAuth.ts          # Existing
│   └── errorHandler.ts     # Existing
├── models/
│   ├── learner.ts
│   ├── session.ts
│   ├── knowledge.ts
│   └── chat.ts
├── db/
│   ├── schema.sql
│   ├── migrations/
│   └── queries.ts
└── index.ts                 # Main Hono app
```

### Function Template

```typescript
// Handler template for assessment endpoints
import { Context } from 'hono';
import { assessmentService } from '../services/assessmentService';
import { validateRequest } from '../utils/validation';

export async function createConfigHandler(c: Context) {
  try {
    // Extract and validate request
    const body = await c.req.json();
    const validation = validateRequest(body, configSchema);
    if (!validation.valid) {
      return c.json({ error: validation.errors }, 400);
    }

    // Get LTI context from middleware
    const ltiContext = c.get('ltiContext');

    // Process request
    const config = await assessmentService.createConfig({
      ...body,
      platform_id: ltiContext.platform_id,
      created_by: ltiContext.user_id,
    });

    // Return response
    return c.json(config, 201);
  } catch (error) {
    console.error('Config creation error:', error);
    return c.json(
      {
        error: 'Failed to create configuration',
      },
      500
    );
  }
}
```

## Database Architecture

### Repository Pattern (MANDATORY)

**All database access must follow the Repository Pattern with strict layer separation:**

- **Handlers** → **Services** → **Repositories** → **Database**
- Handlers MUST NOT make direct database calls
- Services MUST NOT call `db.getDb()` directly
- All SQL queries MUST be contained within Repository classes

#### Architecture Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Handler   │───▶│   Service   │───▶│ Repository  │───▶│  Database   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     │                     │                     │              │
     │                     │                     │              │
     ▼                     ▼                     ▼              ▼
  • Validation         • Business logic      • SQL queries   • D1 Storage
  • Request/Response   • Data transformation • Data mapping   • Transactions
  • Error handling     • Service coordination• Query building • Persistence
```

#### Base Repository Class

```typescript
import { DatabaseService } from '@shared/server/services/database';
import { z } from 'zod';

/**
 * Base repository providing common CRUD operations and database access patterns.
 * 
 * All feature repositories MUST extend this class and follow the established patterns.
 */
export abstract class BaseRepository<TEntity, TEntityId = string> {
  protected readonly tableName: string;
  protected readonly entitySchema: z.ZodSchema<TEntity>;
  
  constructor(
    protected readonly databaseService: DatabaseService,
    tableName: string,
    entitySchema: z.ZodSchema<TEntity>
  ) {
    this.tableName = tableName;
    this.entitySchema = entitySchema;
  }

  /**
   * Get database connection - centralized access point
   */
  protected getDb(): D1Database {
    return this.databaseService.getDb();
  }

  /**
   * Validate entity data before database operations
   */
  protected validateEntity(data: unknown): TEntity {
    return this.entitySchema.parse(data);
  }

  /**
   * Generic create operation
   */
  async create(entity: Omit<TEntity, 'id'>): Promise<TEntity> {
    const id = crypto.randomUUID();
    const validated = this.validateEntity({ ...entity, id });
    
    // Derived classes implement specific SQL
    return await this.performCreate(validated);
  }

  /**
   * Generic find by ID operation
   */
  async findById(id: TEntityId): Promise<TEntity | null> {
    const result = await this.getDb()
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first();

    if (!result) return null;
    return this.validateEntity(result);
  }

  /**
   * Generic update operation
   */
  async update(id: TEntityId, updates: Partial<TEntity>): Promise<TEntity> {
    // Derived classes implement specific SQL
    return await this.performUpdate(id, updates);
  }

  /**
   * Generic delete operation
   */
  async delete(id: TEntityId): Promise<void> {
    await this.getDb()
      .prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .run();
  }

  // Abstract methods for derived classes
  protected abstract performCreate(entity: TEntity): Promise<TEntity>;
  protected abstract performUpdate(id: TEntityId, updates: Partial<TEntity>): Promise<TEntity>;
}
```

#### Feature-Specific Repository Implementation

```typescript
import { BaseRepository } from '@shared/server/repositories/BaseRepository';
import { DatabaseService } from '@shared/server/services/database';
import { conversationSchema, type Conversation } from '../shared/schemas/conversation';

/**
 * Repository for conversation data access operations.
 * 
 * Handles all database operations for conversations following the established
 * repository pattern and maintaining proper data validation.
 */
export class ConversationRepository extends BaseRepository<Conversation> {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'conversations', conversationSchema);
  }

  protected async performCreate(conversation: Conversation): Promise<Conversation> {
    await this.getDb()
      .prepare(`
        INSERT INTO conversations
        (id, assessment_config_id, user_id, course_id, status, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        conversation.id,
        conversation.assessment_config_id,
        conversation.user_id,
        conversation.course_id,
        'active',
        JSON.stringify(conversation.metadata || {}),
        new Date().toISOString()
      )
      .run();

    return conversation;
  }

  protected async performUpdate(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const values: unknown[] = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    });
    
    values.push(id); // Add ID for WHERE clause
    
    await this.getDb()
      .prepare(`UPDATE conversations SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
      
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Conversation ${id} not found after update`);
    
    return updated;
  }

  /**
   * Find conversations by user ID with pagination
   */
  async findByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<Conversation[]> {
    const results = await this.getDb()
      .prepare(`
        SELECT * FROM conversations 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `)
      .bind(userId, limit, offset)
      .all();

    return results.results.map(result => this.validateEntity(result));
  }

  /**
   * Update mastery score for specific conversation
   */
  async updateMasteryScore(id: string, score: number): Promise<void> {
    await this.getDb()
      .prepare('UPDATE conversations SET mastery_score = ?, updated_at = ? WHERE id = ?')
      .bind(score, new Date().toISOString(), id)
      .run();
  }

  /**
   * Find active conversations for a course
   */
  async findActiveByCourse(courseId: string): Promise<Conversation[]> {
    const results = await this.getDb()
      .prepare(`
        SELECT * FROM conversations 
        WHERE course_id = ? AND status = 'active'
        ORDER BY updated_at DESC
      `)
      .bind(courseId)
      .all();

    return results.results.map(result => this.validateEntity(result));
  }
}
```

#### Service Integration Pattern

```typescript
/**
 * Service layer integrating repositories and business logic.
 * 
 * Services coordinate between repositories and contain business rules,
 * while repositories handle pure data access operations.
 */
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly userRepository: UserRepository,
    private readonly assessmentRepository: AssessmentRepository
  ) {}

  /**
   * Create new conversation with validation and business rules
   */
  async createConversation(request: CreateConversationRequest): Promise<Conversation> {
    // Business logic: Verify user exists
    const user = await this.userRepository.findById(request.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Business logic: Verify assessment configuration exists
    const assessment = await this.assessmentRepository.findById(request.assessmentConfigId);
    if (!assessment) {
      throw new Error('Assessment configuration not found');
    }

    // Business logic: Check if user already has active conversation
    const existing = await this.conversationRepository.findActiveByCourse(request.courseId);
    const userConversation = existing.find(conv => conv.user_id === request.userId);
    
    if (userConversation) {
      return userConversation; // Return existing instead of creating duplicate
    }

    // Repository call: Create new conversation
    return await this.conversationRepository.create({
      assessment_config_id: request.assessmentConfigId,
      user_id: request.userId,
      course_id: request.courseId,
      status: 'active',
      metadata: {
        created_via: 'api',
        initial_context: request.context
      }
    });
  }

  /**
   * Update conversation mastery with business validation
   */
  async updateMastery(conversationId: string, score: number, userId: string): Promise<void> {
    // Business logic: Validate score range
    if (score < 0 || score > 100) {
      throw new Error('Mastery score must be between 0 and 100');
    }

    // Business logic: Verify conversation belongs to user
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.user_id !== userId) {
      throw new Error('Unauthorized: Conversation belongs to different user');
    }

    // Repository call: Update mastery score
    await this.conversationRepository.updateMasteryScore(conversationId, score);
  }
}
```

#### Handler Integration Pattern

```typescript
/**
 * Handler integrating services for API endpoint processing.
 * 
 * Handlers focus on HTTP concerns (request/response, validation, error handling)
 * and delegate business logic to services.
 */
export class ConversationHandler {
  constructor(
    private readonly conversationService: ConversationService
  ) {}

  /**
   * Create conversation endpoint
   */
  async createConversation(c: Context): Promise<Response> {
    try {
      // Extract and validate request
      const body = await c.req.json();
      const validation = createConversationSchema.safeParse(body);
      
      if (!validation.success) {
        return c.json({ error: validation.error.flatten() }, 400);
      }

      // Get LTI context from middleware
      const ltiContext = c.get('ltiContext');

      // Service call: Create conversation with business logic
      const conversation = await this.conversationService.createConversation({
        ...validation.data,
        userId: ltiContext.user_id,
        courseId: ltiContext.course_id
      });

      // Return HTTP response
      return c.json(conversation, 201);
    } catch (error) {
      console.error('Conversation creation error:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        return c.json({ error: error.message }, 404);
      }
      
      return c.json({ error: 'Failed to create conversation' }, 500);
    }
  }

  /**
   * Update mastery endpoint
   */
  async updateMastery(c: Context): Promise<Response> {
    try {
      const conversationId = c.req.param('id');
      const { score } = await c.req.json();
      const ltiContext = c.get('ltiContext');

      // Input validation
      if (typeof score !== 'number') {
        return c.json({ error: 'Score must be a number' }, 400);
      }

      // Service call: Update with business validation
      await this.conversationService.updateMastery(
        conversationId, 
        score, 
        ltiContext.user_id
      );

      return c.json({ success: true });
    } catch (error) {
      console.error('Mastery update error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Unauthorized')) {
          return c.json({ error: error.message }, 403);
        }
        if (error.message.includes('not found')) {
          return c.json({ error: error.message }, 404);
        }
        if (error.message.includes('score must be')) {
          return c.json({ error: error.message }, 400);
        }
      }
      
      return c.json({ error: 'Failed to update mastery score' }, 500);
    }
  }
}
```

## Cloudflare AI Integration

### Edge AI Inference

```typescript
// AI Service leveraging Cloudflare Workers AI
export class EdgeAIService {
  constructor(private env: Env) {}

  // Text generation using Llama or similar models
  async generateResponse(prompt: string, context: AssessmentContext): Promise<string> {
    const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
      messages: [
        { role: 'system', content: context.systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: context.temperature || 0.7,
      max_tokens: context.maxTokens || 500,
    });

    return response.response;
  }

  // Embedding generation for semantic search
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [text],
    });
    return response.data[0];
  }

  // Intent classification for routing
  async classifyIntent(message: string): Promise<IntentClassification> {
    const response = await this.env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
      text: message,
    });
    return {
      intent: this.mapToIntent(response.label),
      confidence: response.score,
    };
  }
}
```

## Vectorize Integration

### Semantic Search and Content Discovery

```typescript
// Vectorize V2 service for semantic search
export class VectorSearchService {
  private vectorIndex: Vectorize;

  constructor(env: Env) {
    this.vectorIndex = env.VECTORIZE_INDEX; // Bound via wrangler.jsonc
  }

  // Index assessment content with namespace support
  async indexAssessmentContent(assessment: AssessmentConfig, courseId: string): Promise<void> {
    const aiService = new EdgeAIService(this.env);

    // Generate embeddings (768 dimensions for bge-base-en-v1.5)
    const embedding = await aiService.generateEmbedding(
      `${assessment.title} ${assessment.description} ${assessment.learning_objectives?.join(' ') || ''}`
    );

    // Store in Vectorize with namespace
    const result = await this.vectorIndex.insert([
      {
        id: assessment.id,
        values: embedding, // Float32Array or number[]
        metadata: {
          type: 'assessment',
          course_id: courseId,
          title: assessment.title.substring(0, 64), // String metadata indexed up to 64B
          created_at: new Date().toISOString(),
        },
        namespace: courseId, // Segment by course (max 1000 namespaces)
      },
    ]);

    console.log(`Assessment indexed: ${result.mutationId}`);
  }

  // Query with metadata filtering and precision control
  async findSimilarContent(
    query: string,
    options: {
      namespace?: string;
      courseId?: string;
      limit?: number;
      highPrecision?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const aiService = new EdgeAIService(this.env);
    const queryEmbedding = await aiService.generateEmbedding(query);

    // Build metadata filter (requires metadata indexes)
    const filter: any = {};
    if (options.courseId) filter.course_id = { $eq: options.courseId };
    filter.type = { $eq: 'assessment' };

    const results = await this.vectorIndex.query(queryEmbedding, {
      topK: options.limit || 10,
      returnValues: options.highPrecision || false, // true = exact scores but higher latency
      returnMetadata: 'all',
      namespace: options.namespace,
      filter,
    });

    return results.matches.map((match) => ({
      id: match.id,
      score: match.score, // Cosine: -1 to 1, Euclidean: 0+, Dot: negative is better
      metadata: match.metadata,
      values: match.values, // Only if returnValues: true
    }));
  }

  // Upsert conversation for knowledge base
  async upsertConversation(conversation: Conversation, messages: ConversationMessage[]): Promise<void> {
    const aiService = new EdgeAIService(this.env);

    // Summarize for semantic search
    const summary = await aiService.generateResponse(
      `Summarize key learning points: ${messages
        .slice(-10)
        .map((m) => m.content)
        .join(' ')}`,
      { systemPrompt: 'Extract main concepts and learning outcomes.' }
    );

    const embedding = await aiService.generateEmbedding(summary);

    // Upsert to update existing or insert new
    await this.vectorIndex.upsert([
      {
        id: conversation.id,
        values: embedding,
        metadata: {
          type: 'conversation',
          user_id: conversation.user_id,
          course_id: conversation.course_id,
          mastery_score: conversation.mastery_score,
          summary: summary.substring(0, 500),
          created_at: conversation.started_at,
        },
        namespace: conversation.course_id,
      },
    ]);
  }
}
```

## Hybrid Storage Architecture

### Combining D1, KV, R2, and Vectorize

```typescript
export class HybridStorageService {
  constructor(
    private d1: D1Database,
    private kv: KVNamespace,
    private r2: R2Bucket,
    private vectorize: VectorizeIndex
  ) {}

  // Store structured data in D1
  async storeStructuredData(table: string, data: any): Promise<void> {
    await this.d1
      .prepare(`INSERT INTO ${table} ...`)
      .bind(...values)
      .run();
  }

  // Cache frequently accessed data in KV
  async cacheData(key: string, data: any, ttl = 3600): Promise<void> {
    await this.kv.put(key, JSON.stringify(data), {
      expirationTtl: ttl,
    });
  }

  // Store media files in R2
  async storeMedia(file: File): Promise<string> {
    const key = `media/${crypto.randomUUID()}/${file.name}`;
    await this.r2.put(key, file.stream());
    return key;
  }

  // Index searchable content in Vectorize
  async indexContent(content: string, metadata: any): Promise<void> {
    const aiService = new EdgeAIService(this.env);
    const embedding = await aiService.generateEmbedding(content);
    await this.vectorize.insert([
      {
        id: crypto.randomUUID(),
        values: embedding,
        metadata,
      },
    ]);
  }
}
```

## Vectorize Performance Best Practices

### Batch Operations for Improved Throughput

```typescript
export class VectorizeOptimizer {
  // Batch inserts for better performance (up to 1000 vectors per request)
  async batchInsert(vectors: VectorizeVector[]): Promise<void> {
    const BATCH_SIZE = 1000; // Vectorize limit

    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await this.vectorIndex.insert(batch);
    }
  }

  // Use upsert for updates to avoid duplicate ID errors
  async updateVectors(updates: VectorizeVector[]): Promise<void> {
    // Upsert overwrites existing vectors with same ID
    await this.vectorIndex.upsert(updates);
  }
}
```

### Query Optimization Strategies

```typescript
interface QueryStrategy {
  // High-precision scoring for accuracy-critical searches
  async preciseSearch(query: number[]): Promise<SearchResult[]> {
    return await this.vectorIndex.query(query, {
      topK: 10,
      returnValues: true, // Enables exact scoring but increases latency
      returnMetadata: 'all'
    });
  }

  // Approximate scoring for faster response times
  async fastSearch(query: number[]): Promise<SearchResult[]> {
    return await this.vectorIndex.query(query, {
      topK: 10,
      returnValues: false, // Default: approximate scoring for speed
      returnMetadata: 'indexed' // Only return indexed metadata
    });
  }

  // Namespace isolation for multi-tenant queries
  async tenantSearch(query: number[], tenantId: string): Promise<SearchResult[]> {
    return await this.vectorIndex.query(query, {
      namespace: tenantId, // Search only within tenant's vectors
      topK: 10
    });
  }
}
```

### Metadata Index Design

```typescript
// Best practices for metadata filtering
export class MetadataDesign {
  // Low cardinality for efficient filtering
  goodMetadata = {
    type: 'assessment', // Few unique values
    status: 'active', // Limited set
    difficulty: 'medium', // Enumerated values
  };

  // Avoid high cardinality in metadata filters
  avoidMetadata = {
    uuid: 'unique-id-per-vector', // Too many unique values
    timestamp_ms: Date.now(), // High cardinality
    random_score: Math.random(), // Continuous values
  };

  // Bucket high-cardinality data for better performance
  optimizedMetadata = {
    created_date: '2024-01-15', // Date without time
    score_bucket: Math.floor(score / 10) * 10, // 0, 10, 20, etc.
    time_window: Math.floor(Date.now() / 300000) * 300000, // 5-min windows
  };
}
```

### Index Configuration Considerations

- **Dimensions**: Cannot be changed after creation, must match embedding model
- **Distance Metrics**:
  - `cosine`: Best for normalized embeddings (most common)
  - `euclidean`: Good for dense embeddings where magnitude matters
  - `dot-product`: Efficient but requires careful normalization
- **Namespaces**: Use for tenant isolation (max 1000 per index)
- **Metadata Indexes**: Create before inserting vectors (max 10 per index)

## Authentication and Authorization

### Auth Flow

```mermaid
sequenceDiagram
    participant Client
    participant Worker
    participant KV
    participant Canvas

    Client->>Worker: Request with JWT
    Worker->>Worker: Validate JWT signature
    Worker->>KV: Get platform keys
    KV-->>Worker: Public key
    Worker->>Worker: Verify claims
    Worker->>Canvas: Validate token (if needed)
    Canvas-->>Worker: Token valid
    Worker-->>Client: Authorized response
```

### Middleware/Guards

```typescript
// LTI authentication middleware (extends existing)
export async function ltiAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT using existing LTI service
    const claims = await ltiService.verifyJWT(token);

    // Add claims to context
    c.set('ltiContext', {
      user_id: claims.sub,
      platform_id: claims.iss,
      course_id: claims['https://purl.imsglobal.org/spec/lti/claim/context'].id,
      roles: claims['https://purl.imsglobal.org/spec/lti/claim/roles'],
      is_instructor: claims['https://purl.imsglobal.org/spec/lti/claim/roles'].includes(
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'
      ),
    });

    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
}
```
