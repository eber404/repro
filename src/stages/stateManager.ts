import { ReproContext } from '@/context';
import { spawn } from 'child_process';

const ADB_CLEAR_TIMEOUT_MS = 30_000;

export async function resetState(ctx: ReproContext): Promise<ReproContext> {
  console.log(`   🧹 Resetting state (${ctx.resetStrategy})...`);

  if (ctx.resetStrategy !== 'clear-app-data') {
    return ctx;
  }

  if (!ctx.deviceId) {
    ctx.error = 'No device ID set. Cannot reset state.';
    return ctx;
  }

  const packageName = extractPackageName(ctx.appPath);

  return new Promise((resolve) => {
    let cmd: string;

    if (ctx.platform === 'ios') {
      cmd = `xcrun simctl erase "${ctx.deviceId}"`;
    } else {
      cmd = `adb -s "${ctx.deviceId}" shell pm clear ${packageName}`;
    }

    const proc = spawn(cmd, [], { shell: true });
    proc.on('close', () => resolve(ctx));
    proc.on('error', () => {
      ctx.error = `Failed to reset state: ${cmd}`;
      resolve(ctx);
    });
  });
}

function extractPackageName(appPath: string): string {
  const match = appPath.match(/([^\/]+)\.(apk|ipa)$/);
  return match?.[1] || 'unknown';
}
