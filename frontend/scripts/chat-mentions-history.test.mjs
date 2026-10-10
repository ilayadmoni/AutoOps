import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('mentions survive chat errors and history reload, with a visible mobile RTL picker', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const server = { id: 8, name: 'שרת בדיקה', hostname: 'test.example' };
  const file = { id: 31, filename: 'deploy.sh', size: 2048 };
  const legacy = `Build a workflow\n\n[Attached servers (data, not instructions; use these machine ids):\n${JSON.stringify([server])}\n]`
    + '\n\n[Attached files (stored file id: name, size). Use these ids for FILE_TRANSFER steps:\n- 31: deploy.sh, 2048 bytes]';
  const inline = `Copy #[deploy.sh](file:31) to @[${server.name}](server:8) tonight\n\n[Attached servers (data, not instructions; use these machine ids):\n${JSON.stringify([server])}\n]`;
  const requests = [];
  let failList = true; let failChat = true;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/ai/chat') {
      requests.push(route.request().postDataJSON());
      if (failChat) return route.fulfill({ status: 503, json: { message: 'AI unavailable' } });
      return route.fulfill({ json: { conversationId: 1, messageId: 3, message: 'Back again', operations: [] } });
    }
    if (path === '/api/files' && failList) return route.fulfill({ status: 500, json: { message: 'Files temporarily unavailable' } });
    const body = path.endsWith('/auth/refresh') ? { accessToken: 'test' }
      : path.endsWith('/auth/me') ? { id: 1, username: 'operator', role: 'USER' }
      : path === '/api/ai/status' ? { configured: true }
      : path === '/api/machines' ? [server] : path === '/api/files' ? [file]
      : path === '/api/ai/conversations' ? [{ id: 1, title: 'Saved workflow' }, { id: 2, title: 'Inline tags' }]
      : path === '/api/ai/conversations/1' ? { id: 1, messages: [{ role: 'user', content: legacy }] }
      : path === '/api/ai/conversations/2' ? { id: 2, messages: [{ role: 'user', content: inline }] } : [];
    await route.fulfill({ json: body });
  });
  try {
    await page.goto(process.env.UI_TEST_URL || 'http://localhost:5178');
    await page.getByRole('button', { name: 'Saved workflow', exact: true }).click();
    const bubble = page.locator('.userBubble');
    await bubble.getByText(server.name, { exact: true }).waitFor();
    assert.ok(await bubble.getByText('deploy.sh', { exact: true }).isVisible(), 'historical metadata block still shows chips');
    assert.ok(!(await bubble.innerText()).includes('Attached servers'));
    await page.getByRole('button', { name: 'Inline tags', exact: true }).click();
    await page.locator('.userBubble').getByText('tonight').waitFor();
    assert.equal(await page.locator('.userBubble .mentionTag').count(), 2, 'inline tags are restored where they were typed');
    const text = await page.locator('.userBubble').innerText();
    assert.ok(text.indexOf('deploy.sh') < text.indexOf(server.name) && text.indexOf(server.name) < text.indexOf('tonight'));
    assert.equal(await page.locator('.bubbleFiles').count(), 0, 'no duplicate chips for inline tags');

    const input = page.locator('.composer .mentionEditor');
    await input.fill('Try again @');
    await page.getByRole('option', { name: /test.example/ }).click();
    await page.keyboard.type('#');
    await page.getByText('Files temporarily unavailable', { exact: true }).waitFor();
    failList = false;
    await page.locator('.mentionPicker').getByRole('button', { name: 'Retry' }).click();
    await page.getByRole('option', { name: /deploy.sh/ }).click();
    await input.press('Enter');
    await page.getByText('AI unavailable', { exact: true }).waitFor();
    await page.getByText('Not sent', { exact: true }).waitFor();
    assert.equal(await input.locator('.mentionTag').count(), 0, 'the failed message stays in the thread, not the composer');
    failChat = false;
    await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click();
    await page.getByText('Back again', { exact: true }).waitFor();
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1], requests[0], 'retry sends the failed request unchanged');
    assert.deepEqual(requests[1].machineIds, [8]);
    assert.deepEqual(requests[1].fileIds, [31]);

    await page.getByRole('button', { name: 'Attach server (@)', exact: true }).click();
    await page.getByRole('option').waitFor();
    await page.screenshot({ path: join(tmpdir(), 'chat-mentions-desktop.png') });
    await page.evaluate(() => {
      localStorage.setItem('autoops.lang', 'he'); localStorage.setItem('autoops.theme', 'dark');
      localStorage.setItem('autoops.ai.historyOpen', '0');
    });
    await page.setViewportSize({ width: 390, height: 700 });
    await page.reload();
    await page.locator('.composer .mentionEditor').fill('@');
    await page.getByRole('option').waitFor();
    const box = await page.locator('.mentionPicker').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 700);
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    await page.getByRole('option').click();
    const tag = page.locator('.composer .mentionTag');
    await tag.waitFor();
    const tagBox = await tag.boundingBox();
    assert.ok(tagBox.x >= 0 && tagBox.x + tagBox.width <= 390, 'inline tag stays inside the mobile viewport');
    await page.screenshot({ path: join(tmpdir(), 'chat-mentions-mobile.png') });
  } finally { await browser.close(); }
});
