import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/components/FormbricksSurvey.tsx', import.meta.url),
  'utf8',
);

test('renders feedback survey through a body portal', () => {
  assert.match(source, /import\s*{\s*createPortal\s*}\s*from\s*'react-dom';/);
  assert.match(source, /createPortal\(/);
});

test('uses native clickable controls for feedback survey', () => {
  assert.doesNotMatch(source, /@formbricks\/react/);
  assert.match(source, /type="button"/);
  assert.match(source, /type="submit"/);
  assert.match(source, /Submit Feedback/);
});
