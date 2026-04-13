import { ReproContext } from '@/context';
import { spawn } from 'child_process';

const ADB_CLEAR_TIMEOUT_MS = 30_000;

export async function resetState(ctx: ReproContext): Promise<ReproContext> {
  console.log(`   🧹 Resetting state (${ctx.resetStrategy})...`);

  if (ctx.resetStrategy !== 'clear-app-data') {
    return ctx;
  }

  const packageName = extractPackageName(ctx.appPath);

  if (ctx.platform === 'ios') {
    const deviceId = await getiOSDeviceId();
    if (!deviceId) {
      ctx.error = 'Failed to get iOS device ID for state reset';
      return ctx;
    }
    return new Promise((resolve) => {
      const proc = spawn(`xcrun simctl erase ${deviceId}`, [], { shell: true, timeout: ADB_CLEAR_TIMEOUT_MS });
      proc.on('close', () => resolve(ctx));
      proc.on('error', () => {
        ctx.error = `Failed to reset state: xcrun simctl erase`;
        resolve(ctx);
      });
    });
  }

  return new Promise((resolve) => {
    const proc = spawn(`adb shell pm clear ${packageName}`, [], { shell: true, timeout: ADB_CLEAR_TIMEOUT_MS });
    proc.on('close', () => resolve(ctx));
    proc.on('error', () => {
      ctx.error = `Failed to reset state: adb shell pm clear`;
      resolve(ctx);
    });
  });
}

async function getiOSDeviceId(): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('xcrun simctl list devices available', [], { shell: true });
    let output = '';
    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => {
      const match = output.match(/--device\s+([A-F0-9-]+)/i);
      resolve(match?.[1] || null);
    });
    proc.on('error', () => resolve(null));
  });
}

function extractPackageName(appPath: string): string {
  const match = appPath.match(/([^\/]+)\.(apk|ipa)$/);
  return match?.[1] || 'unknown';
}
