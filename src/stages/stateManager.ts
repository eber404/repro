import { ReproContext } from '@/context';

export async function resetState(ctx: ReproContext): Promise<ReproContext> {
  console.log(`   🧹 Resetting state (${ctx.resetStrategy})...`);

  if (!ctx.deviceId) {
    ctx.error = 'No device ID set. Cannot reset state.';
    return ctx;
  }

  if (ctx.resetStrategy === 'deep-link' && !ctx.resetDeepLink) {
    ctx.error = 'resetDeepLink is required when resetStrategy is deep-link';
    return ctx;
  }

  if (ctx.resetStrategy === 'deep-link') {
    try {
      await openDeepLink(ctx.platform, ctx.deviceId, ctx.resetDeepLink as string);
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

  if (ctx.platform === 'ios') {
    ctx.error = await resetIOSAppState(ctx.deviceId, ctx.appId);
    return ctx;
  }

  const packageName = extractPackageName(ctx.appId);
  const result = await runCommand(['adb', '-s', ctx.deviceId, 'shell', 'pm', 'clear', packageName]);
  if (result.code === 0) {
    return ctx;
  }

  ctx.error = `Failed to clear Android app data: ${result.stderr || result.stdout || `exit code ${result.code}`}`;

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

export function buildIOSClearStateCommands(deviceId: string, appId: string): string[][] {
  return [
    ['xcrun', 'simctl', 'terminate', deviceId, appId]
  ];
}

async function resetIOSAppState(deviceId: string, appId: string): Promise<string | null> {
  const commands = buildIOSClearStateCommands(deviceId, appId);
  for (const command of commands) {
    const result = await runCommand(command);
    if (result.code === 0) {
      continue;
    }

    if (isSafeTerminateMiss(result.stderr, result.stdout)) {
      continue;
    }

    return `Failed to reset iOS state: ${result.stderr || result.stdout || `exit code ${result.code}`}`;
  }

  return null;
}

function isSafeTerminateMiss(stderr: string, stdout: string): boolean {
  const combined = `${stderr}\n${stdout}`.toLowerCase();
  if (!combined) {
    return false;
  }

  return combined.includes('found nothing to terminate') || combined.includes('not running');
}

async function runCommand(command: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({ cmd: command, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);

  return { code, stdout, stderr };
}
