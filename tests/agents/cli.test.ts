import { expect, test } from 'bun:test';
import { spawnAgent } from '@/agents/cli';

test('spawnAgent returns output from echo', async () => {
  const result = await spawnAgent('hello world', 'claude');
  expect(result).toContain('hello');
});
