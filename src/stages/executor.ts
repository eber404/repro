import { ReproContext } from '@/context';

const { existsSync } = require('fs');

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

  const args = [
    '--platform', ctx.platform,
    '--udid', ctx.deviceId,
    'test',
    ctx.flowFile,
    '--no-reinstall-driver'
  ];

  const proc = Bun.spawn({
    cmd: [ctx.maestroPath, ...args],
    stdout: 'pipe',
    stderr: 'pipe'
  });

  let output = '';

  proc.stdout?.pipeTo(new WritableStream({
    write(chunk) {
      const text = new TextDecoder().decode(chunk);
      output += text;
      console.log(text);
    }
  }));

  proc.stderr?.pipeTo(new WritableStream({
    write(chunk) {
      const text = new TextDecoder().decode(chunk);
      output += text;
    }
  }));

  const timeoutTimer = setTimeout(() => {
    proc.kill();
    ctx.error = `Executor timed out after ${EXECUTOR_TIMEOUT_MS}ms`;
  }, EXECUTOR_TIMEOUT_MS);

  const code = await proc.exited;
  clearTimeout(timeoutTimer);

  ctx.executionResult = {
    success: code === 0,
    output,
    screenshots: []
  };

  return ctx;
}
