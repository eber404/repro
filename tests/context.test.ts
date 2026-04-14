import { expect, test } from 'bun:test';
import type { ReproContext } from '@/context';

test('context supports enhanced bug and visual analysis fields', () => {
  const ctx: ReproContext = {
    bug: 'bug',
    enhancedBugDescription: 'improved bug',
    appId: 'com.example.app',
    deviceId: 'SIM-1',
    platform: 'ios',
    maxRetries: 1,
    flowDir: './flows',
    resetStrategy: 'clear-app-data',
    resetDeepLink: 'app://dev/reset-state',
    maestroPath: '/tmp/maestro',
    uiTree: { root: true },
    visibleScreenshotPath: './flows/a.png',
    screenAnalysis: 'screen summary',
    loginBootstrapYaml: 'appId: com.example.app',
    plan: null,
    flowFile: null,
    executionResult: null,
    executionReport: null,
    reproduced: null,
    refinement: null,
    error: null,
    attempt: 1
  };

  expect(ctx.enhancedBugDescription).toBe('improved bug');
  expect(ctx.visibleScreenshotPath).toContain('.png');
  expect(ctx.loginBootstrapYaml).toContain('appId');
});
