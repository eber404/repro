import { expect, test } from 'bun:test';
import { buildLogCaptureCommand } from '@/stages/observer';

test('buildLogCaptureCommand uses non-interactive iOS log collection', () => {
  expect(buildLogCaptureCommand('ios', 'SIM-123')).toEqual([
    'xcrun',
    'simctl',
    'spawn',
    'SIM-123',
    'log',
    'show',
    '--style',
    'compact',
    '--last',
    '5m'
  ]);
});
