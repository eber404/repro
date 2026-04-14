import { expect, test } from 'bun:test';
import { buildPlannerPrompt } from '@/stages/planner';
import type { ReproContext } from '@/context';

function createContext(): ReproContext {
  return {
    bug: 'app crashes after login',
    enhancedBugDescription: 'app crashes after login after tapping profile quickly',
    appId: 'com.example.app',
    deviceId: 'device-1',
    platform: 'android',
    maxRetries: 3,
    flowDir: './flows',
    resetStrategy: 'clear-app-data',
    resetDeepLink: 'app://dev/reset-state',
    maestroPath: '/tmp/maestro',
    uiTree: { root: { id: 'screen' } },
    screenAnalysis: 'visible screen is dashboard with profile tab',
    plan: null,
    flowFile: null,
    executionResult: { success: false, output: 'timeout', screenshots: [] },
    executionReport: null,
    reproduced: false,
    refinement: { hypothesis: 'maybe race', steps: [{ action: 'tap', element: 'Login' }] },
    error: null,
    attempt: 2,
    credentials: { email: 'dev@example.com', password: 'secret' }
  };
}

test('planner prompt includes failed attempt context', () => {
  const prompt = buildPlannerPrompt(createContext());
  expect(prompt).toContain('PREVIOUS FAILED ATTEMPT CONTEXT');
  expect(prompt).toContain('latestExecutionSummary: timeout');
});

test('planner prompt prioritizes enhanced bug description and visual analysis', () => {
  const prompt = buildPlannerPrompt(createContext());
  expect(prompt).toContain('Bug: "app crashes after login after tapping profile quickly"');
  expect(prompt).toContain('SCREEN ANALYSIS: visible screen is dashboard with profile tab');
});

test('planner prompt documents optional network controls', () => {
  const prompt = buildPlannerPrompt(createContext());
  expect(prompt).toContain('"network"');
  expect(prompt).toContain('forceHttpStatus');
});
