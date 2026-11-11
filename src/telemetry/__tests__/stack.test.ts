import { describe, expect, it } from 'vitest';
import { parseStack } from '../stack';

describe('parseStack', () => {
  it('returns nothing for a missing stack', () => {
    expect(parseStack(undefined)).toEqual([]);
    expect(parseStack('')).toEqual([]);
  });

  it('reads named and anonymous V8 frames and drops the URL path', () => {
    const stack = [
      'TypeError: x is not a function',
      '    at submitGuess (https://localhost/assets/index-DCrWD4vX.js:1:20455)',
      '    at https://localhost/assets/LevelGameView-CAyFugOu.js:1:812',
      '    at async Promise.all (index 0)',
    ].join('\n');
    expect(parseStack(stack)).toEqual([
      { functionName: 'submitGuess', fileName: 'index-DCrWD4vX.js', lineNumber: 20455 },
      { functionName: '(anonymous)', fileName: 'LevelGameView-CAyFugOu.js', lineNumber: 812 },
    ]);
  });

  it('keeps the real line number when the file is not minified onto line 1', () => {
    const frames = parseStack(
      'Error: boom\n    at run (http://localhost:8080/src/ui/App.tsx:42:7)',
    );
    expect(frames).toEqual([{ functionName: 'run', fileName: 'App.tsx', lineNumber: 42 }]);
  });

  it('caps the number of frames', () => {
    const lines = ['Error: deep'];
    for (let i = 0; i < 80; i++) lines.push(`    at f${i} (https://localhost/a.js:1:${i + 1})`);
    expect(parseStack(lines.join('\n'))).toHaveLength(30);
  });
});
