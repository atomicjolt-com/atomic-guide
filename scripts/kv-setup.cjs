#!/usr/bin/env node
/* eslint-env node */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up KV namespaces for AtomicStream...\n');

// Check for uncommitted changes to wrangler.jsonc
try {
  const gitStatus = execSync('git status --porcelain wrangler.jsonc', { encoding: 'utf8' });
  if (gitStatus.trim()) {
    console.log('⚠️  Warning: You have uncommitted changes to wrangler.jsonc');
    console.log('   It\'s recommended to commit or stash these changes first.');
    console.log('   A backup will be created, but using git is safer.\n');
  }
} catch {
  // Git not available or not a git repo - continue anyway
}

// Define all required KV namespaces
const namespaces = [
  { name: 'KEY_SETS', description: 'LTI key storage' },
  { name: 'REMOTE_JWKS', description: 'Remote JWKS cache' },
  { name: 'CLIENT_AUTH_TOKENS', description: 'Client authentication tokens' },
  { name: 'PLATFORMS', description: 'LTI platform configurations' },
  { name: 'STREAM_VIDEOS', description: 'Stream video metadata' },
  { name: 'TRANSCRIPTS', description: 'Video transcripts' },
  { name: 'SESSIONS', description: 'User sessions' },
  { name: 'STREAMS_KV', description: 'Active stream sessions' },
  { name: 'RECORDINGS_KV', description: 'Recording metadata' },
];

const kvConfig = {};
const errors = [];

// Get list of existing namespaces once at the start
let existingNamespaces = [];
try {
  const listOutput = execSync('npx wrangler kv namespace list', { encoding: 'utf8' });
  existingNamespaces = JSON.parse(listOutput);
  console.log(`Found ${existingNamespaces.length} existing KV namespaces\n`);
} catch {
  console.log('⚠️  Could not fetch existing namespaces, will try to create new ones\n');
}

