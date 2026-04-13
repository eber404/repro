import { loadConfig } from '@/config';
import { runPipeline } from '@/pipeline';
import { generateReport, printSummary } from '@/utils/output';
import { listAndroidDevices } from '@/platform/android';
import { listIOSSimulators } from '@/platform/ios';

const RADIX = 10;
const DEFAULT_RETRIES = 5;
const DEFAULT_MAESTRO_PATH = `${process.cwd()}/maestro/maestro/bin/maestro`;

const args = process.argv.slice(2);
const isInteractive = args.includes('--interactive') || args.includes('-i');

function showHelp(): void {
  console.log(`
🔍 repro - Autonomous Bug Reproduction CLI

Usage:
  repro --interactive                  Start interactive mode
  repro -i                            Shortcut for interactive mode
  repro "bug" --device "name" -app id Direct mode
  repro --help                        Show this help message

Direct mode examples:
  repro "login bug" --device "iPhone 16e" -app com.example.app
  repro "crash on launch" --device "Android Emulator" -app com.example.app

Environment variables:
  REPRO_AGENT=gemini     Agent for planning (gemini, claude, codex, opencode)
  REPRO_EVAL_AGENT=...   Separate agent for evaluation
  REPRO_APP_EMAIL=...    App email (set in .env)
  REPRO_APP_PASSWORD=... App password (set in .env)

For more info, see AGENTS.md
`);
}

async function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    console.log(`${prompt}: `);
    const reader = new ConsoleReader();
    const line = reader.readLine();
    resolve(line.trim());
  });
}

class ConsoleReader {
  private reader: any;

  constructor() {
    this.reader = { readLine: () => '' };
  }

  readLine(): string {
    return '';
  }
}

interface DeviceOption {
  id: string;
  name: string;
  platform: 'android' | 'ios';
  type: 'emulator' | 'device';
}

async function selectDevices(): Promise<DeviceOption[]> {
  console.log('\n📱 Available devices:\n');

  const androidDevices = await listAndroidDevices();
  const iosDevices = await listIOSSimulators();

  const allDevices: DeviceOption[] = [];

  for (const d of androidDevices) {
    allDevices.push({ id: d.id, name: d.name, platform: 'android', type: 'emulator' });
  }

  for (const d of iosDevices) {
    allDevices.push({ id: d.id, name: d.name, platform: 'ios', type: 'emulator' });
  }

  if (allDevices.length === 0) {
    console.log('   ❌ No devices found. Make sure an emulator is running.');
    return [];
  }

  for (let i = 0; i < allDevices.length; i++) {
    const device = allDevices[i];
    const platformLabel = device.platform === 'android' ? 'Android' : 'iOS';
    const typeLabel = device.type === 'emulator' ? 'emulator' : 'device';
    console.log(`   ${i + 1}. ${device.name} (${platformLabel} ${typeLabel})`);
  }

  console.log('\n💡 Enter device numbers separated by comma (e.g., 1,3) or "all" for all devices');

  const line = await readline();
  const choice = line.trim();

  if (choice.toLowerCase() === 'all') {
    console.log(`   ✅ Selected all ${allDevices.length} devices`);
    return allDevices;
  }

  const indices = choice.split(',').map(s => parseInt(s.trim(), RADIX) - 1);
  const selected: DeviceOption[] = [];

  for (const idx of indices) {
    if (!isNaN(idx) && idx >= 0 && idx < allDevices.length) {
      selected.push(allDevices[idx]);
    }
  }

  if (selected.length === 0) {
    console.log('   ⚠️  No valid selection');
    return [];
  }

  console.log(`   ✅ Selected ${selected.length} device(s)`);
  return selected;
}

async function readline(): Promise<string> {
  return await new Promise((resolve) => {
    const buf = Buffer.alloc(256);
    const fd = process.stdin.fd;
    require('fs').readSync(fd, buf, 0, 256, 0);
    resolve(buf.toString('utf8').trim());
  });
}

interface DeviceRun {
  deviceId: string;
  platform: 'android' | 'ios';
  appId: string;
}

