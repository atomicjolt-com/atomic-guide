# Atomic Guide Database Setup

This directory contains the D1 database schema, migrations, and utilities for the Atomic Guide/Focus cognitive learning platform.

## Quick Start

### 1. Initial Setup

Run the automated setup script to create D1 databases and apply the schema:

```bash
npm run db:setup
```

This will:
- Create production and preview D1 databases
- Apply the schema to both databases
- Update wrangler.jsonc with database IDs
- Create a development tenant
- Optionally load test seed data

### 2. Manual Database Commands

```bash
# Load seed data manually
npm run db:seed

# Run a query
npm run db:query "SELECT * FROM learner_profiles"

# List all databases
wrangler d1 list

# Delete a database
wrangler d1 delete atomic-guide-db-preview
```

## Database Schema Overview

The database uses a multi-tenant architecture with the following core tables:

### Core Tables
- **tenant_config** - Institution/tenant configuration
- **learner_profiles** - Student cognitive profiles and preferences
- **learning_sessions** - Individual learning session tracking
- **struggle_events** - Detected learning struggles and confusion
- **intervention_logs** - AI intervention tracking and effectiveness

### Knowledge Management
- **knowledge_graph** - Course concepts and relationships
- **concept_mastery** - Individual learner's mastery levels

### AI Chat System
- **chat_conversations** - Chat session management
- **chat_messages** - Individual chat messages

### Analytics & Compliance
- **course_analytics** - Aggregated course-level metrics
- **instructor_preferences** - Dashboard customization
- **audit_logs** - FERPA compliance audit trail

## Testing Database Connectivity

After setup, test the database connection:

```bash
# Start the development server
npm run dev

# Test endpoints:
curl http://localhost:8787/db/health
curl http://localhost:8787/db/schema
curl http://localhost:8787/db/test/learner
curl http://localhost:8787/db/test/analytics
```

## Database Utilities

The `utils.ts` file provides helper functions for common operations:

```typescript
import { 
  getOrCreateLearnerProfile,
  createLearningSession,
  recordStruggleEvent,
  getLearnerMastery,
  getCourseAnalytics 
} from './db/utils';
```

## Migrations

Database migrations are managed in `migrations.ts`:

```typescript
// Run pending migrations
await runMigrations(db);

// Rollback to specific version
await rollbackToVersion(db, targetVersion);
```

## Seed Data

The `seed.sql` file contains comprehensive test data including:
- 4 learner profiles with different cognitive characteristics
- 8 knowledge graph concepts for a CS101 course
- Learning sessions and struggle events
- Chat conversations and messages
- Course analytics

## Environment Configuration

The database configuration is stored in `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "atomic-guide-db",
    "database_id": "YOUR_DATABASE_ID_HERE",
    "preview_database_id": "YOUR_PREVIEW_DATABASE_ID_HERE"
  }
]
```

## Troubleshooting

### Database Not Found
- Ensure you've run `npm run db:setup`
- Check that database IDs are properly set in wrangler.jsonc

### Schema Issues
- Review `schema.sql` for the complete schema
- Check migration status: `SELECT * FROM schema_migrations`

### Connection Errors
- Verify you're logged into Wrangler: `wrangler whoami`
- Ensure D1 is enabled for your account

## Privacy & Security

- All data is tenant-isolated
- Learner consent is required for AI interactions
- FERPA compliance built into schema design
- Audit logging for all data access

## Development Workflow

1. Make schema changes in `schema.sql`
2. Create a new migration in `migrations.ts`
3. Test locally with preview database
4. Deploy to production when ready

## Additional Resources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/#d1)
- [SQLite Documentation](https://www.sqlite.org/docs.html)