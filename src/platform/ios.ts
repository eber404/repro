import { spawn } from 'child_process';

const SIMCTL_TIMEOUT_MS = 30_000;

export async function getIOSSimulators(): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn('xcrun', ['simctl', 'list', 'devices', 'available'], { timeout: SIMCTL_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => {
      const simulators = output
        .split('\n')
        .filter(line => line.includes('iPhone') || line.includes('iPad'))
        .map(line => line.split('(')[0].trim());
      resolve(simulators);
    });
    proc.on('error', () => resolve([]));
  });
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
