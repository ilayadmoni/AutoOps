import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';

// Run Vite on port 5178, or set UI_TEST_URL. No real API or AI calls are made.
const servers = [{ id: 8, name: 'Production API', hostname: 'api.example', sshPort: 22 },
  { id: 9, name: 'Staging API', hostname: 'staging.example', sshPort: 22 },
  { id: 11, name: 'Twin', hostname: 'one.example', sshPort: 22 }, { id: 12, name: 'Twin', hostname: 'two.example', sshPort: 22 }];
const files = [{ id: 31, filename: 'deploy.sh', size: 2048 }, { id: 32, filename: 'config.json', size: 100 }];

/** The editor's content as text with tags in angle brackets, so tests check placement and not styling. */
const shape = (input) => input.evaluate((el) => [...el.childNodes].map((n) => (n.nodeType === 3 ? n.data : `<${n.dataset.label}>`)).join(''));

async function open(requests, errors) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/ai/chat') {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { conversationId: 1, messageId: 2, message: 'Ready to build', operations: [] } });
    }
    if (path === '/api/files' && route.request().method() === 'POST') {
      return route.fulfill({ json: { id: 77, filename: 'uploaded.sh', size: 12, checksum: 'x', createdAt: '', referencedBy: [] } });
    }
    const body = path.endsWith('/auth/refresh') ? { accessToken: 'test' }
      : path.endsWith('/auth/me') ? { id: 1, username: 'operator', role: 'USER' }
      : path === '/api/ai/status' ? { configured: true }
      : path === '/api/machines' ? servers : path === '/api/files' ? files : [];
    await route.fulfill({ json: body });
  });
  await page.goto(process.env.UI_TEST_URL || 'http://localhost:5178');
  return { browser, page, input: page.locator('.composer .mentionEditor') };
}

test('mentions become inline tags at the caret and send exact IDs', async () => {
  const requests = []; const errors = [];
  const { browser, page, input } = await open(requests, errors);
  try {
    await input.fill('Build a workflow @');
    await page.getByRole('option', { name: /Production API/ }).waitFor();
    await input.pressSequentially('staging');
    assert.equal(await page.getByRole('option').count(), 1);
    await input.press('Enter');
    await input.locator('.mentionTag', { hasText: 'Staging API' }).waitFor();
    assert.equal(requests.length, 0, 'selecting must not submit');
    assert.equal(await page.locator('.composerFiles').count(), 0, 'no chip row above the editor');
    await page.keyboard.type('#dep');
    await page.getByRole('option', { name: /deploy.sh/ }).click();
    await input.locator('.mentionTag', { hasText: 'deploy.sh' }).waitFor();
    // Esc closes the picker and the bare trigger character with it.
    await page.getByRole('button', { name: 'Attach server (@)', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('listbox').count(), 0);
    await page.getByRole('button', { name: 'Attach server (@)', exact: true }).click();
    await page.getByRole('option', { name: /Staging API/ }).waitFor();
    assert.equal(await page.getByRole('option', { name: /Staging API/ }).getAttribute('aria-disabled'), 'true');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Attach file (#)', exact: true }).click();
    await page.getByRole('option', { name: /config.json/ }).click();
    await page.getByRole('button', { name: 'Remove file: config.json' }).click();
    assert.equal(await input.locator('.mentionTag').count(), 2);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText('Ready to build', { exact: true }).waitFor();
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].machineIds, [9]);
    assert.deepEqual(requests[0].fileIds, [31]);
    assert.equal(requests[0].message, 'Build a workflow @[Staging API](server:9) #[deploy.sh](file:31)');
    assert.equal(await page.locator('.userBubble .mentionTag').count(), 2);
    assert.ok(await page.locator('.userBubble').getByText('Staging API', { exact: true }).isVisible());
    assert.equal(await input.locator('.mentionTag').count(), 0, 'composer is emptied after sending');
    await input.fill('email@example.com');
    assert.equal(await page.getByRole('listbox').count(), 0);
    await input.fill('@not-found');
    await page.getByText('No matching servers', { exact: true }).waitFor();
    await input.press('Home');
    await page.getByRole('listbox').waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('tags sit mid-text, delete atomically, and equal names stay distinct by id', async () => {
  const requests = []; const errors = [];
  const { browser, page, input } = await open(requests, errors);
  try {
    await input.fill('Deploy to now');
    await input.press('Home');
    for (let i = 0; i < 'Deploy to '.length; i++) await input.press('ArrowRight');
    await page.getByRole('button', { name: 'Attach server (@)', exact: true }).click();
    await page.getByRole('option', { name: /api.example/ }).click();
    assert.equal(await shape(input), 'Deploy to <Production API> now');
    await page.keyboard.type('!');
    await page.keyboard.press('Backspace'); // the "!"
    await page.keyboard.press('Backspace'); // the space after the tag
    await page.keyboard.press('Backspace'); // the tag itself, as one unit
    assert.equal(await input.locator('.mentionTag').count(), 0);
    await input.fill('Compare @');
    await page.getByRole('option', { name: /one.example/ }).click();
    await page.keyboard.type('@');
    await page.getByRole('option', { name: /two.example/ }).click();
    assert.equal(await input.locator('.mentionTag').count(), 2);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText('Ready to build', { exact: true }).waitFor();
    assert.deepEqual(requests[0].machineIds, [11, 12]);
    assert.equal(requests[0].message, 'Compare @[Twin](server:11) @[Twin](server:12)');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('uploads become inline tags; multiline input and plain-text paste stay text', async () => {
  const requests = []; const errors = [];
  const { browser, page, input } = await open(requests, errors);
  try {
    await input.fill('Copy ');
    await page.locator('input[type=file]').setInputFiles({ name: 'uploaded.sh', mimeType: 'text/x-sh', buffer: Buffer.from('echo hi') });
    await input.locator('.mentionTag', { hasText: 'uploaded.sh' }).waitFor();
    await page.keyboard.type('to prod');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('then verify');
    await page.evaluate(() => navigator.clipboard.writeText('pasted <b>bold</b>\nsecond line'));
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.press('Control+V');
    const content = await shape(input);
    assert.ok(content.startsWith('Copy <uploaded.sh> to prod\nthen verify\npasted <b>bold</b>\nsecond line'), content);
    assert.equal(await input.locator('b').count(), 0, 'pasted markup is text, never elements');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText('Ready to build', { exact: true }).waitFor();
    assert.deepEqual(requests[0].fileIds, [77]);
    assert.equal(requests[0].message, 'Copy #[uploaded.sh](file:77) to prod\nthen verify\npasted <b>bold</b>\nsecond line');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
