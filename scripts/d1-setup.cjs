/**
 * D1 Database Setup Script
 * Sets up the Cloudflare D1 database for AtomicStream
 */

const { execSync } = require('child_process');
const { readFileSync, existsSync, writeFileSync } = require('fs');
const { resolve } = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  step: (msg) => console.log(`\n${colors.blue}▶ ${msg}${colors.reset}`),
};

// Execute command and return output
function exec(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf8' });
    if (!silent) {
      console.log(output.trim());
    }
    return { success: true, output: output.trim() };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout?.toString() || '' };
  }
}

// Extract database ID from wrangler output
function extractDatabaseId(output) {
  const idMatch = output.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
  return idMatch ? idMatch[1] : null;
}

// Update wrangler.jsonc with database ID
function updateWranglerConfig(databaseId) {
  const configPath = resolve('wrangler.jsonc');

  if (!existsSync(configPath)) {
    log.error('wrangler.jsonc not found!');
    return false;
  }

  let content = readFileSync(configPath, 'utf8');

  // Check if database ID is already set
  if (!content.includes('YOUR_DATABASE_ID')) {
    log.warning('Database ID might already be configured in wrangler.jsonc');
    return true;
  }

  // Replace placeholder with actual ID
  content = content.replace('YOUR_DATABASE_ID', databaseId);
  writeFileSync(configPath, content);

  log.success(`Updated wrangler.jsonc with database ID: ${databaseId}`);
  return true;
}

// Main setup function
async function setupD1Database() {
  console.log('🚀 AtomicStream D1 Database Setup');
  console.log('=================================\n');

  // Check if wrangler is installed
  log.step('Checking wrangler installation...');
  const wranglerCheck = exec('wrangler --version', true);

  if (!wranglerCheck.success) {
    log.error('Wrangler CLI not found. Please install it first:');
    console.log('npm install -g wrangler');
    process.exit(1);
  }

  log.success(`Wrangler found: ${wranglerCheck.output}`);

  // Step 1: Create D1 database
  log.step('Creating D1 database...');
  const createResult = exec('wrangler d1 create atomic-guide-db');

  let databaseId = null;

  if (createResult.success) {
    databaseId = extractDatabaseId(createResult.output);
    if (databaseId) {
      log.success(`Database created with ID: ${databaseId}`);
    }
  } else if (createResult.error && createResult.error.includes('already exists')) {
    log.warning('Database already exists, fetching ID...');

    // List databases to get the ID
    const listResult = exec('wrangler d1 list', true);
    if (listResult.success) {
      // Parse the output to find our database
      const lines = listResult.output.split('\n');
      for (const line of lines) {
        if (line.includes('atomic-guide-db')) {
          // The output is in table format with │ separators
          // Split by │ and get the first UUID
          const parts = line.split('│').map((p) => p.trim());
          for (const part of parts) {
            if (part.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)) {
              databaseId = part;
              break;
            }
          }
          if (databaseId) break;
        }
      }
    }

    if (databaseId) {
      log.info(`Found existing database ID: ${databaseId}`);
    } else {
      log.error('Could not determine database ID. Please check manually with: wrangler d1 list');
    }
  } else {
    log.error('Failed to create database:');
    console.log(createResult.error);
    process.exit(1);
  }

  // Step 2: Update wrangler.jsonc if we have a database ID
  if (databaseId) {
    log.step('Updating wrangler.jsonc...');
    updateWranglerConfig(databaseId);
  }

  // Step 3: Run migrations
  log.step('Running database migrations...');

  const migrationFile = resolve('migrations/0001_initial_schema.sql');

  if (!existsSync(migrationFile)) {
    log.error('Migration file not found: migrations/0001_initial_schema.sql');
    process.exit(1);
  }

  // Only run migration if we have updated the config
  if (!readFileSync('wrangler.jsonc', 'utf8').includes('YOUR_DATABASE_ID')) {
    const migrationResult = exec(`wrangler d1 execute atomic-guide-db --file=${migrationFile}`);

    if (migrationResult.success) {
      log.success('Database migration completed successfully!');
    } else {
      log.error('Migration failed:');
      console.log(migrationResult.error);
      log.info('You can run the migration manually later with:');
      console.log('npm run db:migrate');
    }
  } else {
    log.warning('Skipping migration - please update database ID in wrangler.jsonc first');
    log.info('After updating, run: npm run db:migrate');
  }

  // Success message
  console.log('\n' + '='.repeat(50));
  log.success('D1 Setup Complete!');
  console.log('='.repeat(50) + '\n');

  // Next steps
  console.log('📋 Next steps:\n');

  if (databaseId && readFileSync('wrangler.jsonc', 'utf8').includes('YOUR_DATABASE_ID')) {
    console.log('1. Update wrangler.jsonc with the database ID:');
    console.log(`   "database_id": "${databaseId}"\n`);
    console.log('2. Run migrations:');
    console.log('   npm run db:migrate\n');
  }

  console.log('3. Start using D1 in your Workers:');
  console.log('   const result = await env.DB.prepare("SELECT * FROM users").all();\n');

  console.log('📚 Useful commands:');
  console.log('   npm run db:list     - List all tables');
  console.log('   npm run db:query    - Run SQL queries');
  console.log('   npm run db:export   - Export database');
}

// Run the setup
setupD1Database().catch((error) => {
  log.error('Setup failed:');
  console.error(error);
  process.exit(1);
});
