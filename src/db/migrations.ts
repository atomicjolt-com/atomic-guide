/**
 * D1 Database Migration System for Atomic Guide
 * Handles multi-tenant database provisioning and schema updates
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface Migration {
  version: number;
  name: string;
  up: string; // SQL to apply migration
  down: string; // SQL to rollback migration
}

// Migration history - add new migrations here
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: '-- Initial schema is created from schema.sql',
    down: `-- Drop all tables for complete rollback
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS instructor_preferences;
      DROP TABLE IF EXISTS course_analytics;
      DROP TABLE IF EXISTS concept_mastery;
      DROP TABLE IF EXISTS knowledge_graph;
      DROP TABLE IF EXISTS chat_messages;
      DROP TABLE IF EXISTS chat_conversations;
      DROP TABLE IF EXISTS intervention_logs;
      DROP TABLE IF EXISTS struggle_events;
      DROP TABLE IF EXISTS learning_sessions;
      DROP TABLE IF EXISTS learner_profiles;
      DROP TABLE IF EXISTS tenant_config;
      DROP TABLE IF EXISTS schema_migrations;`
  },
  {
    version: 2,
    name: 'add_mcp_integration',
    up: `
      -- Add MCP (Model Context Protocol) integration fields
      ALTER TABLE learner_profiles 
        ADD COLUMN mcp_client_id TEXT,
        ADD COLUMN mcp_consent_granted BOOLEAN DEFAULT FALSE,
        ADD COLUMN mcp_consent_timestamp DATETIME;
      
      CREATE TABLE IF NOT EXISTS mcp_access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        learner_profile_id INTEGER NOT NULL,
        client_name TEXT NOT NULL, -- 'claude', 'chatgpt', 'custom'
        access_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        scope TEXT NOT NULL, -- 'read_profile', 'read_mastery', 'read_history'
        ip_address TEXT,
        FOREIGN KEY (learner_profile_id) REFERENCES learner_profiles(id) ON DELETE CASCADE
      );
      
      CREATE INDEX idx_mcp_access_logs_learner ON mcp_access_logs(learner_profile_id, access_timestamp);
    `,
    down: `
      -- Remove MCP integration
      ALTER TABLE learner_profiles 
        DROP COLUMN mcp_client_id,
        DROP COLUMN mcp_consent_granted,
        DROP COLUMN mcp_consent_timestamp;
      DROP TABLE IF EXISTS mcp_access_logs;
    `
  }
];

/**
 * Initialize a new tenant database with schema
 */
export async function initializeTenantDatabase(
  db: D1Database,
  tenantId: string,
  institutionName: string,
  lmsType: string,
  lmsUrl: string
): Promise<void> {
  // Read and execute the base schema
  const schemaSQL = await getSchemaSQL();
  
  // Execute schema in a transaction
  await db.batch([
    db.prepare(schemaSQL),
    db.prepare(`
      INSERT INTO tenant_config (tenant_id, institution_name, lms_type, lms_url)
      VALUES (?, ?, ?, ?)
    `).bind(tenantId, institutionName, lmsType, lmsUrl)
  ]);
  
  // Apply any additional migrations
  await runMigrations(db, 1); // Start from version 1 since schema is version 1
}

/**
 * Run pending migrations on a database
 */
export async function runMigrations(
  db: D1Database,
  _fromVersion: number = 0
): Promise<void> {
  // Get current version
  const currentVersion = await getCurrentVersion(db);
  
  // Find migrations to run
  const pendingMigrations = migrations.filter(m => m.version > currentVersion);
  
  if (pendingMigrations.length === 0) {
    console.log('Database is up to date');
    return;
  }
  
  // Run migrations in order
  for (const migration of pendingMigrations) {
    console.log(`Running migration ${migration.version}: ${migration.name}`);
    
    try {
      await db.prepare(migration.up).run();
      
      // Record migration
      await db.prepare(`
        INSERT INTO schema_migrations (version, name)
        VALUES (?, ?)
      `).bind(migration.version, migration.name).run();
      
      console.log(`Migration ${migration.version} completed`);
    } catch {
      console.error(`Migration ${migration.version} failed:`, error);
      throw new Error(`Migration failed at version ${migration.version}: ${error}`);
    }
  }
}

/**
 * Rollback to a specific version
 */
export async function rollbackToVersion(
  db: D1Database,
  targetVersion: number
): Promise<void> {
  const currentVersion = await getCurrentVersion(db);
  
  if (targetVersion >= currentVersion) {
    console.log('Target version is not lower than current version');
    return;
  }
  
  // Find migrations to rollback (in reverse order)
  const rollbackMigrations = migrations
    .filter(m => m.version > targetVersion && m.version <= currentVersion)
    .reverse();
  
  for (const migration of rollbackMigrations) {
    console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
    
    try {
      await db.prepare(migration.down).run();
      
      // Remove migration record
      await db.prepare(`
        DELETE FROM schema_migrations WHERE version = ?
      `).bind(migration.version).run();
      
      console.log(`Rollback of ${migration.version} completed`);
    } catch {
      console.error(`Rollback of ${migration.version} failed:`, error);
      throw new Error(`Rollback failed at version ${migration.version}: ${error}`);
    }
  }
}

/**
 * Get current schema version
 */
async function getCurrentVersion(db: D1Database): Promise<number> {
  try {
    const result = await db.prepare(`
      SELECT MAX(version) as version FROM schema_migrations
    `).first();
    
    return result?.version || 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Get the base schema SQL
 * In production, this would read from schema.sql file
 */
async function getSchemaSQL(): Promise<string> {
  // This would be replaced with actual file reading in production
  // For now, return a reference to the schema file
  throw new Error('Schema SQL loading not implemented - read from src/db/schema.sql');
}

/**
 * Create tenant-specific D1 database binding name
 */
export function getTenantDatabaseBinding(tenantId: string): string {
  // Sanitize tenant ID for use in binding name
  const sanitized = tenantId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  return `DB_TENANT_${sanitized}`;
}

/**
 * Validate tenant has proper database setup
 */
export async function validateTenantDatabase(db: D1Database): Promise<boolean> {
  try {
    // Check for tenant_config table and configuration
    const config = await db.prepare(`
      SELECT tenant_id, institution_name FROM tenant_config LIMIT 1
    `).first();
    
    return !!config?.tenant_id;
  } catch {
    console.error('Tenant database validation failed:', error);
    return false;
  }
}

/**
 * Get tenant configuration
 */
export async function getTenantConfig(db: D1Database): Promise<any> {
  const config = await db.prepare(`
    SELECT * FROM tenant_config LIMIT 1
  `).first();
  
  if (!config) {
    throw new Error('Tenant configuration not found');
  }
  
  return config;
}

/**
 * Update tenant features
 */
export async function updateTenantFeatures(
  db: D1Database,
  features: Record<string, boolean>
): Promise<void> {
  await db.prepare(`
    UPDATE tenant_config 
    SET features = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).bind(JSON.stringify(features)).run();
}