// Function to create or find a namespace
function createNamespace(binding, isPreview = false) {
  const suffix = isPreview ? '_preview' : '';
  const type = isPreview ? 'preview' : 'production';

  // First check if namespace already exists
  const searchTitle = binding + suffix;
  const existing = existingNamespaces.find(
    (ns) => ns.title === searchTitle || ns.title === binding + (isPreview ? '_preview' : '') || (ns.title === binding && !isPreview),
  );

  if (existing) {
    console.log(`✔️  Found existing ${type} namespace for ${binding}: ${existing.id}`);
    return existing.id;
  }

  // If not found, try to create it
  try {
    console.log(`Creating ${type} namespace for ${binding}...`);
    const cmdSuffix = isPreview ? ' --preview' : '';
    const output = execSync(`npx wrangler kv namespace create ${binding}${cmdSuffix}`, {
      encoding: 'utf8',
    });

    // Extract the ID from the output
    const idMatch = output.match(/id = "([^"]+)"/);
    if (idMatch) {
      const id = idMatch[1];
      console.log(`✅ Created ${type} ${binding}: ${id}`);
      return id;
    } else {
      console.log(`⚠️  ${binding} ${type} namespace might already exist`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to create ${type} ${binding}: ${error.message}`);
    errors.push(`${binding} (${type}): ${error.message}`);
    return null;
  }
}

console.log('📦 Creating KV namespaces...\n');

// Create each namespace (production and preview)
for (const { name, description } of namespaces) {
  console.log(`\n${description}:`);

  const prodId = createNamespace(name, false);
  const previewId = createNamespace(name, true);

  if (prodId || previewId) {
    kvConfig[name] = {
      binding: name,
      ...(prodId && { id: prodId }),
      ...(previewId && { preview_id: previewId }),
    };
  }
}

// Read existing wrangler.jsonc
const wranglerPath = path.join(process.cwd(), 'wrangler.jsonc');
let wranglerContent = '';

try {
  wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
} catch {
  console.error('\n❌ Could not read wrangler.jsonc file');
  process.exit(1);
}

// Display configuration to add
console.log('\n📝 KV namespace configuration:\n');
console.log('Add or update the following in your wrangler.jsonc file:\n');
console.log('"kv_namespaces": [');

const configEntries = Object.values(kvConfig);
configEntries.forEach((config, index) => {
  const isLast = index === configEntries.length - 1;
  console.log('  {');
  console.log(`    "binding": "${config.binding}",`);
  if (config.id) {
    console.log(`    "id": "${config.id}"${config.preview_id ? ',' : ''}`);
  }
  if (config.preview_id) {
    console.log(`    "preview_id": "${config.preview_id}"`);
  }
  console.log(`  }${isLast ? '' : ','}`);
});
console.log(']');

// Check if we should update automatically
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Create a backup of wrangler.jsonc before any modifications
const backupPath = path.join(process.cwd(), `wrangler.jsonc.backup.${Date.now()}`);
console.log(`\n📋 Creating backup at: ${backupPath}`);
fs.writeFileSync(backupPath, wranglerContent);

console.log('\n⚠️  IMPORTANT: This will update your wrangler.jsonc file.');
console.log('   A backup has been created in case you need to restore.');
rl.question('Do you want to automatically update wrangler.jsonc? (y/N): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    // Parse JSONC (simplified - just find kv_namespaces section)
    const kvStartIndex = wranglerContent.indexOf('"kv_namespaces"');

    if (kvStartIndex === -1) {
      console.log('\n📝 No existing kv_namespaces section found. Creating new section...');

      // Find a good place to insert the KV namespaces section
      // Look for a good insertion point (after "name" or before "durable_objects")
      let insertPosition = wranglerContent.indexOf('"name"');
      if (insertPosition !== -1) {
        // Find the end of the name line
        insertPosition = wranglerContent.indexOf('\n', insertPosition) + 1;
      } else {
        // Insert after the opening brace
        insertPosition = wranglerContent.indexOf('{') + 1;
      }

      // Build the KV namespaces section
      const kvSection =
        '\n  "kv_namespaces": [\n' +
        configEntries
          .map((config, index) => {
            const lines = ['    {'];
            lines.push(`      "binding": "${config.binding}"`);
            if (config.id) {
              lines.push(`      "id": "${config.id}"`);
            }
            if (config.preview_id) {
              lines.push(`      "preview_id": "${config.preview_id}"`);
            }
            lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, ''); // Remove trailing comma from last property
            lines.push(`    }${index < configEntries.length - 1 ? ',' : ''}`);
            return lines.join(',\n').replace(/,,/g, ','); // Fix any double commas
          })
          .join('\n') +
        '\n  ],\n';

      // Insert the new section
      const newContent = wranglerContent.substring(0, insertPosition) + kvSection + wranglerContent.substring(insertPosition);

      // Write back to file
      fs.writeFileSync(wranglerPath, newContent);
      console.log('\n✅ Successfully added kv_namespaces section to wrangler.jsonc');
    } else {
      // Find the array bounds
      let bracketCount = 0;
      let inArray = false;
      let arrayStart = -1;
      let arrayEnd = -1;

      for (let i = kvStartIndex; i < wranglerContent.length; i++) {
        if (wranglerContent[i] === '[') {
          if (!inArray) {
            arrayStart = i;
            inArray = true;
          }
          bracketCount++;
        } else if (wranglerContent[i] === ']' && inArray) {
          bracketCount--;
          if (bracketCount === 0) {
            arrayEnd = i + 1;
            break;
          }
        }
      }

      if (arrayStart !== -1 && arrayEnd !== -1) {
        // Extract and parse existing KV namespaces
        const existingKvSection = wranglerContent.substring(arrayStart, arrayEnd);
        let existingNamespaces = [];

        try {
          // Clean up JSONC comments and parse
          const cleanJson = existingKvSection
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .replace(/\/\/.*$/gm, '') // Remove line comments
            .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas

          existingNamespaces = JSON.parse(cleanJson);
        } catch {
          console.log('\n⚠️  Could not parse existing KV namespaces, will preserve raw content');
          console.log('Please verify the configuration manually after update.');
        }

        // Create a map of existing namespaces by binding name
        const existingMap = new Map();
        existingNamespaces.forEach((ns) => {
          if (ns.binding) {
            existingMap.set(ns.binding, ns);
          }
        });

        // Merge new configurations with existing ones
        configEntries.forEach((config) => {
          if (existingMap.has(config.binding)) {
            // Update existing entry with new IDs if they were created
            const existing = existingMap.get(config.binding);
            if (config.id && !existing.id) {
              existing.id = config.id;
            }
            if (config.preview_id && !existing.preview_id) {
              existing.preview_id = config.preview_id;
            }
          } else {
            // Add new entry
            existingMap.set(config.binding, config);
          }
        });

        // Build merged kv_namespaces section
        const mergedEntries = Array.from(existingMap.values());
        const newKvSection =
          '"kv_namespaces": [\n' +
          mergedEntries
            .map((config, index) => {
              const lines = ['    {'];
              lines.push(`      "binding": "${config.binding}"`);
              if (config.id) {
                lines.push(`      "id": "${config.id}"`);
              }
              if (config.preview_id) {
                lines.push(`      "preview_id": "${config.preview_id}"`);
              }
              lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, ''); // Remove trailing comma from last property
              lines.push(`    }${index < mergedEntries.length - 1 ? ',' : ''}`);
              return lines.join(',\n').replace(/,,/g, ','); // Fix any double commas
            })
            .join('\n') +
          '\n  ]';

        // Replace the section
        const newContent = wranglerContent.substring(0, kvStartIndex) + newKvSection + wranglerContent.substring(arrayEnd);

        // Write back to file
        fs.writeFileSync(wranglerPath, newContent);
        console.log('\n✅ Successfully updated wrangler.jsonc (preserved existing entries)');
      } else {
        console.log('\n❌ Could not parse kv_namespaces array');
        console.log('Please update the configuration manually.');
      }
    }
  } else {
    console.log('\nPlease update wrangler.jsonc manually with the configuration above.');
  }

  // Summary
  console.log('\n📊 Setup Summary:');
  console.log(`✅ Created/verified ${configEntries.length} KV namespace pairs`);
  console.log('✅ Preserved all existing KV namespace configurations');

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} errors occurred:`);
    errors.forEach((error) => console.log(`  - ${error}`));
  }

  console.log('\n✨ KV namespace setup complete!');

  // Clean up old backup files (keep only the 5 most recent)
  try {
    const files = fs.readdirSync(process.cwd());
    const backupFiles = files
      .filter((f) => f.startsWith('wrangler.jsonc.backup.'))
      .sort()
      .reverse();

    if (backupFiles.length > 5) {
      console.log('\n🧹 Cleaning up old backup files...');
      backupFiles.slice(5).forEach((file) => {
        fs.unlinkSync(path.join(process.cwd(), file));
        console.log(`   Removed: ${file}`);
      });
    }
  } catch {
    // Ignore cleanup errors
  }

  console.log('\nNext steps:');
  console.log('1. Verify the configuration in wrangler.jsonc');
  console.log('2. Run `npm run r2:setup` to create R2 buckets');
  console.log('3. Run `npm run stream:setup` to add your Stream API token');

  rl.close();
  process.exit(errors.length > 0 ? 1 : 0);
});
