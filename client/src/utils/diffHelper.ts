export interface DiffLine {
  type: 'add' | 'del' | 'same';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

/**
 * Computes a standard unified line-by-line diff between two text strings
 */
export function computeUnifiedDiff(original: string = '', modified: string = ''): DiffLine[] {
  const origLines = original ? original.split('\n') : [];
  const modLines = modified ? modified.split('\n') : [];

  // Simple and robust LCS-based diff for clear mobile visualization
  const m = origLines.length;
  const n = modLines.length;

  // For very large files, limit max lines to prevent UI lag on mobile
  if (m > 2000 || n > 2000) {
    // Quick diff fallback
    const result: DiffLine[] = [];
    origLines.slice(0, 300).forEach((line, i) => {
      result.push({ type: 'del', oldLineNumber: i + 1, content: line });
    });
    modLines.slice(0, 300).forEach((line, i) => {
      result.push({ type: 'add', newLineNumber: i + 1, content: line });
    });
    return result;
  }

  // Dynamic programming LCS table
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

  // Backtrack to find diff
  let i = m;
  let j = n;
  const rawDiff: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      rawDiff.push({
        type: 'same',
        oldLineNumber: i,
        newLineNumber: j,
        content: origLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.push({
        type: 'add',
        newLineNumber: j,
        content: modLines[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.push({
        type: 'del',
        oldLineNumber: i,
        content: origLines[i - 1],
      });
      i--;
    }
  }

  return rawDiff.reverse();
}
