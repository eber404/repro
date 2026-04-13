import { ReproContext } from '@/context';

const { mkdirSync, writeFileSync } = require('fs');

const HASH_LENGTH = 8;
const LOG_EXCERPT_MAX_LENGTH = 4_000;

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
    const logExcerpt = logs.slice(-LOG_EXCERPT_MAX_LENGTH);
    const anomalies = detectAnomalies(logs);

    ctx.executionReport = {
      timestamp: new Date().toISOString(),
      logFile,
      logExcerpt,
      anomalies,
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

function detectAnomalies(logs: string): string[] {
  const lowered = logs.toLowerCase();
  const anomalies: string[] = [];

  if (lowered.includes('fatal exception') || lowered.includes('fatal error')) {
    anomalies.push('possible-crash');
  }

  if (lowered.includes('anr')) {
    anomalies.push('possible-freeze');
  }

  if (lowered.includes('http 500') || lowered.includes('status=500')) {
    anomalies.push('http-500');
  }

  return anomalies;
}
