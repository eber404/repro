import { expect, test } from 'bun:test';
import { normalizeSelector } from '@/stages/compiler';

test('normalizeSelector keeps first option when planner returns alternates', () => {
  expect(normalizeSelector('Perfil|Profile')).toBe('Perfil');
});

test('normalizeSelector trims whitespace around alternates', () => {
  expect(normalizeSelector('  Sair  | Logout  ')).toBe('Sair');
});
