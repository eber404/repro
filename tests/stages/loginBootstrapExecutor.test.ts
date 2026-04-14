import { expect, test } from 'bun:test';
import type { ReproContext } from '@/context';
import { executeLoginBootstrap, isValidMaestroFlowYaml } from '@/stages/loginBootstrapExecutor';

function createContext(): ReproContext {
  return {
    bug: 'bug',
    appId: 'com.example.app',
    deviceId: 'SIM-1',
    platform: 'ios',
    maxRetries: 1,
    flowDir: `${process.cwd()}/tmp/bootstrap-test`,
    resetStrategy: 'clear-app-data',
    resetDeepLink: 'app://dev/reset-state',
    maestroPath: '/tmp/maestro',
    uiTree: { root: true },
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

test('isValidMaestroFlowYaml validates basic structure', () => {
  expect(isValidMaestroFlowYaml('appId: com.example.app\n---\n- tapOn: "Entrar"')).toBe(true);
  expect(isValidMaestroFlowYaml('---\n- tapOn: "Entrar"')).toBe(false);
});

test('executeLoginBootstrap skips execution without credentials', async () => {
  const result = await executeLoginBootstrap(createContext(), async () => ({ code: 0, stdout: '', stderr: '' }));
  expect(result.error).toBeNull();
});

test('executeLoginBootstrap fails when credentials exist and yaml missing', async () => {
  const ctx = createContext();
  ctx.credentials = { email: 'qa@example.com', password: 'secret' };
  const result = await executeLoginBootstrap(ctx, async () => ({ code: 0, stdout: '', stderr: '' }));
  expect(result.error).toContain('requires loginBootstrapYaml');
});

test('executeLoginBootstrap runs bootstrap flow with credentials and yaml', async () => {
  const ctx = createContext();
  ctx.credentials = { email: 'qa@example.com', password: 'secret' };
  ctx.loginBootstrapYaml = 'appId: com.example.app\n---\n- tapOn: "Entrar"';

  const result = await executeLoginBootstrap(ctx, async () => ({ code: 0, stdout: 'ok', stderr: '' }));
  expect(result.error).toBeNull();
});
