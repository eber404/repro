import { loadConfig } from '@/config';
import type { Config } from '@/config';
import { runPipeline } from '@/pipeline';
import { generateReport, printSummary } from '@/utils/output';
import { listAndroidDevices } from '@/platform/android';
import { listIOSSimulators } from '@/platform/ios';
import type { Device } from '@/context';

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

async function selectDevice(platform: 'android' | 'ios'): Promise<string | null> {
  console.log(`\n📱 ${platform === 'android' ? 'Android devices' : 'iOS simulators'}:`);

  const devices: Device[] = platform === 'android'
    ? await listAndroidDevices()
    : await listIOSSimulators();

  if (devices.length === 0) {
    console.log(`   No ${platform} devices found. Make sure an emulator is running.`);
    return null;
  }

  for (let i = 0; i < devices.length; i++) {
    const status = devices[i].status ? ` (${devices[i].status})` : '';
    console.log(`   ${i + 1}. ${devices[i].name}${status}`);
  }

  const device = devices[0];
  console.log(`\n✅ Using device: ${device.name}`);

  return device.id;
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

  if (!config.appPath) {
    console.error('Error: App path required. Set in config or pass --app');
    console.error('Usage: repro "bug" --app ./app.apk');
    process.exit(1);
  }

  const deviceId = await selectDevice(config.platform);

  if (!deviceId) {
    console.error('Error: No device selected or available');
    process.exit(1);
  }

  console.log(`🔍 repro: "${bug}"`);
  console.log(`   app: ${config.appPath}`);
  console.log(`   device: ${deviceId}`);
  console.log(`   platform: ${config.platform}`);
  console.log(`   max retries: ${config.maxRetries}`);

  const ctx = await runPipeline({
    bug,
    appPath: config.appPath,
    deviceId,
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