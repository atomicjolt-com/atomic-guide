#!/usr/bin/env node

/**
 * Database Migration Runner with Rollback Support
 * Manages D1 database schema changes with version tracking
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
    this.rollbacksDir = path.join(__dirname, '..', 'migrations', 'rollbacks');
    this.dbName = 'atomic-guide-db';
  }

  /**
   * Get list of migration files
   */
  getMigrations() {
    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.includes('rollback'))
      .sort();

    return files.map((file) => ({
      version: file.split('_')[0],
      name: file.replace('.sql', ''),
      file: path.join(this.migrationsDir, file),
      rollback: path.join(this.rollbacksDir, file.replace('.sql', '_rollback.sql')),
    }));
  }

  /**
   * Get current migration version from database
   */
  async getCurrentVersion(isLocal = true) {
    const flag = isLocal ? '--local' : '--remote';

    try {
      const result = execSync(
        `wrangler d1 execute ${this.dbName} ${flag} --command="SELECT version FROM migrations ORDER BY version DESC LIMIT 1"`,
        { encoding: 'utf8' }
      );

      const match = result.match(/"version":\s*"(\d+)"/);
      return match ? match[1] : '0000';
    } catch {
      // Table might not exist yet
      return '0000';
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable(isLocal = true) {
    const flag = isLocal ? '--local' : '--remote';

    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        rollback_sql TEXT
      );
    `;

    try {
      execSync(`wrangler d1 execute ${this.dbName} ${flag} --command="${sql}"`, { encoding: 'utf8', stdio: 'pipe' });
      console.log('✅ Migrations table created');
    } catch (_error) {
      console.error('Error creating migrations table:', _error.message);
    }
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migration, isLocal = true) {
    const flag = isLocal ? '--local' : '--remote';

    console.log(`Applying migration: ${migration.name}`);

    // Read migration SQL
    fs.readFileSync(migration.file, 'utf8');

    // Read rollback SQL if it exists
    let rollbackSql = '';
    if (fs.existsSync(migration.rollback)) {
      rollbackSql = fs.readFileSync(migration.rollback, 'utf8');
    }

    try {
      // Apply migration
      execSync(`wrangler d1 execute ${this.dbName} ${flag} --file="${migration.file}"`, { encoding: 'utf8', stdio: 'pipe' });

      // Record migration
      const recordSql = `
        INSERT INTO migrations (version, name, applied_at, rollback_sql)
        VALUES ('${migration.version}', '${migration.name}', ${Date.now()}, '${rollbackSql.replace(/'/g, "''")}');
      `;

      execSync(`wrangler d1 execute ${this.dbName} ${flag} --command="${recordSql}"`, { encoding: 'utf8', stdio: 'pipe' });

      console.log(`✅ Migration ${migration.name} applied successfully`);
      return true;
    } catch (_error) {
      console.error(`❌ Failed to apply migration ${migration.name}:`, _error.message);
      return false;
    }
  }

  /**
   * Rollback to a specific version
   */
  async rollbackTo(targetVersion, isLocal = true) {
    const flag = isLocal ? '--local' : '--remote';

    // Get migrations to rollback
    const result = execSync(
      `wrangler d1 execute ${this.dbName} ${flag} --command="SELECT * FROM migrations WHERE version > '${targetVersion}' ORDER BY version DESC"`,
      { encoding: 'utf8' }
    );

    const migrations = JSON.parse(result);

    for (const migration of migrations) {
      console.log(`Rolling back migration: ${migration.name}`);

      if (migration.rollback_sql) {
        try {
          // Execute rollback SQL
          execSync(`wrangler d1 execute ${this.dbName} ${flag} --command="${migration.rollback_sql}"`, { encoding: 'utf8', stdio: 'pipe' });

          // Remove migration record
          execSync(`wrangler d1 execute ${this.dbName} ${flag} --command="DELETE FROM migrations WHERE version = '${migration.version}'"`, {
            encoding: 'utf8',
            stdio: 'pipe',
          });

          console.log(`✅ Rolled back ${migration.name}`);
        } catch (_error) {
          console.error(`❌ Failed to rollback ${migration.name}:`, _error.message);
          throw _error;
        }
      } else {
        console.warn(`⚠️  No rollback SQL for ${migration.name}`);
      }
    }
  }

  /**
   * Run migrations up to latest or specific version
   */
  async migrate(targetVersion = null, isLocal = true) {
    await this.createMigrationsTable(isLocal);

    const currentVersion = await this.getCurrentVersion(isLocal);
    const migrations = this.getMigrations();

    console.log(`Current version: ${currentVersion}`);

    let applied = 0;
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        if (targetVersion && migration.version > targetVersion) {
          break;
        }

        const success = await this.applyMigration(migration, isLocal);
        if (!success) {
          console.error('Migration failed, stopping');
          process.exit(1);
        }
        applied++;
      }
    }

    if (applied === 0) {
      console.log('✅ Database is up to date');
    } else {
      console.log(`✅ Applied ${applied} migration(s)`);
    }
  }

  /**
   * Show migration status
   */
  async status(isLocal = true) {
    const currentVersion = await this.getCurrentVersion(isLocal);
    const migrations = this.getMigrations();

    console.log('\nMigration Status:');
    console.log('================');

    migrations.forEach((m) => {
      const status = m.version <= currentVersion ? '✅' : '⏳';
      const rollback = fs.existsSync(m.rollback) ? '↩️' : '  ';
      console.log(`${status} ${rollback} ${m.version} - ${m.name}`);
    });

    console.log(`\nCurrent version: ${currentVersion}`);
    console.log('✅ = Applied, ⏳ = Pending, ↩️ = Has rollback');
  }
}

// CLI
const runner = new MigrationRunner();
const command = process.argv[2];
const isRemote = process.argv.includes('--remote');

switch (command) {
  case 'up':
  case 'migrate': {
    const targetVersion = process.argv[3];
    runner.migrate(targetVersion, !isRemote);
    break;
  }

  case 'rollback': {
    const rollbackTo = process.argv[3];
    if (!rollbackTo) {
      console.error('Please specify target version for rollback');
      process.exit(1);
    }
    runner.rollbackTo(rollbackTo, !isRemote);
    break;
  }

  case 'status': {
    runner.status(!isRemote);
    break;
  }

  default:
    console.log(`
Database Migration Tool

Usage:
  npm run db:migrate [command] [options]

Commands:
  up, migrate [version]  Run migrations up to latest or specific version
  rollback <version>     Rollback to specific version
  status                 Show migration status

Options:
  --remote              Run against remote database (default: local)

Examples:
  npm run db:migrate up           # Run all pending migrations locally
  npm run db:migrate up --remote  # Run migrations on remote
  npm run db:migrate rollback 0002 # Rollback to version 0002
  npm run db:migrate status       # Show migration status
    `);
}
