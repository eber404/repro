import { expect, mock, test } from 'bun:test';
import type { ReproContext } from '@/context';

const spawnAgentMock = mock(async () => 'improved bug description');

mock.module('@/agents/cli', () => ({
  spawnAgent: spawnAgentMock
}));

import { enhanceBugDescription } from '@/stages/enhanceBugDescription';

function createContext(): ReproContext {
  return {
    bug: 'app crashes after login',
    appId: 'com.example.app',
    deviceId: 'SIM-1',
    platform: 'ios',
    maxRetries: 1,
    flowDir: './flows',
    resetStrategy: 'clear-app-data',
    resetDeepLink: 'app://dev/reset-state',
    maestroPath: '/tmp/maestro',
    uiTree: null,
    plan: null,
    flowFile: null,
    executionResult: null,
    executionReport: null,
    reproduced: null,
    refinement: null,
    error: null,
    attempt: 1
  };
}

test('enhanceBugDescription sets enhancedBugDescription and preserves original', async () => {
  const ctx = createContext();
  const result = await enhanceBugDescription(ctx);

  expect(result.bug).toBe('app crashes after login');
  expect(result.enhancedBugDescription).toBe('improved bug description');
});

test('enhanceBugDescription sets ctx.error on agent failure', async () => {
  const ctx = createContext();
  spawnAgentMock.mockRejectedValueOnce(new Error('agent unavailable'));

  const result = await enhanceBugDescription(ctx);
  expect(result.error).toContain('enhanceBugDescription failed');
});
