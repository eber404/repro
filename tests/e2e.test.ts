import { expect, test } from 'bun:test'
import { runPipeline } from '@/pipeline'

test.skip('pipeline runs without crashing', async () => {
  const ctx = {
    bug: 'test bug',
    appId: 'com.example.app',
    deviceId: null,
    platform: 'android' as const,
    maxRetries: 1,
    flowDir: './test-flows',
    resetStrategy: 'clear-app-data' as const,
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
    attempt: 1,
  }

  const result = await runPipeline(ctx)
  expect(result).toBeDefined()
  expect(result.attempt).toBe(1)
})
