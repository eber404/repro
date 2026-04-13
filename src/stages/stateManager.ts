import { ReproContext } from '@/context';

export async function resetState(ctx: ReproContext): Promise<ReproContext> {
  console.log(`   🧹 Resetting state (${ctx.resetStrategy})...`);

  if (!ctx.deviceId) {
    ctx.error = 'No device ID set. Cannot reset state.';
    return ctx;
  }

  if (ctx.resetStrategy === 'deep-link') {
    if (!ctx.resetDeepLink) {
      ctx.error = 'resetDeepLink is required when resetStrategy is deep-link';
      return ctx;
    }

    try {
      await openDeepLink(ctx.platform, ctx.deviceId, ctx.resetDeepLink);
      return ctx;
    } catch (err) {
      ctx.error = `Failed to reset state via deep link: ${err}`;
      return ctx;
    }
  }

  if (ctx.resetStrategy !== 'clear-app-data') {
    ctx.error = `Unsupported reset strategy: ${ctx.resetStrategy}`;
    return ctx;
  }

  const packageName = extractPackageName(ctx.appId);

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

export function extractPackageName(appIdOrPath: string): string {
  const appPackagePattern = /^([a-zA-Z][\w]*\.)+[a-zA-Z][\w]*$/;
  if (appPackagePattern.test(appIdOrPath)) {
    return appIdOrPath;
  }

  const match = appIdOrPath.match(/([^\/]+)\.(apk|ipa)$/);
  if (!match?.[1]) {
    throw new Error(`Unable to derive package name from: ${appIdOrPath}`);
  }

  return match[1];
}

async function openDeepLink(platform: 'android' | 'ios', deviceId: string, deepLink: string): Promise<void> {
  const command = buildDeepLinkCommand(platform, deviceId, deepLink);
  const proc = Bun.spawn({ cmd: command });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`exit code ${code}`);
  }
}

export function buildDeepLinkCommand(platform: 'android' | 'ios', deviceId: string, deepLink: string): string[] {
  if (platform === 'ios') {
    return ['xcrun', 'simctl', 'openurl', deviceId, deepLink];
  }

  return [
    'adb',
    '-s',
    deviceId,
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    deepLink
  ];
}
