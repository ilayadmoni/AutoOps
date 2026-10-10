import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Run Vite on port 5178, or set UI_TEST_URL. Every API call, including the assistant, is mocked.
const URL_ = process.env.UI_TEST_URL || 'http://localhost:5178';
const server = { id: 8, name: 'Production API', hostname: 'api.example', sshPort: 22, trustStatus: 'TRUSTED' };
const command = { id: 4, name: 'Restart service', status: 'APPROVED', category: 'Services', parameters: [] };
const step = (key, name, next = null) => ({ key, type: 'COMMAND', name, commandDefinitionId: 4, parameters: { service: 'nginx' }, successNext: next, failureNext: null, timeoutSeconds: 300 });
const draftOp = (name, nodes, missingFields = []) => ({ type: 'REPLACE_WORKFLOW_DRAFT', payload: { name, description: '', nodes }, missingFields });
const reply = (message, operations = [], conversationId = 1) => ({ conversationId, messageId: 9, message, operations, missingFields: [] });

/** A mocked backend whose chat answers come from a queue of handlers, so each test scripts its own conversation. */
async function start({ viewport, lang } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: viewport ?? { width: 1440, height: 1000 } });
  const ctx = { browser, page, chats: [], saves: [], runs: [], validate: () => ({ valid: true, errors: [] }), save: null, errors: [], queue: [] };
  page.on('pageerror', (error) => ctx.errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/ai/chat') {
      ctx.chats.push(request.postDataJSON());
      const next = ctx.queue.shift();
      return route.fulfill(await next());
    }
    if (path === '/api/workflows/validate') return route.fulfill({ json: ctx.validate(request.postDataJSON()) });
    if (path === '/api/workflows' && request.method() === 'POST') {
      ctx.saves.push({ method: 'POST', body: request.postDataJSON() });
      return route.fulfill(ctx.save?.() ?? { json: { id: 5, version: 1, name: 'x', status: 'ACTIVE', nodes: [] } });
    }
    if (/^\/api\/workflows\/5$/.test(path) && request.method() === 'PUT') {
      ctx.saves.push({ method: 'PUT', body: request.postDataJSON() });
      return route.fulfill(ctx.save?.() ?? { json: { id: 5, version: 2, name: 'x', status: 'ACTIVE', nodes: [] } });
    }
    if (path === '/api/workflows/5/run') { ctx.runs.push(request.postDataJSON()); return route.fulfill({ status: 400, json: { code: 'X', message: 'stop here' } }); }
    const body = path.endsWith('/auth/refresh') ? { accessToken: 'test' }
      : path.endsWith('/auth/me') ? { id: 1, username: 'operator', role: 'USER' }
      : path === '/api/ai/status' ? { configured: true }
      : path === '/api/machines' ? [server] : path === '/api/commands' ? [command]
      : path === '/api/ai/conversations' ? [{ id: 1, title: 'Deploy flow' }, { id: 2, title: 'Other chat' }]
      : path === '/api/ai/conversations/1' ? { id: 1, messages: [{ role: 'user', content: 'Build a workflow' }, { role: 'assistant', content: 'Draft ready', operations: [draftOp('Deploy', [step('s1', 'Restart nginx')])] }] }
      : path === '/api/ai/conversations/2' ? { id: 2, messages: [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi' }] } : [];
    await route.fulfill({ json: body });
  });
  if (lang) await page.addInitScript((value) => { localStorage.setItem('autoops.lang', value); localStorage.setItem('autoops.ai.historyOpen', '0'); }, lang);
  await page.goto(URL_);
  return Object.assign(ctx, { input: page.locator('.composer .mentionEditor'), workspace: page.getByRole('region', { name: /Workflow draft|טיוטת/ }) });
}
const send = async (ctx, text) => { await ctx.input.fill(text); await ctx.input.press('Enter'); };
const names = (ctx) => ctx.page.locator('.react-flow__node-step .flowTitle, .react-flow__node-step').allInnerTexts();
const ok = (json) => () => ({ json });
const gate = () => { let release; const wait = new Promise((r) => { release = r; }); return { wait, release }; };

