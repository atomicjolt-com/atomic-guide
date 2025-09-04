#!/usr/bin/env node
/* eslint-env node */

/**
 * KV Namespace Cleanup Script
 * Deletes KV namespaces defined in wrangler.jsonc for this project
 *
 * Usage: npm run kv:destroy
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// JSONC parser to handle comments in wrangler.jsonc
function parseJSONC(content) {
  // Remove single-line comments
  let cleaned = content.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove trailing commas
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch {
    // If JSON parsing fails, try a more aggressive approach
    // Extract just the kv_namespaces section using regex
    const kvMatch = content.match(/"kv_namespaces"\s*:\s*\[([\s\S]*?)\]/);
    if (kvMatch) {
      try {
        // Clean up the matched content
        let kvContent = kvMatch[1];
        kvContent = kvContent.replace(/\/\/.*$/gm, '');
        kvContent = kvContent.replace(/\/\*[\s\S]*?\*\//g, '');
        kvContent = kvContent.replace(/,(\s*[}\]])/g, '$1');

        // Wrap in array brackets and parse
        const kvArray = JSON.parse(`[${kvContent}]`);
        return { kv_namespaces: kvArray };
      } catch (e) {
        console.error('Failed to parse kv_namespaces section:', e.message);
        return null;
      }
    }
    return null;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function executeCommand(command) {
  try {
    const output = execSync(command, { encoding: 'utf8' });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function listKVNamespaces() {
  console.log('\n📋 Fetching existing KV namespaces from Cloudflare...');
  const result = executeCommand('wrangler kv namespace list');

  if (!result.success) {
    console.error('❌ Failed to list KV namespaces:', result.error);
    return [];
  }

  try {
    const namespaces = JSON.parse(result.output);
    return namespaces;
  } catch (error) {
    console.error('❌ Failed to parse namespace list:', error.message);
    return [];
  }
}

function deleteNamespace(namespace) {
  const { id, title } = namespace;
  console.log(`  🗑️  Deleting ${title} (${id})...`);

  const result = executeCommand(`wrangler kv namespace delete --namespace-id=${id} --force`);

  if (result.success) {
    console.log(`  ✅ Deleted ${title}`);
    return true;
  } else {
    console.error(`  ❌ Failed to delete ${title}:`, result.error);
    return false;
  }
}

function readWranglerConfig() {
  const wranglerPath = path.join(process.cwd(), 'wrangler.jsonc');

  try {
    const content = fs.readFileSync(wranglerPath, 'utf8');
    const config = parseJSONC(content);

    if (!config) {
      console.error('❌ Failed to parse wrangler.jsonc');
      return null;
    }

    if (!config.kv_namespaces || !Array.isArray(config.kv_namespaces)) {
      console.log('ℹ️  No KV namespaces defined in wrangler.jsonc');
      return [];
    }

    return config.kv_namespaces;
  } catch (error) {
    console.error('❌ Failed to read wrangler.jsonc:', error.message);
    return null;
  }
}

async function main() {
  console.log('🧹 AtomicStream KV Namespace Cleanup Tool');
  console.log('=========================================\n');

  // Read KV namespaces from wrangler.jsonc
  console.log('📖 Reading project configuration from wrangler.jsonc...');
  const projectNamespaces = readWranglerConfig();

  if (projectNamespaces === null) {
    console.error('\n❌ Could not read project configuration.');
    console.error('Make sure wrangler.jsonc exists and is valid.');
    process.exit(1);
  }

  if (projectNamespaces.length === 0) {
    console.log('\nℹ️  No KV namespaces defined in this project.');
    process.exit(0);
  }

  console.log(`\n📦 Found ${projectNamespaces.length} KV namespaces in project configuration:`);
  projectNamespaces.forEach((ns) => {
    console.log(`  - ${ns.binding}${ns.preview_id ? ' (with preview)' : ''}`);
  });

  // List existing namespaces from Cloudflare
  const existingNamespaces = listKVNamespaces();

  if (existingNamespaces.length === 0) {
    console.log('\nℹ️  No KV namespaces found in your Cloudflare account.');
    process.exit(0);
  }

  // Match project namespaces with existing ones
  const namespacesToDelete = [];
  const previewNamespacesToDelete = [];

  projectNamespaces.forEach((projectNs) => {
    // Find production namespace
    const prodNs = existingNamespaces.find((ns) => ns.id === projectNs.id);
    if (prodNs) {
      namespacesToDelete.push(prodNs);
    }

    // Find preview namespace
    if (projectNs.preview_id) {
      const previewNs = existingNamespaces.find((ns) => ns.id === projectNs.preview_id);
      if (previewNs) {
        previewNamespacesToDelete.push(previewNs);
      }
    }
  });

  if (namespacesToDelete.length === 0 && previewNamespacesToDelete.length === 0) {
    console.log('\nℹ️  No project KV namespaces found in your Cloudflare account.');
    console.log('They may have already been deleted.');
    process.exit(0);
  }

  // Display namespaces to be deleted
  console.log('\n🎯 The following project KV namespaces will be deleted:');

  if (namespacesToDelete.length > 0) {
    console.log('\nProduction namespaces:');
    namespacesToDelete.forEach((ns) => {
      console.log(`  - ${ns.title} (${ns.id})`);
    });
  }

  if (previewNamespacesToDelete.length > 0) {
    console.log('\nPreview namespaces:');
    previewNamespacesToDelete.forEach((ns) => {
      console.log(`  - ${ns.title} (${ns.id})`);
    });
  }

  // Confirm deletion
  console.log('\n⚠️  WARNING: This will permanently delete the above KV namespaces!');
  console.log('This action cannot be undone.\n');

  rl.question('Are you sure you want to continue? (yes/no): ', (answer) => {
    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('\n❌ Cleanup cancelled.');
      rl.close();
      process.exit(0);
    }

    console.log('\n🚀 Starting cleanup...\n');

    let successCount = 0;
    let failCount = 0;

    // Delete production namespaces
    if (namespacesToDelete.length > 0) {
      console.log('Deleting production namespaces:');
      namespacesToDelete.forEach((namespace) => {
        if (deleteNamespace(namespace)) {
          successCount++;
        } else {
          failCount++;
        }
      });
    }

    // Delete preview namespaces
    if (previewNamespacesToDelete.length > 0) {
      console.log('\nDeleting preview namespaces:');
      previewNamespacesToDelete.forEach((namespace) => {
        if (deleteNamespace(namespace)) {
          successCount++;
        } else {
          failCount++;
        }
      });
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`  ✅ Successfully deleted: ${successCount}`);
    if (failCount > 0) {
      console.log(`  ❌ Failed to delete: ${failCount}`);
    }

    console.log('\n✨ Cleanup complete!');
    console.log('Run "npm run kv:setup" to recreate the namespaces.\n');

    // Update wrangler.jsonc to remove deleted namespace IDs
    if (successCount > 0) {
      rl.question('Remove deleted namespace IDs from wrangler.jsonc? (Y/n): ', (answer) => {
        if (answer.toLowerCase() !== 'n') {
          updateWranglerConfig(namespacesToDelete, previewNamespacesToDelete);
          console.log('✅ Updated wrangler.jsonc');
        }
        rl.close();
        process.exit(0);
      });
    } else {
      rl.close();
      process.exit(0);
    }
  });
}

function updateWranglerConfig(deletedProd, deletedPreview) {
  const wranglerPath = path.join(process.cwd(), 'wrangler.jsonc');

  try {
    let content = fs.readFileSync(wranglerPath, 'utf8');

    // Remove IDs of deleted namespaces
    [...deletedProd, ...deletedPreview].forEach((ns) => {
      // Replace the ID with empty string in quotes
      const idRegex = new RegExp(`"${ns.id}"`, 'g');
      content = content.replace(idRegex, '""');
    });

    fs.writeFileSync(wranglerPath, content);
  } catch (error) {
    console.error('Failed to update wrangler.jsonc:', error.message);
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
