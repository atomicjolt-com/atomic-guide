/* eslint-env node */
/**
 * D1 Database Query Script
 * Interactive SQL query runner for D1
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'D1> ',
});

console.log('🗄️  AtomicStream D1 Query Console');
console.log('================================');
console.log('Type your SQL queries or commands:');
console.log('  .tables    - List all tables');
console.log('  .schema   - Show database schema');
console.log('  .quit      - Exit console');
console.log('  .help      - Show this help');
console.log('================================\n');

rl.prompt();

rl.on('line', (line) => {
  const command = line.trim();

  if (!command) {
    rl.prompt();
    return;
  }

  // Handle special commands
  switch (command.toLowerCase()) {
    case '.quit':
    case '.exit':
      console.log('Goodbye!');
      process.exit(0);
      break;

    case '.help':
      console.log('\nCommands:');
      console.log('  .tables    - List all tables');
      console.log('  .schema    - Show database schema');
      console.log('  .quit      - Exit console');
      console.log('  .help      - Show this help\n');
      rl.prompt();
      break;

    case '.tables':
      executeQuery("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      rl.prompt();
      break;

    case '.schema':
      executeQuery("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name");
      rl.prompt();
      break;

    default:
      // Execute as SQL query
      executeQuery(command);
      rl.prompt();
  }
});

function executeQuery(query) {
  try {
    const output = execSync(`wrangler d1 execute atomic-guide-db --command="${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
    console.log(output);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