async function runInteractive(): Promise<void> {
  console.log('\n🔍 repro - Autonomous Bug Reproduction CLI\n');
  console.log('─'.repeat(50));

  const bug = await readline();
  if (!bug) {
    console.log('❌ Bug description is required');
    process.exit(1);
  }

  const selectedDevices = await selectDevices();

  if (selectedDevices.length === 0) {
    console.log('❌ No devices selected');
    process.exit(1);
  }

  const config = await loadConfig({});
  const runs: DeviceRun[] = [];

  const platforms = [...new Set(selectedDevices.map(d => d.platform))];

  for (const platform of platforms) {
    const devicesForPlatform = selectedDevices.filter(d => d.platform === platform);
    const platformLabel = platform === 'android' ? 'Android' : 'iOS';

    console.log(`\n📦 ${platformLabel} App ID (e.g., com.example.${platform})`);
    const appId = await readline();
    if (!appId) {
      console.log(`❌ ${platformLabel} App ID is required`);
      process.exit(1);
    }

    for (const device of devicesForPlatform) {
      runs.push({ deviceId: device.id, platform, appId });
    }
  }

  if (runs.length === 0) {
    console.log('❌ No devices to run on');
    process.exit(1);
  }

  console.log(`\n🔄 Max retries [${DEFAULT_RETRIES}]`);
  const retriesInput = await readline();
  const maxRetries = retriesInput ? parseInt(retriesInput, RADIX) : DEFAULT_RETRIES;

  console.log('\n' + '─'.repeat(50));
  console.log('🚀 Starting repro...\n');

  for (const run of runs) {
    const platformLabel = run.platform === 'android' ? 'Android' : 'iOS';
    console.log(`📱 Running on ${platformLabel} device: ${run.deviceId}\n`);

    const ctx = await runPipeline({
      bug,
      appPath: run.appId,
      deviceId: run.deviceId,
      platform: run.platform,
      maxRetries,
      flowDir: config.flowDir,
      resetStrategy: config.resetStrategy,
      maestroPath: DEFAULT_MAESTRO_PATH,
      uiTree: null,
      plan: null,
      flowFile: null,
      executionResult: null,
      executionReport: null,
      reproduced: null,
      refinement: null,
      error: null,
      attempt: 1,
      credentials: config.credentials
    });

    if (ctx.reproduced) {
      generateReport(ctx);
    }

    printSummary(ctx);
    console.log('');
  }
}

async function findDeviceByName(deviceName: string): Promise<DeviceOption | null> {
  const androidDevices = await listAndroidDevices();
  const iosDevices = await listIOSSimulators();

  const allDevices: DeviceOption[] = [];

  for (const d of androidDevices) {
    allDevices.push({ id: d.id, name: d.name, platform: 'android', type: 'emulator' });
  }

  for (const d of iosDevices) {
    allDevices.push({ id: d.id, name: d.name, platform: 'ios', type: 'emulator' });
  }

  const normalizedSearch = deviceName.toLowerCase().trim();

  for (const device of allDevices) {
    if (device.name.toLowerCase().trim() === normalizedSearch) {
      return device;
    }
  }

  for (const device of allDevices) {
    if (device.name.toLowerCase().includes(normalizedSearch)) {
      return device;
    }
  }

  return null;
}

function parseDirectArgs(): { bug: string; deviceName: string; appId: string } | null {
  if (args.length < 4) return null;

  let bug = '';
  let deviceName = '';
  let appId = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith('-')) {
      bug = arg;
    } else if (arg === '--device') {
      deviceName = args[i + 1] || '';
      i++;
    } else if (arg === '-app') {
      appId = args[i + 1] || '';
      i++;
    }
  }

  if (!bug || !deviceName || !appId) return null;

  return { bug, deviceName, appId };
}

async function runDirect(bug: string, deviceName: string, appId: string): Promise<void> {
  console.log(`\n🔍 repro - Direct Mode\n`);
  console.log('─'.repeat(50));
  console.log(`🐛 Bug: ${bug}`);
  console.log(`📱 Device: ${deviceName}`);
  console.log(`📦 App: ${appId}`);
  console.log('─'.repeat(50));

  const device = await findDeviceByName(deviceName);

  if (!device) {
    console.log(`❌ Device not found: "${deviceName}"`);
    console.log('💡 Run with --interactive to see available devices');
    process.exit(1);
  }

  const platformLabel = device.platform === 'android' ? 'Android' : 'iOS';
  console.log(`✅ Found: ${device.name} (${platformLabel})`);
  console.log('');

  const config = await loadConfig({});

  const ctx = await runPipeline({
    bug,
    appPath: appId,
    deviceId: device.id,
    platform: device.platform,
    maxRetries: DEFAULT_RETRIES,
    flowDir: config.flowDir,
    resetStrategy: config.resetStrategy,
    maestroPath: DEFAULT_MAESTRO_PATH,
    uiTree: null,
    plan: null,
    flowFile: null,
    executionResult: null,
    executionReport: null,
    reproduced: null,
    refinement: null,
    error: null,
    attempt: 1,
    credentials: config.credentials
  });

  if (ctx.reproduced) {
    generateReport(ctx);
  }

  printSummary(ctx);
  console.log('');
}

async function main(): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (isInteractive) {
    await runInteractive();
    return;
  }

  const directArgs = parseDirectArgs();

  if (directArgs) {
    await runDirect(directArgs.bug, directArgs.deviceName, directArgs.appId);
    return;
  }

  showHelp();
  process.exit(0);
}

main();
