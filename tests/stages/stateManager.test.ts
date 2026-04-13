import { expect, test } from 'bun:test';
import { buildDeepLinkCommand, extractPackageName } from '@/stages/stateManager';

test('extractPackageName keeps bundle identifier', () => {
  expect(extractPackageName('com.example.app')).toBe('com.example.app');
});

test('extractPackageName reads apk filename', () => {
  expect(extractPackageName('/tmp/my-app.apk')).toBe('my-app');
});

test('buildDeepLinkCommand for android', () => {
  expect(buildDeepLinkCommand('android', 'emulator-5554', 'app://dev/reset-state')).toEqual([
    'adb',
    '-s',
    'emulator-5554',
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    'app://dev/reset-state'
  ]);
});

test('buildDeepLinkCommand for ios', () => {
  expect(buildDeepLinkCommand('ios', 'SIM-ID', 'app://dev/reset-state')).toEqual([
    'xcrun',
    'simctl',
    'openurl',
    'SIM-ID',
    'app://dev/reset-state'
  ]);
});
