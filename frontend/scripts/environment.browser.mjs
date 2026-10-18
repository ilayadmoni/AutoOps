import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const base = process.env.UI_TEST_URL ?? process.env.AUTOOPS_TEST_URL ?? 'http://localhost:4178';
const settings = [
  { name: 'AI_MODEL', property: 'autoops.ai.model', value: 'example-model', configured: true, masked: false },
  { name: 'AI_API_KEY', property: 'autoops.ai.api-key', value: null, configured: true, masked: true },
  { name: 'EMBEDDING_MODEL', property: 'autoops.embedding.model', value: '', configured: false, masked: false },
];

try {
  for (const [role, lang, width] of [['ADMIN', 'en', 1366], ['ADMIN', 'he', 390], ['USER', 'en', 1366]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    let reads = 0;
    let fail = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('autoops.lang', value), lang);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path === '/api/auth/refresh') data = { accessToken: 'test-token' };
      if (path === '/api/auth/me') data = { id: 1, username: 'tester', role };
      if (path === '/api/admin/environment') {
        assert.equal(route.request().method(), 'GET');
        reads++;
        if (fail) return route.fulfill({ status: 500, json: { message: 'Configuration unavailable' } });
        data = settings;
      }
      await route.fulfill({ json: data });
    });
    await page.goto(`${base}/admin/environment`);
    if (role === 'USER') {
      await page.waitForURL(`${base}/`);
      assert.equal(reads, 0, 'non-admins never request configuration');
      assert.equal(await page.locator('a[href="/admin/environment"]').count(), 0);
    } else {
      await page.getByRole('rowheader', { name: /AI_MODEL/ }).waitFor();
      assert.equal(await page.getByRole('row').count(), 4);
      assert.equal(await page.locator('input:not([type=search]), textarea').count(), 0);
      const search = page.getByRole('searchbox');
      await search.fill('AI_API_KEY');
      assert.equal(await page.getByRole('row').count(), 2);
      assert.match(await page.getByRole('table').innerText(), lang === 'he' ? /מוסתר/ : /Masked/);
      await search.fill('no-such-variable');
      await page.getByText(lang === 'he' ? 'אין הגדרות התואמות לחיפוש.' : 'No settings match your search.').waitFor();
      await search.fill('');
      await page.getByRole('button', { name: lang === 'he' ? 'רענון הגדרות' : 'Refresh configuration' }).click();
      await page.waitForFunction(() => !document.querySelector('button[disabled]'));
      assert.equal(reads, 2);
      await page.screenshot({ path: `dist/environment-${lang}.png`, fullPage: true });
      fail = true;
      await page.getByRole('button', { name: lang === 'he' ? 'רענון הגדרות' : 'Refresh configuration' }).click();
      await page.getByText('Configuration unavailable').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page overflow');
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Environment dashboard: admin/user access, EN/HE, mobile, search, masking, refresh and errors passed.');
} finally {
  await browser.close();
}
