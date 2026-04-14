import { expect, test } from 'bun:test';
import { buildPreflightCommand, buildPreflightFlowYaml } from '@/stages/preflight';

test('buildPreflightFlowYaml launches app with clear state', () => {
  const yaml = buildPreflightFlowYaml('com.example.app', 'ios');
  expect(yaml).toContain('appId: com.example.app');
  expect(yaml).toContain('clearState: true');
  expect(yaml).toContain('clearKeychain: true');
});

test('buildPreflightCommand includes platform, device, and flow path', () => {
  expect(buildPreflightCommand('/tmp/maestro', 'android', 'emulator-5554', '/tmp/preflight.yaml')).toEqual([
    '/tmp/maestro',
    '--platform',
    'android',
    '--udid',
    'emulator-5554',
    'test',
    '/tmp/preflight.yaml',
    '--no-reinstall-driver'
  ]);
});
