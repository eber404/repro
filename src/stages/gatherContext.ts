import { ReproContext } from '@/context';
import { spawn } from 'child_process';

const MAESTRO_TIMEOUT_MS = 60_000;

export async function gatherContext(ctx: ReproContext): Promise<ReproContext> {
  console.log('   👁️ Gathering UI context...');

  if (!ctx.deviceId) {
    ctx.error = 'No device ID set';
    return ctx;
  }

  return new Promise((resolve) => {
    const args = [
      '--platform', ctx.platform,
      '--udid', ctx.deviceId,
      'hierarchy'
    ];

    const proc = spawn(ctx.maestroPath, args);
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill();
      ctx.error = 'Maestro hierarchy timed out';
      resolve(ctx);
    }, MAESTRO_TIMEOUT_MS);

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        ctx.error = `Maestro hierarchy failed: ${stderr || 'unknown error'}`;
        resolve(ctx);
        return;
      }

      try {
        const jsonStart = stdout.indexOf('{');
        const jsonText = jsonStart >= 0 ? stdout.substring(jsonStart) : stdout;
        ctx.uiTree = JSON.parse(jsonText);
      } catch (err) {
        ctx.error = `Failed to parse hierarchy JSON: ${err}`;
      }
      resolve(ctx);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      ctx.error = `Failed to run maestro: ${err.message}`;
      resolve(ctx);
    });
  });
}
