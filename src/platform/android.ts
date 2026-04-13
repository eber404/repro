import { spawn } from 'child_process';

const ADB_TIMEOUT_MS = 30_000;

export async function getAndroidDevices(): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn('adb', ['devices'], { timeout: ADB_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => {
      const devices = output
        .split('\n')
        .slice(1)
        .map(line => line.split('\t')[0])
        .filter(Boolean);
      resolve(devices);
    });
    proc.on('error', () => resolve([]));
  });
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
