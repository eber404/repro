import { loadConfig } from '@/config';
import type { Config } from '@/config';
import { runPipeline } from '@/pipeline';
import { generateReport, printSummary } from '@/utils/output';

const RADIX = 10;

const HELP_TEXT = `
repro - Autonomous Bug Reproduction CLI

Usage:
  repro "bug description"          Use config defaults
  repro "bug" --app ./app.apk     Override app path
  repro --help                    Show this help
  repro --version                 Show version

Configuration:
  Set defaults in ~/.repro/config.json or ./repro.config.json
`;

const VERSION = 'repro v0.1.0';

function parseArgs(args: string[]): { bug: string; overrides: Partial<Config> } {
  const overrides: Partial<Config> = {};
  const bug = args.find(arg => !arg.startsWith('--'));

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--app' && i + 1 < args.length) overrides.appPath = args[++i];
    else if (arg === '--retries' && i + 1 < args.length) overrides.maxRetries = parseInt(args[++i], RADIX);
    else if (arg === '--platform' && i + 1 < args.length) overrides.platform = args[++i] as 'android' | 'ios';
  }

  return { bug: bug || '', overrides };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION);
    return;
  }

  const { bug, overrides } = parseArgs(args);

  if (!bug) {
    console.error('Error: Bug description required');
    console.error('Usage: repro "app crashes on login"');
    process.exit(1);
  }

  const config = loadConfig(overrides);

  console.log(`🔍 repro: "${bug}"`);
  console.log(`   app: ${config.appPath}`);
  console.log(`   platform: ${config.platform}`);
  console.log(`   max retries: ${config.maxRetries}`);

  const ctx = await runPipeline({
    bug,
    appPath: config.appPath,
    platform: config.platform,
    maxRetries: config.maxRetries,
    flowDir: config.flowDir,
    resetStrategy: config.resetStrategy,
    uiTree: null,
    plan: null,
    flowFile: null,
    executionResult: null,
    executionReport: null,
    reproduced: null,
    refinement: null,
    error: null,
    attempt: 1
  });

  if (ctx.reproduced) {
    generateReport(ctx);
  }

  printSummary(ctx);
}

main();