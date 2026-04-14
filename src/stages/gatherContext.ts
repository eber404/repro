import { ReproContext } from '@/context';
import { resolveFlowRunDir } from '@/stages/compiler';

const { mkdirSync } = require('fs');

const MAESTRO_TIMEOUT_MS = 60_000;
const SCREENSHOT_FILE_NAME = 'visible-screen.png';

export async function gatherContext(ctx: ReproContext): Promise<ReproContext> {
  console.log('   👁️ Gathering UI context...');

  if (!ctx.deviceId) {
    ctx.error = 'No device ID set';
    return ctx;
  }

  const flowRunDir = resolveFlowRunDir(ctx.flowDir, ctx.flowFile);
  const attemptDir = `${flowRunDir}/attempt-${ctx.attempt}`;
  mkdirSync(attemptDir, { recursive: true });
  ctx.flowDir = flowRunDir;
  const screenshotPath = buildScreenshotPath(flowRunDir, ctx.attempt);

  const args = [
    '--platform', ctx.platform,
    '--udid', ctx.deviceId,
    'hierarchy'
  ];

  const proc = Bun.spawn({
    cmd: [ctx.maestroPath, ...args],
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const timeoutTimer = setTimeout(() => {
    proc.kill();
    ctx.error = 'Maestro hierarchy timed out';
  }, MAESTRO_TIMEOUT_MS);

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);

  clearTimeout(timeoutTimer);

  if (code !== 0) {
    ctx.error = `Maestro hierarchy failed: ${stderr || 'unknown error'}`;
    return ctx;
  }

  try {
    ctx.uiTree = parseHierarchyOutput(stdout);
  } catch (err) {
    ctx.error = `Failed to parse hierarchy JSON: ${err}`;
    return ctx;
  }

  const screenshotError = await captureVisibleScreenshot(ctx, screenshotPath);
  if (screenshotError) {
    ctx.error = screenshotError;
    return ctx;
  }

  ctx.visibleScreenshotPath = screenshotPath;

  return ctx;
}

async function captureVisibleScreenshot(ctx: ReproContext, screenshotPath: string): Promise<string | null> {
  if (!ctx.deviceId) {
    return 'Maestro screenshot requires deviceId';
  }

  const screenshotProc = Bun.spawn({
    cmd: buildScreenshotCommand(ctx.maestroPath, ctx.platform, ctx.deviceId, screenshotPath),
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const timeoutTimer = setTimeout(() => {
    screenshotProc.kill();
  }, MAESTRO_TIMEOUT_MS);

  const [stdout, stderr, code] = await Promise.all([
    new Response(screenshotProc.stdout).text(),
    new Response(screenshotProc.stderr).text(),
    screenshotProc.exited
  ]);

  clearTimeout(timeoutTimer);
  if (code === 0) {
    return null;
  }

  const details = `${stderr}\n${stdout}`.trim();
  return `Maestro screenshot failed: ${details || 'unknown error'}`;
}

export function buildScreenshotCommand(
  maestroPath: string,
  platform: 'android' | 'ios',
  deviceId: string,
  screenshotPath: string
): string[] {
  return [
    maestroPath,
    '--platform',
    platform,
    '--udid',
    deviceId,
    'take-screenshot',
    screenshotPath
  ];
}

export function buildScreenshotPath(flowRunDir: string, attempt: number): string {
  return `${flowRunDir}/attempt-${attempt}/${SCREENSHOT_FILE_NAME}`;
}

export function parseHierarchyOutput(output: string): object {
  const startIndex = output.indexOf('{');
  if (startIndex < 0) {
    throw new Error('No JSON object found in hierarchy output');
  }

  const endIndex = findJsonObjectEnd(output, startIndex);
  const jsonText = output.slice(startIndex, endIndex + 1);
  return JSON.parse(jsonText);
}

function findJsonObjectEnd(text: string, startIndex: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char !== '}') {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return index;
    }
  }

  throw new Error('Unterminated JSON object in hierarchy output');
}
