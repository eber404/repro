import { ReproContext } from '@/context';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const HASH_LENGTH = 8;
const LOG_CAPTURE_TIMEOUT_MS = 30_000;

export async function observe(ctx: ReproContext): Promise<ReproContext> {
  console.log('   📡 Observing execution...');

  try {
    const hash = ctx.bug.replace(/[^a-z0-9]/gi, '').substring(0, HASH_LENGTH);
    const reportDir = join(ctx.flowDir, hash);
    const logsDir = join(reportDir, 'logs');

    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    const logs = await captureDeviceLogs(ctx.platform);
    const logFile = join(logsDir, 'device.log');
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

async function captureDeviceLogs(platform: 'android' | 'ios'): Promise<string> {
  const cmd = platform === 'android'
    ? 'adb logcat -d'
    : 'xcrun simctl diagnose';

  return new Promise((resolve) => {
    const proc = spawn(cmd, [], { shell: true, timeout: LOG_CAPTURE_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => resolve(output));
    proc.on('error', () => resolve('Failed to capture logs'));
  });
}
