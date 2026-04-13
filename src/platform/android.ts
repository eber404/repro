import { spawn } from 'child_process';
import type { Device } from '@/context';

const ADB_TIMEOUT_MS = 30_000;

export async function listAndroidDevices(): Promise<Device[]> {
  return new Promise((resolve) => {
    const proc = spawn('adb', ['devices'], { timeout: ADB_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => {
      const devices: Device[] = output
        .split('\n')
        .slice(1)
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split('\t');
          const id = parts[0];
          const status = parts[1]?.trim() || 'unknown';
          return { id, name: id, status };
        })
        .filter(d => d.status === 'device');
      resolve(devices);
    });
    proc.on('error', () => resolve([]));
  });
}

export async function getAndroidDevices(): Promise<string[]> {
  const devices = await listAndroidDevices();
  return devices.map(d => d.id);
}

export async function clearAndroidAppData(packageName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('adb', ['shell', 'pm', 'clear', packageName], { timeout: ADB_TIMEOUT_MS });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to clear data: exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function captureAndroidLogs(): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('adb', ['logcat', '-d'], { timeout: ADB_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => resolve(output));
    proc.on('error', () => resolve(''));
  });
}
