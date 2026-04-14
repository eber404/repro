import { expect, mock, test } from 'bun:test';
import type { ReproContext } from '@/context';

const spawnAgentMock = mock(async () => JSON.stringify({
  screenAnalysis: 'login screen with email and password fields'
}));

mock.module('@/agents/cli', () => ({
  spawnAgent: spawnAgentMock
}));

import { analyzeScreenWithAi } from '@/stages/screenAnalyzer';

function createContext(): ReproContext {
  return {
    bug: 'fails after login',
    enhancedBugDescription: 'app crashes after tapping profile post-login',
    appId: 'com.example.app',
    deviceId: 'SIM-1',
    platform: 'ios',
    maxRetries: 2,
    flowDir: './flows',
    resetStrategy: 'clear-app-data',
    resetDeepLink: 'app://dev/reset-state',
    maestroPath: '/tmp/maestro',
    uiTree: { root: { text: 'Login' } },
    visibleScreenshotPath: './flows/run/attempt-1/visible-screen.png',
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

test('analyzeScreenWithAi always sets screenAnalysis', async () => {
  const ctx = createContext();
  const result = await analyzeScreenWithAi(ctx);
  expect(result.screenAnalysis).toBe('login screen with email and password fields');
  expect(result.error).toBeNull();
});

test('analyzeScreenWithAi requires login yaml when credentials exist', async () => {
  const ctx = createContext();
  ctx.credentials = { email: 'qa@example.com', password: 'secret' };

  const result = await analyzeScreenWithAi(ctx);
  expect(result.error).toContain('missing loginBootstrapYaml');
});

test('analyzeScreenWithAi stores login yaml when credentials exist', async () => {
  spawnAgentMock.mockResolvedValueOnce(JSON.stringify({
    screenAnalysis: 'login form available',
    loginBootstrapYaml: 'appId: com.example.app\n---\n- tapOn: "Entrar"'
  }));

  const ctx = createContext();
  ctx.credentials = { email: 'qa@example.com', password: 'secret' };

  const result = await analyzeScreenWithAi(ctx);
  expect(result.loginBootstrapYaml).toContain('tapOn');
  expect(result.error).toBeNull();
});
