#!/usr/bin/env node

/**
 * Seed script for populating the D1 database with initial data
 *
 * This script processes SQL files from the seeds directory and:
 * 1. Interpolates environment variables from:
 *    - wrangler.jsonc vars
 *    - .dev.vars for local development
 *    - Environment secrets for production (when using --remote)
 * 2. Executes them against either local (default) or remote D1 database
 *
 * Usage:
 *   npm run db:seed                   - Only process files (dry run)
 *   npm run db:seed -- --run          - Process and execute against local database (default)
 *   npm run db:seed -- --run --remote - Process and execute against remote database
 *
 * Creating Seed Files:
 * - Place SQL files in seeds/ directory with numeric prefix (e.g. 0001_accounts.sql)
 * - Files are executed in alphabetical order
 * - You can use ${VARIABLE} syntax to interpolate values from environment variables
 * - Use INSERT OR IGNORE to prevent duplicate entries when seeds are run multiple times
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'jsonc-parser';
import { execSync } from 'child_process';
import { encryptData } from '../src/libs/encryption';

// Define types for our configuration data
interface WranglerConfig {
  vars?: Record<string, string | number | boolean>;
  d1_databases?: Array<{
    database_name: string;
    binding?: string;
  }>;
}

// Define a type for our environment variables
type EnvVars = Record<string, string>;

// Use standard Node.js path resolution
const projectRoot = path.resolve('./');
const wranglerPath = path.resolve(projectRoot, 'wrangler.jsonc');
const devVarsPath = path.resolve(projectRoot, '.dev.vars');
const secretsPath = path.resolve(projectRoot, 'secrets.json');
const seedsDir = path.resolve(projectRoot, 'seeds');
const outputDir = path.resolve(projectRoot, 'tmp/seeds');
const runAfterRender = process.argv.includes('--run');
const useRemoteDatabase = process.argv.includes('--remote');

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Parse wrangler.jsonc
const wranglerRaw = fs.readFileSync(wranglerPath, 'utf8');
const wrangler = parse(wranglerRaw) as WranglerConfig;
const varsFromWrangler = wrangler.vars || {};

// Parse .dev.vars if it exists (for local development)
const varsFromDevVars: EnvVars = {};
if (fs.existsSync(devVarsPath)) {
  const devVarsContent = fs.readFileSync(devVarsPath, 'utf8');

  // Parse each line as KEY=VALUE
  devVarsContent.split('\n').forEach((line) => {
    if (line && !line.startsWith('#')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        varsFromDevVars[key] = value;
      }
    }
  });

  console.log(`📋 Loaded ${Object.keys(varsFromDevVars).length} variables from .dev.vars`);
} else {
  console.log('ℹ️  No .dev.vars file found.');
}

// Parse secrets.json if it exists (used for testing production variables locally)
let varsFromSecrets: EnvVars = {};
if (fs.existsSync(secretsPath)) {
  try {
    varsFromSecrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    console.log(`📋 Loaded ${Object.keys(varsFromSecrets).length} variables from secrets.json`);
  } catch (e) {
    console.warn('⚠️  Error parsing secrets.json:', (e as Error).message);
  }
}

// For remote mode, get environment variables that might be set
const varsFromEnv: EnvVars = {};
if (useRemoteDatabase) {
  // Attempt to get environment variables from wrangler secrets
  try {
    console.log('📋 Using production environment secrets for remote database');
  } catch {
    console.warn('⚠️  Failed to get production environment secrets');
  }
}

// Combine variables with the following precedence (highest to lowest):
// 1. Environment variables (when using --remote)
// 2. .dev.vars for local development
// 3. secrets.json for testing production variables locally
// 4. wrangler.jsonc vars
const vars: Record<string, any> = {
  ...varsFromWrangler,
  ...varsFromSecrets,
  ...varsFromDevVars,
  ...varsFromEnv,
};

// Get database name from wrangler.jsonc
const dbName = wrangler.d1_databases?.[0]?.database_name || 'atomic-mcp';

// Find all .sql files
const files = fs
  .readdirSync(seedsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort(); // execute in filename order

if (files.length === 0) {
  console.warn('⚠️  No .sql files found in atomic-mcp-db/seeds');
  process.exit(0);
}

console.log(`📋 Found ${files.length} seed files to process`);
if (runAfterRender) {
  console.log(`🔄 Will execute seeds against ${useRemoteDatabase ? 'REMOTE' : 'LOCAL'} database`);
}

// Process each SQL file asynchronously
async function processSqlFiles() {
  for (const templateFile of files) {
    const templatePath = path.join(seedsDir, templateFile);
    const outputFile = templateFile.replace(/\.template$/, '');
    const outputPath = path.join(outputDir, outputFile);

    let sql = fs.readFileSync(templatePath, 'utf8');

    // Replace ${VARS}
    for (const [keyOrig, value] of Object.entries(vars)) {
      const key = keyOrig.trim();
      const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');

      // Encrypt sensitive values
      if (key === 'CANVAS_CLIENT_SECRET') {
        // Get encryption key from vars
        const encryptionKey = vars.ATOMIC_MCP_ENCRYPTION_KEY;
        if (!encryptionKey) {
          console.error('⚠️ No ATOMIC_MCP_ENCRYPTION_KEY found in environment variables. Cannot encrypt sensitive data.');
          process.exit(1);
        }
        console.log(`🔒 encryptionKey ${encryptionKey}...`);
        try {
          console.log(`🔒 Encrypting ${key}...`);
          // Use the imported encryptData function
          const encryptedValue = await encryptData(String(value), encryptionKey);
          sql = sql.replace(pattern, encryptedValue);
        } catch (error) {
          console.error(`Error encrypting ${key}:`, error);
          process.exit(1);
        }
      } else {
        // Normal replacement for other variables
        sql = sql.replace(pattern, String(value));
      }
    }

    // Write interpolated SQL to /tmp
    fs.writeFileSync(outputPath, sql);
    console.log(`✅ Rendered ${outputFile} → ${outputPath}`);

    // Optionally run the file
    if (runAfterRender) {
      console.log(`🚀 Executing ${outputFile}...`);

      // Build command with appropriate environment variables
      let executeCommand: string;

      if (useRemoteDatabase) {
        // For remote execution, we use the secrets already in the Cloudflare environment
        executeCommand = `npx wrangler d1 execute ${dbName} --remote --file=${outputPath}`;
      } else {
        // For local execution, we pass environment variables from .dev.vars
        executeCommand = `npx wrangler d1 execute ${dbName} --local --file=${outputPath}`;
      }

      execSync(executeCommand, {
        stdio: 'inherit',
        env: { ...process.env },
      });
    }
  }
}

// Run the main function and handle errors
processSqlFiles().catch((error) => {
  console.error('Error processing SQL files:', error);
  process.exit(1);
});

console.log('\n✨ Seed processing complete!');
if (!runAfterRender) {
  console.log('ℹ️  Use --run to execute the seeds against the local database (default)');
  console.log('ℹ️  Use --run --remote to execute the seeds against the remote database');
  console.log('ℹ️  When running with --remote, environment secrets from Cloudflare will be used');
}
