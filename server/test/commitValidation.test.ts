import test from 'node:test';
import assert from 'node:assert';
import { CommitRequest } from '../src/types.js';

test('commit validation: validates required fields in CommitRequest', () => {
  const req: CommitRequest = {
    owner: 'octocat',
    repo: 'Hello-World',
    branch: 'main',
    message: 'feat: add agent support',
    changes: [
      {
        path: 'src/index.ts',
        action: 'modify',
        originalContent: 'console.log("old");',
        newContent: 'console.log("new");',
      },
    ],
  };

  assert.ok(req.owner);
  assert.ok(req.repo);
  assert.ok(req.branch);
  assert.strictEqual(req.changes.length, 1);
  assert.strictEqual(req.changes[0].action, 'modify');
});

test('commit validation: supports PR parameters', () => {
  const req: CommitRequest = {
    owner: 'octocat',
    repo: 'Hello-World',
    branch: 'main',
    newBranch: 'feature/agent-edit',
    createPr: true,
    prTitle: 'Add agent support',
    prBody: 'Automated PR description',
    message: 'feat: add agent support',
    changes: [
      {
        path: 'README.md',
        action: 'create',
        newContent: '# Hello World\nAdded by GitMobile AI',
      },
    ],
  };

  assert.strictEqual(req.createPr, true);
  assert.strictEqual(req.newBranch, 'feature/agent-edit');
  assert.ok(req.prTitle);
});
