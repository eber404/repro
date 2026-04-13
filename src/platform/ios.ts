import type { Device } from '@/context';

export async function listIOSSimulators(): Promise<Device[]> {
  try {
    const proc = Bun.spawn({
      cmd: ['xcrun', 'simctl', 'list', 'devices', 'available']
    });
    const output = await new Response(proc.stdout).text();
    if (!output) return [];

    const devices: Device[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.includes('Booted')) continue;

      const nameMatch = line.match(/([^\(]+)\s+\(/);
      const idMatch = line.match(/([A-F0-9-]{36})/);

      if (nameMatch && idMatch) {
        const name = nameMatch[1].trim();
        const id = idMatch[1];
        devices.push({ id, name });
      }
    }

    return devices;
  } catch {
    return [];
  }
}

export async function getIOSSimulators(): Promise<string[]> {
  const devices = await listIOSSimulators();
  return devices.map(d => d.id);
}

export async function resetIOSSimulator(deviceId: string): Promise<void> {
  const proc = Bun.spawn({
    cmd: ['xcrun', 'simctl', 'erase', deviceId]
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Failed to erase simulator: exit code ${code}`);
  }
}

export async function captureIOSLogs(_deviceId: string): Promise<string> {
  try {
    const proc = Bun.spawn({
      cmd: ['xcrun', 'simctl', 'diagnose']
    });
    const output = await new Response(proc.stdout).text();
    return output || '';
  } catch {
    return '';
  }
}
