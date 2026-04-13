import { loadConfig } from '@/config';
import type { Config } from '@/config';
import { runPipeline } from '@/pipeline';
import { generateReport, printSummary } from '@/utils/output';
import { listAndroidDevices } from '@/platform/android';
import { listIOSSimulators } from '@/platform/ios';
import { join } from 'path';

const RADIX = 10;
const DEFAULT_RETRIES = 5;
const DEFAULT_MAESTRO_PATH = join(__dirname, '..', '..', 'maestro', 'maestro', 'bin', 'maestro');

async function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`${prompt}: `);
    process.stdin.once('data', (data: Buffer) => {
      resolve(data.toString().trim());
    });
  });
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
  const choice = await question('\n🔧 Select devices');

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

  const selectedDevices = await selectDevices();

  if (selectedDevices.length === 0) {
    console.log('❌ No devices selected');
    process.exit(1);
  }

  const config = loadConfig({});
  const runs: DeviceRun[] = [];

  const platforms = [...new Set(selectedDevices.map(d => d.platform))];

  for (const platform of platforms) {
    const devicesForPlatform = selectedDevices.filter(d => d.platform === platform);
    const platformLabel = platform === 'android' ? 'Android' : 'iOS';

    const appId = await question(`\n📦 ${platformLabel} App ID (e.g., com.example.${platform})`);
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

  const retriesInput = await question(`\n🔄 Max retries [${DEFAULT_RETRIES}]`);
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