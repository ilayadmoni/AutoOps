import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/executions/machineTree.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { machineTree, searchMachineTree, toggleMachineIds } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
const folders = [
  { id: 1, name: 'Production', path: 'Production', parentId: null },
  { id: 2, name: 'Web', path: 'Production/Web', parentId: 1 },
  { id: 3, name: 'Empty', path: 'Empty', parentId: null },
];
const machines = [
  { id: 10, name: 'api', hostname: '10.0.0.1', folderId: 1 },
  { id: 11, name: 'nginx', hostname: '10.0.0.2', folderId: 2 },
  { id: 12, name: 'unfiled', hostname: '10.0.0.3', folderId: null },
];

test('folder selection includes nested members without duplicating unfiled machines', () => {
  const tree = machineTree(machines, folders);
  assert.deepEqual(tree.find(n => n.id === 1).ids, [10, 11]);
  assert.deepEqual(tree.find(n => n.id === null).ids, [12]);
  assert.deepEqual(tree.find(n => n.id === 3).ids, []);
});
test('search reveals ancestors and preserves the full folder selection scope', () => {
  const result = searchMachineTree(machineTree(machines, folders), 'nginx');
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].machines, []);
  assert.deepEqual(result[0].children[0].machines.map(m => m.id), [11]);
  assert.deepEqual(result[0].ids, [10, 11]);
  assert.deepEqual(searchMachineTree(machineTree(machines, folders), 'Production')[0].ids, [10, 11]);
});
test('folder deselection preserves unrelated targets and selection is idempotent', () => {
  assert.deepEqual(toggleMachineIds([10, 12], [10, 11], true), [10, 12, 11]);
  assert.deepEqual(toggleMachineIds([10, 11, 12], [10, 11], false), [12]);
  assert.deepEqual(toggleMachineIds([10, 11], [10, 11], true), [10, 11]);
});
