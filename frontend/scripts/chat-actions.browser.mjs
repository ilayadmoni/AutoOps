import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setup, form } from './chat-actions.fixtures.mjs';
import { verifyForms } from './chat-actions.forms.mjs';

const browser = await chromium.launch({ headless: true });
try {
  for (const lang of ['en', 'he']) {
    const { page, state, errors } = await setup(browser, { lang, mobile: lang === 'he' });
    try {
      assert.equal(await page.locator('.chatStarters .tile').count(), 5);
      await page.screenshot({ path: `dist/chat-actions-${lang}.png`, fullPage: true });
      for (let index = 0; index < 5; index++) {
        if (index) await page.locator('.chatBar button').last().click();
        const before = state.chats.length;
        // A rapid double-click must still submit only one request.
        await page.locator('.chatStarters .tile').nth(index).evaluate(button => { button.click(); button.click(); });
        await page.locator('.message.reply .prose').last().waitFor();
        assert.equal(state.chats.length, before + 1);
        assert.ok(state.chats.at(-1).message.length > 20);
        assert.equal(state.chats.at(-1).draftSummary !== null, index === 2, 'only creating a workflow opens draft context');
        assert.equal(await page.locator('.chatStarters').count(), 0);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  await verifyForms(browser);
  const legacy = await setup(browser);
  try {
    legacy.state.operations = [form('UPLOAD_FILE')];
    await legacy.page.locator('.chatStarters .tile').first().click();
    await legacy.page.locator('.message.reply .prose').waitFor();
    assert.equal(await legacy.page.locator('.proposal').count(), 0, 'old upload cards are ignored');
  } finally { await legacy.page.close(); }
  const unavailable = await setup(browser, { configured: false });
  try {
    await unavailable.page.getByText(/not configured/i).waitFor();
    assert.equal(await unavailable.page.locator('.chatStarters').count(), 0);
  } finally { await unavailable.page.close(); }
  const retry = await setup(browser);
  try {
    retry.state.failChat = true;
    await retry.page.locator('.chatStarters .tile').nth(1).click();
    await retry.page.getByText('Assistant unavailable', { exact: true }).waitFor();
    retry.state.failChat = false;
    await retry.page.getByRole('button', { name: 'Retry', exact: true }).click();
    await retry.page.locator('.message.reply .prose').waitFor();
    assert.deepEqual(retry.state.chats[1], retry.state.chats[0]);
  } finally { await retry.page.close(); }
  console.log('Chat actions: five immediate starts, EN/HE mobile, form actions, final run confirmation, secret isolation and retry passed.');
} finally { await browser.close(); }
