import { expect, test } from 'bun:test';
import { runPipeline } from '@/pipeline';

test('pipeline runs without crashing', async () => {
  const ctx = {
    bug: 'test bug',
    appPath: '/fake/path.app',
    platform: 'android' as const,
    maxRetries: 1,
    flowDir: './test-flows',
    resetStrategy: 'clear-app-data' as const,
    uiTree: null,
    plan: null,
    flowFile: null,
    executionResult: null,
    executionReport: null,
    reproduced: null,
    refinement: null,
    error: null,
    attempt: 1,
    maestroPath: '/fake/maestro'
  };

  const result = await runPipeline(ctx);
  expect(result).toBeDefined();
  expect(result.attempt).toBe(1);
});