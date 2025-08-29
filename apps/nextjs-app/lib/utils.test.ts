import test from 'node:test';
import assert from 'node:assert/strict';
import { getInitials } from './utils';

test('two-word names return first and last initials', () => {
  assert.equal(getInitials('John Doe'), 'JD');
});

test('single-word names return the first letter', () => {
  assert.equal(getInitials('Plato'), 'P');
});

test('empty or whitespace-only strings return "?"', () => {
  assert.equal(getInitials(''), '?');
  assert.equal(getInitials('   '), '?');
});
