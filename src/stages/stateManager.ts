import { ReproContext } from '@/context';

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

  try {
    if (ctx.platform === 'ios') {
      const proc = Bun.spawn({
        cmd: ['xcrun', 'simctl', 'erase', ctx.deviceId]
      });
      await proc.exited;
    } else {
      const proc = Bun.spawn({
        cmd: ['adb', '-s', ctx.deviceId, 'shell', 'pm', 'clear', packageName]
      });
      await proc.exited;
    }
  } catch (err) {
    ctx.error = `Failed to reset state: ${err}`;
  }

  return ctx;
}

function extractPackageName(appPath: string): string {
  const match = appPath.match(/([^\/]+)\.(apk|ipa)$/);
  return match?.[1] || 'unknown';
}
