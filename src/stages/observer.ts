import { ReproContext } from '@/context';

const { mkdirSync, writeFileSync } = require('fs');

const HASH_LENGTH = 8;

export async function observe(ctx: ReproContext): Promise<ReproContext> {
  console.log('   📡 Observing execution...');

  try {
    const hash = ctx.bug.replace(/[^a-z0-9]/gi, '').substring(0, HASH_LENGTH);
    const reportDir = `${ctx.flowDir}/${hash}`;
    const logsDir = `${reportDir}/logs`;

    mkdirSync(logsDir, { recursive: true });

    const logs = await captureDeviceLogs(ctx.platform, ctx.deviceId);
    const logFile = `${logsDir}/device.log`;
    writeFileSync(logFile, logs);

    ctx.executionReport = {
      timestamp: new Date().toISOString(),
      logs: logFile,
      screenshots: ctx.executionResult?.screenshots || [],
      flowFile: ctx.flowFile || ''
    };
  } catch (err) {
    ctx.error = `Failed to observe execution: ${err}`;
  }

  return ctx;
}

async function captureDeviceLogs(platform: 'android' | 'ios', deviceId: string | null): Promise<string> {
  try {
    let proc: { stdout: ReadableStream<Uint8Array> | null; exited: Promise<number> };

    if (platform === 'android') {
      if (deviceId) {
        proc = Bun.spawn({ cmd: ['adb', '-s', deviceId, 'logcat', '-d'] });
      } else {
        proc = Bun.spawn({ cmd: ['adb', 'logcat', '-d'] });
      }
    } else {
      proc = Bun.spawn({ cmd: ['xcrun', 'simctl', 'diagnose'] });
    }

    const output = await new Response(proc.stdout).text();
    return output || '';
  } catch {
    return 'Failed to capture logs';
  }
}
