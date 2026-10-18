import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setup, form, server } from './chat-actions.fixtures.mjs';

const browser = await chromium.launch({ headless: true });
try {
  for (const lang of ['en', 'he']) {
    const { page, state, errors } = await setup(browser, { lang, mobile: lang === 'he' });
    try {
      const machines = [
        server,
        { ...server, id: 9, name: 'Production DB', hostname: '192.168.80.140', operatingSystem: 'Ubuntu', trustStatus: 'UNTRUSTED' },
        { ...server, id: 10, name: 'Staging API', hostname: '192.168.80.7', operatingSystem: 'Rocky Linux' },
      ];
      await page.route('**/api/machines', route => route.fulfill({ json: machines }));
      state.operations = [form('RUN_WORKFLOW')];
      await page.locator('.chatStarters .tile').first().click();
      await page.locator('.proposal .selectTrigger').click();
      await page.getByRole('option', { name: 'Deploy nginx', exact: true }).click();
      await page.getByRole('button', { name: lang === 'he' ? 'בחירת שרתים ובדיקת ההרצה' : 'Choose servers and review run' }).click();
      const dialog = page.getByRole('dialog');
      const search = dialog.getByRole('searchbox');
      await dialog.getByRole('checkbox', { name: /Lab server/ }).waitFor();
      assert.equal(await dialog.getByRole('checkbox').count(), 3);
      await dialog.getByRole('checkbox', { name: /Lab server/ }).check();
      await search.fill('  PRODUCTION  ');
      assert.equal(await dialog.getByRole('checkbox').count(), 1, 'name search ignores case and surrounding whitespace');
      await dialog.getByRole('checkbox', { name: /Production DB/ }).check();
      await search.fill('192.168.80.7');
      assert.equal(await dialog.getByRole('checkbox').count(), 1, 'search supports IP addresses');
      await dialog.getByRole('checkbox', { name: /Staging API/ }).check();
      await search.fill('ubuntu');
      assert.equal(await dialog.getByRole('checkbox').count(), 1, 'search supports operating systems');
      assert.ok(await dialog.getByRole('checkbox', { name: /Production DB/ }).isChecked());
      await search.fill('no-such-machine');
      await dialog.getByText(lang === 'he' ? 'לא נמצאו שרתים' : 'No machines found', { exact: true }).waitFor();
      assert.equal(await dialog.getByRole('checkbox').count(), 0);
      const start = dialog.getByRole('button', { name: lang === 'he' ? 'הפעלה' : 'Start', exact: true });
      assert.ok(await start.isEnabled(), 'hidden selections still count toward execution');
      await search.fill('');
      assert.equal(await dialog.getByRole('checkbox').count(), 3);
      for (const checkbox of await dialog.getByRole('checkbox').all()) assert.ok(await checkbox.isChecked());
      await page.screenshot({ path: `dist/workflow-machine-search-${lang}.png`, fullPage: true });
      await search.fill('192.168.80.7');
      assert.equal(state.writes.length, 0, 'filtering and selection never start an execution');
      await start.click();
      await dialog.getByText('Run checked without executing').waitFor();
      assert.deepEqual(state.writes[0].data.machineIds, [8, 9, 10], 'execution includes selected machines hidden by search');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  console.log('Workflow machine search: EN/HE mobile, name/IP/OS, empty results and preserved selections passed.');
} finally { await browser.close(); }
