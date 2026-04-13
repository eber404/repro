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

async function selectDevices(platform: 'android' | 'ios'): Promise<string[]> {
  console.log(`\n📱 ${platform === 'android' ? 'Android devices' : 'iOS simulators'}:\n`);

  const devices: Device[] = platform === 'android'
    ? await listAndroidDevices()
    : await listIOSSimulators();

  if (devices.length === 0) {
    console.log(`   ❌ No ${platform} devices found. Make sure an emulator is running.`);
    return [];
  }

  for (let i = 0; i < devices.length; i++) {
    const status = devices[i].status ? ` (${devices[i].status})` : '';
    console.log(`   ${i + 1}. ${devices[i].name}${status}`);
  }

  console.log('\n💡 Enter device numbers separated by comma (e.g., 1,3) or "all" for all devices');
  const choice = await question('\n🔧 Select devices');

  if (choice.toLowerCase() === 'all') {
    console.log(`   ✅ Selected all ${devices.length} devices`);
    return devices.map(d => d.id);
  }

  const indices = choice.split(',').map(s => parseInt(s.trim(), RADIX) - 1);
  const selected: string[] = [];

  for (const idx of indices) {
    if (!isNaN(idx) && idx >= 0 && idx < devices.length) {
      selected.push(devices[idx].id);
    }
  }

  if (selected.length === 0) {
    console.log('   ⚠️  No valid selection, using first device');
    selected.push(devices[0].id);
  }

  console.log(`   ✅ Selected ${selected.length} device(s)`);
  return selected;
}

async function selectPlatform(): Promise<'android' | 'ios'> {
  console.log('\n📲 Select platform:\n   1. Android\n   2. iOS\n   3. Both (run on all devices)');
  const choice = await question('\n🔧 Platform (1/2/3)');

  if (choice === '3') {
    return 'both';
  }

  return choice === '2' ? 'ios' : 'android';
}

interface DeviceRun {
  deviceId: string;
  platform: 'android' | 'ios';
  appId: string;
}

async function runInteractive(): Promise<void> {
  console.log('\n🔍 repro - Autonomous Bug Reproduction CLI\n');
  console.log('─'.repeat(50));

  const bug = await question('🐛 Bug description');
  if (!bug) {
    console.log('❌ Bug description is required');
    process.exit(1);
  }

  const platformChoice = await selectPlatform();
  const config = loadConfig({});
  const runs: DeviceRun[] = [];

  if (platformChoice === 'both') {
    const androidIds = await selectDevices('android');
    if (androidIds.length > 0) {
      const androidAppId = await question('\n📦 Android App ID (e.g., com.example.app)');
      if (!androidAppId) {
        console.log('❌ Android App ID is required');
        process.exit(1);
      }
      for (const id of androidIds) {
        runs.push({ deviceId: id, platform: 'android', appId: androidAppId });
      }
    }

    const iosIds = await selectDevices('ios');
    if (iosIds.length > 0) {
      const iosAppId = await question('\n📦 iOS App ID (e.g., com.example.app)');
      if (!iosAppId) {
        console.log('❌ iOS App ID is required');
        process.exit(1);
      }
      for (const id of iosIds) {
        runs.push({ deviceId: id, platform: 'ios', appId: iosAppId });
      }
    }
  } else {
    const deviceIds = await selectDevices(platformChoice);
    if (deviceIds.length === 0) {
      console.log('❌ No devices selected');
      process.exit(1);
    }

    const appId = await question('\n📦 App ID (e.g., com.example.app)');
    if (!appId) {
      console.log('❌ App ID is required');
      process.exit(1);
    }

    for (const id of deviceIds) {
      runs.push({ deviceId: id, platform: platformChoice, appId });
    }
  }

  if (runs.length === 0) {
    console.log('❌ No devices to run on');
    process.exit(1);
  }

  const retriesInput = await question(`🔄 Max retries [${DEFAULT_RETRIES}]`);
  const maxRetries = retriesInput ? parseInt(retriesInput, RADIX) : DEFAULT_RETRIES;

  console.log('\n' + '─'.repeat(50));
  console.log('🚀 Starting repro...\n');

  for (const run of runs) {
    console.log(`📱 Running on ${run.platform} device: ${run.deviceId}\n`);

    const ctx = await runPipeline({
      bug,
      appPath: run.appId,
      deviceId: run.deviceId,
      platform: run.platform,
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
    console.log('');
  }
}

async function runInteractive(): Promise<void> {
  console.log('\n🔍 repro - Autonomous Bug Reproduction CLI\n');
  console.log('─'.repeat(50));

  const bug = await question('🐛 Bug description');
  if (!bug) {
    console.log('❌ Bug description is required');
    process.exit(1);
  }

  const { deviceIds, platform } = await selectDevices();

  if (deviceIds.length === 0) {
    console.log('❌ No devices selected');
    process.exit(1);
  }

  const appId = await question('\n📦 App ID (e.g., com.example.app)');
  if (!appId) {
    console.log('❌ App ID is required');
    process.exit(1);
  }

  const config = loadConfig({});

  const retriesInput = await question(`🔄 Max retries [${DEFAULT_RETRIES}]`);
  const maxRetries = retriesInput ? parseInt(retriesInput, RADIX) : DEFAULT_RETRIES;

  console.log('\n' + '─'.repeat(50));
  console.log('🚀 Starting repro...\n');

  for (const deviceId of deviceIds) {
    console.log(`📱 Running on device: ${deviceId}\n`);

    const ctx = await runPipeline({
      bug,
      appPath: appId,
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
    console.log('');
  }
}

runInteractive();