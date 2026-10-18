import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { collectionFixtures } from './collections.fixtures.mjs';

const browser = await chromium.launch({ headless: true });
const base = process.env.UI_TEST_URL ?? 'http://localhost:5173';
try {
  for (const lang of ['en', 'he']) {
    const page = await browser.newPage({ viewport: { width: lang === 'he' ? 390 : 1366, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const state = await collectionFixtures(page, lang);
    const he = lang === 'he';
    const favorite = id => page.getByRole('button', { name: `${he ? 'מועדף' : 'Favorite'}: Item ${id}`, exact: true });
    const favorites = () => page.getByRole('button', { name: he ? 'מועדפים' : 'Favorites', exact: true });
    const all = () => page.getByRole('button', { name: he ? 'כל הפריטים' : 'All items', exact: true });
    for (const tab of ['workflows', 'commands', 'credentials', 'files', 'machines']) {
      await page.goto(`${base}/${tab}`);
      // Machine 1 is nested under Lab; favoriting it must make it accessible from the root.
      if (tab === 'machines') await page.goto(`${base}/machines?folder=10`);
      await favorite(1).waitFor();
      await favorite(1).click();
      await expect(favorite(1)).toBeEnabled();
      await expect.poll(() => state.favorites.get(`1:${tab}`)?.has(1)).toBe(true);
      await expect(favorite(1)).toHaveAttribute('aria-pressed', 'true');
      await favorites().click();
      assert.equal(await favorite(2).count(), 0);
      await page.reload();
      await favorite(1).waitFor();
      await expect(favorite(1)).toHaveAttribute('aria-pressed', 'true');
      if (tab === 'machines') {
        await page.goto(`${base}/machines`); await favorites().click(); await favorite(1).waitFor();
      } else await favorites().click();
      await favorite(1).click();
      await page.getByText(he ? 'עדיין אין מועדפים' : 'No favorites yet', { exact: true }).waitFor();
      await all().click();
      if (tab === 'machines') continue;
      await page.locator('.pageBar').getByRole('button', { name: he ? 'עריכה' : 'Edit', exact: true }).click();
      await page.getByRole('button', { name: he ? 'בחירת המוצגים' : 'Select visible', exact: true }).click();
      if (['commands', 'files'].includes(tab)) {
        assert.ok(await page.getByRole('checkbox', { name: `${he ? 'בחירה' : 'Select'}: Item 3` }).isDisabled());
      }
      const deleteButton = page.locator('.collectionToolbar').getByRole('button', { name: he ? /מחיקת הנבחרים/ : /Delete selected/ });
      await deleteButton.click();
      await page.getByRole('dialog').getByRole('button', { name: he ? 'ביטול' : 'Cancel', exact: true }).click();
      assert.equal(state.deletes.filter(value => value.startsWith(tab)).length, 0, 'cancel sends no deletes');
      await deleteButton.click();
      await page.getByRole('dialog').waitFor();
      await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
      await page.screenshot({ path: `dist/collection-confirm-${lang}-${tab}.png`, fullPage: true });
      await page.getByRole('dialog').getByRole('button', { name: he ? /מחיקת הנבחרים/ : /Delete selected/ }).click();
      await page.getByText('Item is in use', { exact: false }).waitFor();
      assert.equal(await favorite(1).count(), 0, 'successful deletion removed item');
      assert.ok(await page.getByRole('checkbox', { name: `${he ? 'בחירה' : 'Select'}: Item 2` }).isChecked(), 'failure stays selected');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tab} has no horizontal overflow`);
      await page.screenshot({ path: `dist/collection-results-${lang}-${tab}.png`, fullPage: true });
    }
    // Server save failure rolls the optimistic star back.
    await page.goto(`${base}/credentials`);
    state.failFavorite = true;
    await favorite(2).click();
    await page.getByText('Favorite save failed', { exact: true }).waitFor();
    assert.equal(await favorite(2).getAttribute('aria-pressed'), 'false');
    await favorite(2).click();
    await expect(favorite(2)).toBeEnabled();
    await expect.poll(() => state.favorites.get('1:credentials')?.has(2)).toBe(true);
    state.user = 2; await page.reload(); await favorite(2).waitFor();
    await expect(favorite(2)).toBeEnabled();
    await expect(favorite(2)).toHaveAttribute('aria-pressed', 'false');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Collections: five tabs, persisted and isolated favorites, rollback, protected items, confirmation/cancel, partial deletion, EN/HE and mobile passed.');
} finally { await browser.close(); }

