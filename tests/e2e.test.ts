import { expect, test } from 'bun:test';
import { NON_RETRYABLE_STAGE_FAILURES, PIPELINE_STAGES, runPipeline } from '@/pipeline';
import type { ReproContext } from '@/context';

function createContext(): ReproContext {
  return {
    bug: 'test bug',
    enhancedBugDescription: 'test bug',
    appId: 'com.example.app',
    deviceId: null,
    platform: 'android',
    maxRetries: 3,
    flowDir: './test-flows',
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

test('pipeline includes new stage order for visual login bootstrap flow', () => {
  const names = PIPELINE_STAGES.map((stage) => stage.name);
  expect(names).toEqual([
    'enhanceBugDescription',
    'verifyAppLaunch',
    'gatherContext',
    'analyzeScreenWithAi',
    'executeLoginBootstrap',
    'plan',
    'compile',
    'resetState',
    'execute',
    'observe',
    'evaluate',
    'refine'
  ]);
});

test('pipeline stops early when preflight fails as non-retryable', async () => {
  const result = await runPipeline(createContext());
  expect(result.error).toContain('Preflight requires deviceId');
  expect(NON_RETRYABLE_STAGE_FAILURES.has('verifyAppLaunch')).toBe(true);
});
