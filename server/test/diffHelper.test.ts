import test from 'node:test';
import assert from 'node:assert';

// Unified diff logic test
interface DiffLine {
  type: 'add' | 'del' | 'same';
  content: string;
}

function computeUnifiedDiff(original: string = '', modified: string = ''): DiffLine[] {
  const origLines = original ? original.split('\n') : [];
  const modLines = modified ? modified.split('\n') : [];

  const m = origLines.length;
  const n = modLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const rawDiff: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      rawDiff.push({ type: 'same', content: origLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.push({ type: 'add', content: modLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.push({ type: 'del', content: origLines[i - 1] });
      i--;
    }
  }

  return rawDiff.reverse();
}

test('diff: detects additions in newly created files', () => {
  const diff = computeUnifiedDiff('', 'console.log("hello");\nconsole.log("world");');
  assert.strictEqual(diff.length, 2);
  assert.strictEqual(diff[0].type, 'add');
  assert.strictEqual(diff[0].content, 'console.log("hello");');
  assert.strictEqual(diff[1].type, 'add');
});

test('diff: detects line replacements and modifications', () => {
  const orig = 'const a = 1;\nconst b = 2;';
  const mod = 'const a = 1;\nconst b = 42;\nconst c = 3;';
  const diff = computeUnifiedDiff(orig, mod);

  const same = diff.filter((d) => d.type === 'same');
  const add = diff.filter((d) => d.type === 'add');
  const del = diff.filter((d) => d.type === 'del');

  assert.strictEqual(same.length, 1);
  assert.strictEqual(same[0].content, 'const a = 1;');
  assert.strictEqual(del.length, 1);
  assert.strictEqual(del[0].content, 'const b = 2;');
  assert.strictEqual(add.length, 2);
});

test('diff: handles empty strings', () => {
  const diff = computeUnifiedDiff('', '');
  assert.strictEqual(diff.length, 0);
});
