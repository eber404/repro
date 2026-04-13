import type { Device } from '@/context';

export async function listAndroidDevices(): Promise<Device[]> {
  try {
    const proc = Bun.spawn({
      cmd: ['adb', 'devices']
    });
    const output = await new Response(proc.stdout).text();
    if (!output) return [];

    const devices: Device[] = output
      .split('\n')
      .slice(1)
      .filter((line: string) => line.trim())
      .map((line: string) => {
        const parts = line.split('\t');
        const id = parts[0];
        const status = parts[1]?.trim() || 'unknown';
        return { id, name: id, status };
      })
      .filter((d: Device) => d.status === 'device');
    return devices;
  } catch {
    return [];
  }
}

export async function getAndroidDevices(): Promise<string[]> {
  const devices = await listAndroidDevices();
  return devices.map(d => d.id);
}

export async function clearAndroidAppData(packageName: string): Promise<void> {
  const proc = Bun.spawn({
    cmd: ['adb', 'shell', 'pm', 'clear', packageName]
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Failed to clear data: exit code ${code}`);
  }
}

export async function captureAndroidLogs(): Promise<string> {
  try {
    const proc = Bun.spawn({
      cmd: ['adb', 'logcat', '-d']
    });
    const output = await new Response(proc.stdout).text();
    return output || '';
  } catch {
    return '';
  }
}
