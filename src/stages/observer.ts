import { ReproContext } from '@/context';

const { mkdirSync, writeFileSync } = require('fs');
const { dirname } = require('path');

const LOG_EXCERPT_MAX_LENGTH = 4_000;

export async function observe(ctx: ReproContext): Promise<ReproContext> {
  console.log('   📡 Observing execution...');

  try {
    const logsDir = resolveLogsDir(ctx.flowFile, ctx.flowDir, ctx.attempt);

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

export function resolveLogsDir(flowFile: string | null, flowRunDir: string, attempt: number): string {
  if (flowFile) {
    return `${dirname(flowFile)}/logs`;
  }

  return `${flowRunDir}/attempt-${attempt}/logs`;
}

async function captureDeviceLogs(platform: 'android' | 'ios', deviceId: string | null): Promise<string> {
  try {
    const command = buildLogCaptureCommand(platform, deviceId);
    const proc = Bun.spawn({ cmd: command });

    const output = await new Response(proc.stdout).text();
    return output || '';
  } catch {
    return 'Failed to capture logs';
  }
}

export function buildLogCaptureCommand(platform: 'android' | 'ios', deviceId: string | null): string[] {
  if (platform === 'ios' && !deviceId) {
    return ['xcrun', 'simctl', 'list', 'devices'];
  }

  if (platform === 'ios') {
    return ['xcrun', 'simctl', 'spawn', deviceId as string, 'log', 'show', '--style', 'compact', '--last', '5m'];
  }

  if (!deviceId) {
    return ['adb', 'logcat', '-d'];
  }

  return ['adb', '-s', deviceId, 'logcat', '-d'];
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
