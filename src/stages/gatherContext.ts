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
      'hierarchy',
      '--platform', ctx.platform,
      '--udid', ctx.deviceId
    ];

    const proc = spawn(ctx.maestroPath, args, { timeout: MAESTRO_TIMEOUT_MS });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        ctx.error = `Maestro hierarchy failed: ${stderr}`;
        resolve(ctx);
        return;
      }

      try {
        ctx.uiTree = parseHierarchy(stdout);
      } catch (err) {
        ctx.error = `Failed to parse hierarchy: ${err}`;
      }
      resolve(ctx);
    });

    proc.on('error', (err) => {
      ctx.error = `Failed to run maestro: ${err.message}`;
      resolve(ctx);
    });
  });
}

function parseHierarchy(output: string): object {
  const elements: Record<string, unknown>[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*\|\s*([^\|]+)\s*\|\s*([^\|]+)\s*\|\s*([^\|]*)\s*\|/);
    if (match) {
      const [, elementType, elementId, text] = match;
      elements.push({
        type: elementType.trim(),
        id: elementId.trim(),
        text: text.trim()
      });
    }
  }

  if (elements.length === 0) {
    return { screen: 'Unknown', elements: [] };
  }

  return {
    screen: 'CurrentScreen',
    elements
  };
}
