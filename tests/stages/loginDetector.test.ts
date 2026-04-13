import { expect, test } from 'bun:test';
import { detectLoginFields } from '@/stages/loginDetector';
import type { ReproContext } from '@/context';

function createContext(): ReproContext {
  return {
    bug: 'login bug',
    appId: 'com.example.app',
    deviceId: 'SIM-123',
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

test('detectLoginFields skips login detection without credentials', async () => {
  const ctx = createContext();
  const result = await detectLoginFields(ctx);
  expect(result.loginFlow).toBeUndefined();
  expect(result.error).toBeNull();
});

test('detectLoginFields detects fields from uiTree when credentials exist', async () => {
  const ctx = createContext();
  ctx.credentials = { email: 'qa@example.com', password: 'secret' };
  ctx.uiTree = {
    frame: {
      children: [
        { text: 'E-mail' },
        { text: 'Senha' },
        { text: 'Entrar' }
      ]
    }
  };

  const result = await detectLoginFields(ctx);
  expect(result.loginFlow).toEqual({
    emailField: 'E-mail',
    passwordField: 'Senha',
    loginButton: 'Entrar'
  });
});
