import { expect, test } from 'bun:test';
import { buildScreenshotPath, parseHierarchyOutput } from '@/stages/gatherContext';

test('parseHierarchyOutput extracts first JSON object from mixed output', () => {
  const output = 'maestro logs\n{ "root": { "text": "Home" } }\ntrailing';
  expect(parseHierarchyOutput(output)).toEqual({ root: { text: 'Home' } });
});

test('buildScreenshotPath stores screenshot inside attempt directory', () => {
  const pathValue = buildScreenshotPath('/tmp/flows/2026-04-13_10-00-00', 2);
  expect(pathValue).toBe('/tmp/flows/2026-04-13_10-00-00/attempt-2/visible-screen.png');
});
