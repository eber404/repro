import { loadConfig } from '@/config';
import type { Config } from '@/config';
import { runPipeline } from '@/pipeline';
import { generateReport, printSummary } from '@/utils/output';
import { listAndroidDevices } from '@/platform/android';
import { listIOSSimulators } from '@/platform/ios';
import type { Device } from '@/context';

const RADIX = 10;
const DEFAULT_RETRIES = 5;

async function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`${prompt}: `);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

async function selectDevice(platform: 'android' | 'ios'): Promise<string | null> {
  console.log(`\n📱 ${platform === 'android' ? 'Android devices' : 'iOS simulators'}:\n`);

  const devices: Device[] = platform === 'android'
    ? await listAndroidDevices()
    : await listIOSSimulators();

  if (devices.length === 0) {
    console.log(`   ❌ No ${platform} devices found. Make sure an emulator is running.`);
    return null;
  }

  for (let i = 0; i < devices.length; i++) {
    const status = devices[i].status ? ` (${devices[i].status})` : '';
    console.log(`   ${i + 1}. ${devices[i].name}${status}`);
  }

  const choice = await question(`\n🔧 Select device (1-${devices.length})`);
  const index = parseInt(choice, RADIX) - 1;

  if (isNaN(index) || index < 0 || index >= devices.length) {
    console.log(`   ⚠️  Invalid selection, using first device: ${devices[0].name}`);
    return devices[0].id;
  }

  console.log(`   ✅ Selected: ${devices[index].name}`);
  return devices[index].id;
}

async function selectPlatform(): Promise<'android' | 'ios'> {
  console.log('\n📲 Select platform:\n   1. Android\n   2. iOS');
  const choice = await question('\n🔧 Platform (1/2)');
  return choice === '2' ? 'ios' : 'android';
}

async function runInteractive(): Promise<void> {
  console.log('\n🔍 repro - Autonomous Bug Reproduction CLI\n');
  console.log('─'.repeat(50));

  const bug = await question('🐛 Bug description');
  if (!bug) {
    console.log('❌ Bug description is required');
    process.exit(1);
  }

  const config = loadConfig({});

  const appPath = await question(`📱 App path${config.appPath ? ` [${config.appPath}]` : ''}`);
  const finalAppPath = appPath || config.appPath;
  if (!finalAppPath) {
    console.log('❌ App path is required');
    process.exit(1);
  }

  let platform: 'android' | 'ios' = config.platform;
  if (!platform) {
    platform = await selectPlatform();
  } else {
    console.log(`📲 Platform: ${platform}`);
  }

  const deviceId = await selectDevice(platform);
  if (!deviceId) {
    console.log('❌ No device selected');
    process.exit(1);
  }

  const retriesInput = await question(`🔄 Max retries [${DEFAULT_RETRIES}]`);
  const maxRetries = retriesInput ? parseInt(retriesInput, RADIX) : DEFAULT_RETRIES;

  console.log('\n' + '─'.repeat(50));
  console.log('🚀 Starting repro...\n');

  const ctx = await runPipeline({
    bug,
    appPath: finalAppPath,
    deviceId,
    platform,
    maxRetries,
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

runInteractive();