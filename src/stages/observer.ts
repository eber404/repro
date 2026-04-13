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

    const logs = await captureDeviceLogs(ctx.platform, ctx.deviceId);
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

async function captureDeviceLogs(platform: 'android' | 'ios', deviceId: string | null): Promise<string> {
  return new Promise((resolve) => {
    let cmd: string;
    let args: string[];

    if (platform === 'android') {
      cmd = 'adb';
      args = deviceId ? ['-s', deviceId, 'logcat', '-d'] : ['logcat', '-d'];
    } else {
      cmd = 'xcrun';
      args = ['simctl', 'diagnose', deviceId || ''];
    }

    const proc = spawn(cmd, args, { timeout: LOG_CAPTURE_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => resolve(output));
    proc.on('error', () => resolve('Failed to capture logs'));
  });
}
