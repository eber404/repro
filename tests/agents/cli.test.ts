import { expect, test } from 'bun:test';
import { spawnAgent } from '@/agents/cli';

test('spawnAgent returns output from opencode echo-like behavior', async () => {
  const result = await spawnAgent('hello world', 'opencode', 10_000);
  expect(typeof result).toBe('string');
});
