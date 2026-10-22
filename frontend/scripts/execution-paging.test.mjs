import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/executions/executionPaging.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { nextExecutionPage } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
const terminal = status => ['SUCCESS', 'FAILED', 'PARTIAL', 'CANCELLED', 'SKIPPED'].includes(status);
const runs = statuses => statuses.map(status => ({ status }));

test('waits until the entire displayed group finishes', () => {
  assert.equal(nextExecutionPage(runs(['SUCCESS', 'RUNNING', 'SUCCESS', 'RUNNING']), 0, terminal), 0);
  assert.equal(nextExecutionPage(runs(['SUCCESS', 'SUCCESS', 'SUCCESS', 'RUNNING']), 0, terminal), 1);
});
test('advances past completed failed/skipped groups to the next unfinished group', () => {
  assert.equal(nextExecutionPage(runs(['FAILED', 'SKIPPED', 'CANCELLED', 'SUCCESS', 'SUCCESS', 'SUCCESS', 'PENDING']), 0, terminal), 2);
});
test('handles partial last pages, completion and empty executions without invalid indexes', () => {
  assert.equal(nextExecutionPage(runs(Array(8).fill('SUCCESS')), 0, terminal), 2);
  assert.equal(nextExecutionPage([], 0, terminal), 0);
  assert.equal(nextExecutionPage(runs(['RUNNING']), 5, terminal), 0);
  assert.equal(nextExecutionPage(runs(['WAITING_APPROVAL', 'PENDING', 'RUNNING', 'PENDING']), 0, terminal), 0);
});
