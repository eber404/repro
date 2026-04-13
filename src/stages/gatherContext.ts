import { ReproContext } from '@/context';

const MAESTRO_TIMEOUT_MS = 60_000;

export async function gatherContext(ctx: ReproContext): Promise<ReproContext> {
  console.log('   👁️ Gathering UI context...');

  if (!ctx.deviceId) {
    ctx.error = 'No device ID set';
    return ctx;
  }

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
    const jsonStart = stdout.indexOf('{');
    const jsonText = jsonStart >= 0 ? stdout.substring(jsonStart) : stdout;
    ctx.uiTree = JSON.parse(jsonText);
  } catch (err) {
    ctx.error = `Failed to parse hierarchy JSON: ${err}`;
  }

  return ctx;
}
