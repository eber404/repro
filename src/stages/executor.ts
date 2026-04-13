import { ReproContext } from '@/context';
import { spawn } from 'child_process';

const EXECUTOR_TIMEOUT_MS = 300_000;

export async function execute(ctx: ReproContext): Promise<ReproContext> {
  console.log('   ⚡ Executing flow...');

  if (!ctx.flowFile) {
    ctx.error = 'Executor requires flowFile from compiler';
    return ctx;
  }

  return new Promise((resolve) => {
    const cmd = `maestro test ${ctx.flowFile}`;
    const proc = spawn(cmd, [], { shell: true, timeout: EXECUTOR_TIMEOUT_MS });

    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.stderr?.on('data', (data) => { output += data.toString(); });

    proc.on('close', (code) => {
      ctx.executionResult = {
        success: code === 0,
        output,
        screenshots: []
      };
      resolve(ctx);
    });

    proc.on('error', (err) => {
      ctx.error = `Executor failed: ${err.message}`;
      resolve(ctx);
    });
  });
}
