import { expect, test } from 'bun:test';
import { buildArgs } from '@/agents/cli';

test('buildArgs uses claude format with files', () => {
  const args = buildArgs('claude', 'hello world', ['one.txt', 'two.txt']);
  expect(args).toEqual(['--print', '--file', 'one.txt', '--file', 'two.txt', 'hello world']);
});

test('buildArgs uses gemini prompt flag', () => {
  const args = buildArgs('gemini', 'hello world');
  expect(args).toEqual(['--prompt', 'hello world']);
});
