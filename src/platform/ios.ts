import { spawn } from 'child_process';
import type { Device } from '@/context';

const SIMCTL_TIMEOUT_MS = 30_000;

export async function listIOSSimulators(): Promise<Device[]> {
  return new Promise((resolve) => {
    const proc = spawn('xcrun', ['simctl', 'list', 'devices', 'available'], { timeout: SIMCTL_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => {
      const devices: Device[] = [];
      const lines = output.split('\n');

      for (const line of lines) {
        if (!line.includes('iPhone') && !line.includes('iPad')) continue;

        const name = line.split('(')[0].trim();
        const idMatch = line.match(/--device\s+([A-F0-9-]+)/i);
        const id = idMatch?.[1] || name;

        if (name) devices.push({ id, name });
      }

      resolve(devices);
    });
    proc.on('error', () => resolve([]));
  });
}

export async function getIOSSimulators(): Promise<string[]> {
  const devices = await listIOSSimulators();
  return devices.map(d => d.id);
}

export async function resetIOSSimulator(deviceId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('xcrun', ['simctl', 'erase', deviceId], { timeout: SIMCTL_TIMEOUT_MS });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to erase simulator: exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function captureIOSLogs(_deviceId: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('xcrun', ['simctl', 'diagnose'], { timeout: SIMCTL_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => resolve(output));
    proc.on('error', () => resolve(''));
  });
}
