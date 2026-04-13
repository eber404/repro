import { expect, test } from 'bun:test';
import { buildEvaluatorPrompt } from '@/stages/evaluator';
import type { ReproContext } from '@/context';

test('evaluator prompt includes execution report content', () => {
  const ctx: ReproContext = {
    bug: 'fails when saving profile',
    appId: 'com.example.app',
    deviceId: 'device-1',
    platform: 'ios',
    maxRetries: 1,
    flowDir: './flows',
    resetStrategy: 'clear-app-data',
    resetDeepLink: 'app://dev/reset-state',
    maestroPath: '/tmp/maestro',
    uiTree: null,
    plan: null,
    flowFile: './flows/attempt-1/flow.yaml',
    executionResult: { success: false, output: 'step failed', screenshots: ['one.png'] },
    executionReport: {
      timestamp: '2026-04-13T00:00:00.000Z',
      logFile: './flows/logs/device.log',
      logExcerpt: 'FATAL EXCEPTION',
      anomalies: ['possible-crash'],
      screenshots: ['one.png'],
      flowFile: './flows/attempt-1/flow.yaml'
    },
    reproduced: null,
    refinement: null,
    error: null,
    attempt: 1
  };

  const prompt = buildEvaluatorPrompt(ctx);
  expect(prompt).toContain('Execution report log excerpt');
  expect(prompt).toContain('FATAL EXCEPTION');
  expect(prompt).toContain('possible-crash');
});