test('a failed first generation keeps the workspace open and retry reuses its context', async () => {
  const ctx = await start();
  try {
    ctx.queue.push(() => ({ status: 502, json: { code: 'AI_EMPTY_RESPONSE', message: 'The assistant returned no usable answer.' } }),
      ok(reply('Here is the workflow', [draftOp('Deploy', [step('s1', 'Restart nginx')])])));
    await ctx.input.fill('Build a workflow that restarts @');
    await ctx.page.getByRole('option', { name: /Production API/ }).click();
    await ctx.input.press('Enter');
    await ctx.page.getByText('The assistant could not draft this workflow').waitFor();
    assert.ok(await ctx.workspace.isVisible(), 'workspace stays open after the first failure');
    await ctx.page.getByText('Not sent', { exact: true }).waitFor();
    assert.equal(await ctx.page.locator('.react-flow__node-step').count(), 0, 'no executable node is invented');
    await ctx.workspace.getByRole('button', { name: 'Retry' }).click();
    await ctx.page.locator('.react-flow__node-step').first().waitFor();
    assert.deepEqual(ctx.chats[1], ctx.chats[0], 'retry sends the failed request unchanged');
    assert.deepEqual(ctx.chats[0].machineIds, [8]);
    assert.deepEqual(ctx.errors, []);
  } finally { await ctx.browser.close(); }
});

test('manual edits reach the next request; a failed refinement keeps the draft', async () => {
  const ctx = await start();
  try {
    ctx.queue.push(ok(reply('Draft ready', [draftOp('Deploy', [step('s1', 'Restart nginx')])])),
      () => ({ status: 503, json: { message: 'AI unavailable' } }));
    await send(ctx, 'Build a workflow that restarts nginx');
    await ctx.page.locator('.react-flow__node-step').first().waitFor();
    await ctx.workspace.getByRole('button', { name: /Wait until/ }).click();
    await ctx.page.waitForSelector('.react-flow__node-step >> nth=1');
    await ctx.workspace.getByRole('textbox', { name: 'Name' }).first().fill('Edited by hand');
    await send(ctx, 'Add a restart step');
    await ctx.workspace.getByText(/Your draft is unchanged/).waitFor();
    const draft = JSON.parse(ctx.chats[1].draftSummary);
    assert.equal(draft.name, 'Edited by hand', 'the draft the user sees, edits included, is what the assistant receives');
    assert.equal(draft.nodes.length, 2);
    assert.equal(await ctx.page.locator('.react-flow__node-step').count(), 2, 'failure keeps the previous draft');
    assert.deepEqual(ctx.errors, []);
  } finally { await ctx.browser.close(); }
});

test('a late reply never overwrites newer edits, and conversations keep their own drafts', async () => {
  const ctx = await start();
  try {
    const late = gate();
    ctx.queue.push(ok(reply('Draft ready', [draftOp('Deploy', [step('s1', 'Restart nginx')])])),
      async () => { await late.wait; return { json: reply('A newer idea', [draftOp('Assistant version', [step('s1', 'A'), step('s2', 'B')])]) }; });
    await send(ctx, 'Build a workflow that restarts nginx');
    await ctx.page.locator('.react-flow__node-step').first().waitFor();
    await send(ctx, 'Make it longer');
    await ctx.workspace.getByRole('button', { name: /Wait until/ }).click();
    late.release();
    await ctx.workspace.getByText(/proposed a new version while you were editing/).waitFor();
    assert.equal(await ctx.page.locator('.react-flow__node-step').count(), 2, 'the manual edit is still there');
    await ctx.workspace.getByRole('button', { name: 'Replace my draft' }).click();
    await ctx.page.waitForFunction(() => document.querySelectorAll('.react-flow__node-step').length === 2);
    // The draft is stored per conversation: after a reload the conversation brings it back.
    await ctx.page.reload();
    await ctx.page.getByRole('button', { name: 'Deploy flow', exact: true }).click();
    await ctx.page.locator('.react-flow__node-step').first().waitFor();
    await ctx.page.getByRole('button', { name: 'Show history' }).click();
    await ctx.page.getByRole('button', { name: 'Other chat', exact: true }).click();
    await ctx.page.getByText('Hi', { exact: true }).waitFor();
    assert.equal(await ctx.workspace.count(), 0, 'another conversation does not show this draft');
    assert.deepEqual(ctx.errors, []);
  } finally { await ctx.browser.close(); }
});

