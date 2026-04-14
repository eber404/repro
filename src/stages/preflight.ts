import { ReproContext } from '@/context';
import { resolveFlowRunDir } from '@/stages/compiler';

const { mkdirSync, writeFileSync } = require('fs');

const PREFLIGHT_TIMEOUT_MS = 45_000;

export async function verifyAppLaunch(ctx: ReproContext): Promise<ReproContext> {
  console.log('   🔎 Preflight app launch...');

  if (!ctx.deviceId) {
    ctx.error = 'Preflight requires deviceId';
    return ctx;
  }

  const runDir = resolveFlowRunDir(ctx.flowDir, ctx.flowFile);
  const preflightFlowPath = `${runDir}/preflight.yaml`;
  mkdirSync(runDir, { recursive: true });
  writeFileSync(preflightFlowPath, buildPreflightFlowYaml(ctx.appId, ctx.platform));
  ctx.flowDir = runDir;

  const command = buildPreflightCommand(ctx.maestroPath, ctx.platform, ctx.deviceId, preflightFlowPath);
  const proc = Bun.spawn({ cmd: command, stdout: 'pipe', stderr: 'pipe' });

  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    proc.kill();
  }, PREFLIGHT_TIMEOUT_MS);

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);

  clearTimeout(timeout);
  if (didTimeout) {
    ctx.error = `Preflight timed out after ${PREFLIGHT_TIMEOUT_MS}ms`;
    return ctx;
  }

  if (code === 0) {
    return ctx;
  }

  const details = `${stderr}\n${stdout}`.trim();
  ctx.error = `Preflight failed: Maestro cannot open app ${ctx.appId}. ${details}`;
  return ctx;
}

export function buildPreflightFlowYaml(appId: string, platform: 'android' | 'ios'): string {
  return `appId: ${appId}
platform: ${platform}
---
- launchApp:
    appId: ${appId}
    clearState: true
    clearKeychain: true
`;
}

export function buildPreflightCommand(maestroPath: string, platform: 'android' | 'ios', deviceId: string, flowPath: string): string[] {
  return [
    maestroPath,
    '--platform',
    platform,
    '--udid',
    deviceId,
    'test',
    flowPath,
    '--no-reinstall-driver'
  ];
}
