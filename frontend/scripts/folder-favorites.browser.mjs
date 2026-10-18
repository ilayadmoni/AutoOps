import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { collectionFixtures } from './collections.fixtures.mjs';

const browser = await chromium.launch({ headless: true });
const base = process.env.UI_TEST_URL ?? 'http://localhost:5173';
try {
  for (const lang of ['en', 'he']) {
    const he = lang === 'he';
    const page = await browser.newPage({ viewport: { width: he ? 390 : 1366, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const state = await collectionFixtures(page, lang);
    state.folders.push({ id: 20, name: 'Nested', path: 'Lab/Nested', parentId: 10 },
      { id: 30, name: 'Empty', path: 'Empty', parentId: null });
    state.items.machines[1].folderId = 10;
    state.items.machines[2].folderId = 20;
    state.items.machines.push({ ...state.items.machines[0], id: 10, name: 'Same ID machine', folderId: null });
    const star = name => page.getByRole('button', { name: `${he ? 'מועדף' : 'Favorite'}: ${name}`, exact: true });
    const favorites = () => page.getByRole('button', { name: he ? 'מועדפים' : 'Favorites', exact: true });
    const all = () => page.getByRole('button', { name: he ? 'כל הפריטים' : 'All items', exact: true });
    const waitForSave = async name => {
      await expect(star(name)).toBeEnabled();
      await expect(star(name)).toHaveAttribute('aria-pressed', 'true');
    };
    await page.goto(`${base}/machines`);
    await star('Lab').click(); await waitForSave('Lab');
    assert.equal(new URL(page.url()).search, '', 'starring a folder does not navigate');
    await favorites().click();
    await expect(page.getByRole('link', { name: /Lab/ })).toHaveCount(1);
    await expect(star('Same ID machine')).toHaveCount(0);
    await expect(star('Empty')).toHaveCount(0);
    await page.reload(); await favorites().click(); await waitForSave('Lab');
    await page.getByRole('link', { name: /Lab/ }).click();
    await expect(all()).toHaveAttribute('aria-pressed', 'true');
    await expect(star('Item 2')).toBeVisible(); // Opening a saved folder reveals nonfavorite contents too.
    await star('Lab/Nested').click(); await waitForSave('Lab/Nested');
    await star('Item 1').click(); await waitForSave('Item 1');
    await favorites().click();
    await expect(star('Lab')).toBeVisible(); await expect(star('Lab/Nested')).toBeVisible();
    await expect(star('Item 1')).toBeVisible(); await expect(star('Item 2')).toHaveCount(0);
    // Folder controls are siblings of links and remain usable with the keyboard.
    assert.equal(await page.locator('.machineFolderCard button').count(), 0);
    await star('Lab/Nested').focus(); await page.keyboard.press('Space');
    await expect(star('Lab/Nested')).toHaveCount(0);
    assert.equal(new URL(page.url()).searchParams.get('folder'), '10');
    await page.screenshot({ path: `dist/folder-favorites-${lang}.png`, fullPage: true });
    await all().click();
    await page.locator('.pageBar').getByRole('button', { name: he ? 'עריכה' : 'Edit', exact: true }).click();
    const nested = page.locator('.machineFolderItem').filter({ has: star('Lab/Nested') });
    const favoriteBox = await nested.getByRole('button').boundingBox();
    const selectBox = await nested.getByRole('checkbox').boundingBox();
    assert.ok(favoriteBox && selectBox && Math.abs(favoriteBox.x - selectBox.x) >= 44, 'folder star and selection do not overlap');
    await page.screenshot({ path: `dist/folder-favorites-edit-${lang}.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Empty folders can be saved, and failed saves roll back.
    await page.goto(`${base}/machines`);
    state.failFavorite = true; await star('Empty').click();
    await page.getByText('Favorite save failed', { exact: true }).waitFor();
    await expect(star('Empty')).toHaveAttribute('aria-pressed', 'false');
    await star('Empty').click(); await waitForSave('Empty');
    state.user = 2; await page.reload();
    await expect(star('Lab')).toBeEnabled(); await expect(star('Lab')).toHaveAttribute('aria-pressed', 'false');
    await favorites().click(); await expect(star('Lab')).toHaveCount(0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Folder favorites: nested/empty folders, persistence, per-user and resource isolation, navigation, keyboard, edit selection, rollback and EN/HE mobile passed.');
} finally { await browser.close(); }