test('save validates, shows errors on steps, updates by version; execute needs the saved revision', async () => {
  const ctx = await start();
  try {
    ctx.queue.push(ok(reply('Draft ready', [draftOp('Deploy', [step('s1', 'Restart nginx')])])));
    await ctx.input.fill('Build a workflow for @');
    await ctx.page.getByRole('option', { name: /Production API/ }).click();
    await ctx.input.press('Enter');
    await ctx.page.locator('.react-flow__node-step').first().waitFor();
    const run = ctx.workspace.getByRole('button', { name: 'Run' });
    assert.ok(await run.isDisabled(), 'unsaved drafts cannot run');
    ctx.validate = () => ({ valid: false, errors: [{ nodeKey: 's1', field: 'commandDefinitionId', message: 'Pick a command' }] });
    await ctx.workspace.getByRole('button', { name: 'Save' }).click();
    await ctx.page.locator('.react-flow__node-step .flowFlag.error').waitFor();
    assert.equal(ctx.saves.length, 0, 'invalid drafts are not sent to the workflow API');
    ctx.validate = () => ({ valid: true, errors: [] });
    await ctx.workspace.getByRole('button', { name: 'Save' }).click();
    await ctx.workspace.getByText('Saved v1').waitFor();
    assert.equal(ctx.saves[0].method, 'POST');
    assert.ok(await run.isEnabled());
    await ctx.workspace.getByRole('button', { name: /Wait until/ }).click();
    await ctx.workspace.getByText('Unsaved changes').waitFor();
    assert.ok(await run.isDisabled(), 'an edited draft must be saved again before it runs');
    await ctx.workspace.getByRole('button', { name: 'Save' }).click();
    await ctx.workspace.getByText('Saved v2').waitFor();
    assert.equal(ctx.saves[1].method, 'PUT');
    assert.equal(ctx.saves[1].body.version, 1, 'updates carry the saved version');
    ctx.save = () => ({ status: 409, json: { code: 'STALE_VERSION', message: 'Someone else changed this workflow.' } });
    await ctx.workspace.getByRole('button', { name: /Wait until/ }).click();
    await ctx.workspace.getByRole('button', { name: 'Save' }).click();
    await ctx.workspace.getByText('Someone else changed this workflow.').waitFor();
    ctx.save = null;
    await ctx.workspace.getByRole('button', { name: 'Save' }).click();
    await ctx.workspace.getByText(/Saved v/).waitFor();
    await run.click();
    const checkbox = ctx.page.getByRole('dialog').getByRole('checkbox', { name: /Production API/ });
    await checkbox.waitFor();
    assert.ok(await checkbox.isChecked(), 'servers from the conversation are preselected');
    assert.equal(ctx.chats.length, 1, 'saving and running never involve the assistant');
    assert.deepEqual(ctx.errors, []);
  } finally { await ctx.browser.close(); }
});

test('the workspace is usable on mobile in Hebrew (RTL) and its controls are named', async () => {
  const ctx = await start({ viewport: { width: 390, height: 800 }, lang: 'he' });
  try {
    ctx.queue.push(ok(reply('הטיוטה מוכנה', [draftOp('פריסה', [step('s1', 'הפעלה מחדש')])])));
    await send(ctx, 'בנה תהליך שמפעיל מחדש את nginx');
    await ctx.page.locator('.react-flow__node-step').first().waitFor();
    assert.equal(await ctx.page.locator('html').getAttribute('dir'), 'rtl');
    await ctx.workspace.locator('.workspaceBadges .badge.warn').first().waitFor();
    assert.ok(await ctx.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll');
    const unnamed = await ctx.workspace.locator('button').evaluateAll((buttons) => buttons.filter((b) => !(b.getAttribute('aria-label') || b.textContent || '').trim()).length);
    assert.equal(unnamed, 0, 'every workspace button has an accessible name');
    assert.ok(await ctx.workspace.getByRole('toolbar').isVisible());
    await ctx.page.screenshot({ path: join(tmpdir(), 'workspace-mobile-rtl.png') });
    assert.deepEqual(ctx.errors, []);
  } finally { await ctx.browser.close(); }
});

test('a reply that lands after switching conversations updates only its own draft', async () => {
  const ctx = await start();
  try {
    const late = gate();
    ctx.queue.push(async () => { await late.wait; return { json: reply('Longer now', [draftOp('Deploy', [step('s1', 'A'), step('s2', 'B')])], 1) }; });
    await ctx.page.getByRole('button', { name: 'Deploy flow', exact: true }).click();
    await ctx.page.locator('.react-flow__node-step').first().waitFor();
    await send(ctx, 'Add a second step');
    await ctx.page.getByRole('button', { name: 'Show history' }).click();
    await ctx.page.getByRole('button', { name: 'Other chat', exact: true }).click();
    await ctx.page.getByText('Hi', { exact: true }).waitFor();
    late.release();
    await ctx.page.waitForTimeout(500);
    assert.equal(await ctx.workspace.count(), 0, 'the other conversation is untouched');
    assert.equal(await ctx.page.getByText('Longer now').count(), 0, 'and so is its thread');
    await ctx.page.getByRole('button', { name: 'Deploy flow', exact: true }).click();
    await ctx.page.waitForFunction(() => document.querySelectorAll('.react-flow__node-step').length === 2);
    assert.deepEqual(ctx.errors, []);
  } finally { await ctx.browser.close(); }
});
