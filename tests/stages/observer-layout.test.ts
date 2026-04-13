import { expect, test } from 'bun:test';
import { resolveLogsDir } from '@/stages/observer';

test('resolveLogsDir stores logs beside attempt flow file', () => {
  const flowFile = '/repo/flows/2026-04-13_17-21-01/attempt-3/flow.yaml';
  expect(resolveLogsDir(flowFile, '/repo/flows/2026-04-13_17-21-01', 3)).toBe('/repo/flows/2026-04-13_17-21-01/attempt-3/logs');
});
