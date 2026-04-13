import { expect, test } from 'bun:test';
import { compile, resolveFlowRunDir } from '@/stages/compiler';
import { readFileSync } from 'fs';
import type { ReproContext } from '@/context';

function createContext(flowDir: string): ReproContext {
  return {
    bug: 'layout test',
    appId: 'com.example.app',
    deviceId: 'SIM-123',
    platform: 'ios',
    maxRetries: 2,
    flowDir,
    resetStrategy: 'clear-app-data',
    resetDeepLink: 'app://dev/reset-state',
    maestroPath: '/tmp/maestro',
    uiTree: null,
    plan: { steps: [{ action: 'tap', element: 'Entrar' }] },
    flowFile: null,
    executionResult: null,
    executionReport: null,
    reproduced: null,
    refinement: null,
    error: null,
    attempt: 1
  };
}

test('compile keeps attempts as sibling directories', async () => {
  const rootDir = `${process.cwd()}/tmp/test-layout-${Date.now()}`;
  const ctx = createContext(rootDir);

  const first = await compile(ctx);
  expect(first.flowFile).toContain('/attempt-1/flow.yaml');
  const runDir = first.flowDir;

  ctx.attempt = 2;
  const second = await compile(ctx);

  expect(second.flowFile).toContain('/attempt-2/flow.yaml');
  expect(second.flowDir).toBe(runDir);
  expect(second.flowFile).toContain(runDir);
});

test('resolveFlowRunDir keeps existing run directory from flow file', () => {
  const rootDir = `${process.cwd()}/flows/2026-04-13_20-00-00`;
  const flowFile = `${rootDir}/attempt-3/flow.yaml`;
  expect(resolveFlowRunDir('/unused/base', flowFile)).toBe(rootDir);
});

test('compile clears app state and keychain on launch', async () => {
  const rootDir = `${process.cwd()}/tmp/test-layout-${Date.now()}-no-clear`;
  const compiled = await compile(createContext(rootDir));
  const content = readFileSync(compiled.flowFile as string, 'utf-8');

  expect(content.includes('clearState: true')).toBe(true);
  expect(content.includes('clearKeychain: true')).toBe(true);
});
