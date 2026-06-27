import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('sizes the React Flow edge SVG layer inside Starlight layouts', () => {
  const css = readProjectFile('src/styles/global.css');

  assert.match(css, /\.react-flow \.react-flow__edges\s*{/);
  assert.match(css, /\.react-flow \.react-flow__edges svg\s*{/);
  assert.match(css, /inset:\s*0\s*!important;/);
  assert.match(css, /width:\s*100%\s*!important;/);
  assert.match(css, /height:\s*100%\s*!important;/);
});

test('renders the chat assistant floating UI through a body portal', () => {
  const source = readProjectFile('src/components/ChatAssistant.tsx');

  assert.match(source, /import\s*{\s*createPortal\s*}\s*from\s*'react-dom';/);
  assert.match(source, /createPortal\(/);
  assert.doesNotMatch(source, /AssistantModalPrimitive/);
});
