import { ReproContext } from '@/context';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

const EXECUTOR_TIMEOUT_MS = 300_000;

export async function execute(ctx: ReproContext): Promise<ReproContext> {
  console.log('   ⚡ Executing flow...');

  if (!ctx.flowFile) {
    ctx.error = 'Executor requires flowFile from compiler';
    return ctx;
  }

  if (!ctx.deviceId) {
    ctx.error = 'Executor requires deviceId';
    return ctx;
  }

  if (!existsSync(ctx.flowFile)) {
    ctx.error = `Flow file not found: ${ctx.flowFile}`;
    return ctx;
  }

  return new Promise((resolve) => {
    const args = [
      '--platform', ctx.platform,
      '--udid', ctx.deviceId,
      'test',
      ctx.flowFile,
      '--no-reinstall-driver'
    ];

    const proc = spawn(ctx.maestroPath, args);

    const timer = setTimeout(() => {
      proc.kill();
      ctx.error = `Executor timed out after ${EXECUTOR_TIMEOUT_MS}ms`;
      resolve(ctx);
    }, EXECUTOR_TIMEOUT_MS);

    let output = '';

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });
    proc.stderr?.on('data', (data) => { output += data.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      ctx.executionResult = {
        success: code === 0,
        output,
        screenshots: []
      };
      resolve(ctx);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      ctx.error = `Executor failed: ${err.message}`;
      resolve(ctx);
    });
  });
}
