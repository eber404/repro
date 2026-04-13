import { expect, test } from 'bun:test';
import { buildIOSClearStateCommands } from '@/stages/stateManager';

test('buildIOSClearStateCommands only terminates app process', () => {
  expect(buildIOSClearStateCommands('SIM-123', 'com.example.app')).toEqual([
    ['xcrun', 'simctl', 'terminate', 'SIM-123', 'com.example.app']
  ]);
});
