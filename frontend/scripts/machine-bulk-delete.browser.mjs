import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupMachines } from './machine-bulk-delete.fixtures.mjs';

const browser = await chromium.launch({ headless: true });
try {
  for (const lang of ['en', 'he']) {
    const { page, state, errors } = await setupMachines(browser, lang);
    const hebrew = lang === 'he';
    const visibleLabel = hebrew ? 'בחירת הכול' : 'Select all';
    const clearLabel = hebrew ? 'ביטול בחירת הכול' : 'Deselect all';
    const cancelLabel = hebrew ? 'ביטול' : 'Cancel';
    const selectedLabel = n => hebrew ? `מחיקת הנבחרים (${n})` : `Delete selected (${n})`;
    const choose = name => page.getByRole('checkbox', { name: `${hebrew ? 'בחירת' : 'Select'} ${name}`, exact: true });
    try {
      await page.getByRole('heading', { name: 'Alpha', exact: true }).waitFor();
      assert.equal(await page.getByRole('checkbox').count(), 0, 'normal browsing hides all selection checkboxes');
      await page.getByRole('button', { name: hebrew ? 'עריכה' : 'Edit', exact: true }).click();
      await choose('Alpha').waitFor();
      assert.equal(await page.locator('.machineFolderCard input[type=checkbox]').count(), 0, 'select-all never deletes folders');
      const all = page.getByRole('button', { name: visibleLabel, exact: true });
      await choose('Alpha').focus();
      await page.keyboard.press('Space');
      await page.getByRole('searchbox').fill('Gamma');
      await all.click();
      await page.getByRole('searchbox').fill('');
      assert.ok(await choose('Alpha').isChecked(), 'selection survives search');
      assert.ok(await choose('Gamma').isChecked());
      assert.equal(await choose('Beta').isChecked(), false, 'select visible respects the search');
      await all.click();
      await page.getByRole('button', { name: clearLabel, exact: true }).click();
      assert.equal(await page.locator('input[type=checkbox]:checked').count(), 0, 'deselect all clears machines and folders');
      assert.ok(await page.getByRole('button', { name: selectedLabel(0), exact: true }).isDisabled());
      await all.click();
      await page.getByRole('button', { name: selectedLabel(5), exact: true }).click();
      let dialog = page.getByRole('dialog');
      assert.equal(await dialog.locator('.machineDeleteList li').count(), 5, 'select all includes visible folders and their VMs');
      assert.equal(state.deletes.length, 0, 'opening confirmation makes no changes');
      await dialog.getByRole('button', { name: cancelLabel, exact: true }).click();
      assert.equal(state.deletes.length, 0, 'cancel never deletes');
      await page.locator('.machineFolderCard[href$="?folder=1"]').click();
      await choose('Lab one').waitFor();
      await all.click();
      await page.getByRole('button', { name: selectedLabel(5), exact: true }).click();
      dialog = page.getByRole('dialog');
      assert.equal(await dialog.locator('.machineDeleteList li').count(), 5, 'confirmation includes selections from other folders');
      await page.screenshot({ path: `dist/machine-bulk-confirm-${lang}.png`, fullPage: true });
      await dialog.getByRole('button', { name: selectedLabel(5), exact: true }).click();
      await page.getByRole('alert').getByText(/Machine is part of an execution in progress/).waitFor();
      assert.deepEqual([...state.deletes].sort(), [1, 2, 3, 4, 5]);
      assert.ok(state.peak <= 3, 'deletion concurrency is bounded');
      assert.deepEqual(state.machines.map(machine => machine.id), [2]);
      await page.getByRole('navigation', { name: hebrew ? 'ניווט בתיקיות' : 'Folder navigation' })
        .getByRole('link', { name: hebrew ? 'כל המכונות' : 'All machines', exact: true }).click();
      await choose('Beta').waitFor();
      assert.ok(await choose('Beta').isChecked(), 'only failed machines remain selected');
      await page.screenshot({ path: `dist/machine-bulk-failed-${lang}.png`, fullPage: true });
      state.failures.clear();
      await page.getByRole('button', { name: selectedLabel(1), exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: selectedLabel(1), exact: true }).click();
      await choose('Beta').waitFor({ state: 'detached' });
      assert.deepEqual(state.deletes, [1, 2, 3, 4, 5, 2], 'retry only deletes failed items');
      assert.equal(await page.getByRole('alert').count(), 0);
      assert.ok(await page.getByRole('button', { name: clearLabel, exact: true }).isDisabled());
      await page.getByRole('button', { name: hebrew ? 'סיום' : 'Done', exact: true }).click();
      assert.equal(await page.getByRole('checkbox').count(), 0);
      assert.equal(await page.getByRole('button', { name: clearLabel, exact: true }).count(), 0);
      assert.equal(await page.locator('.machineFolderCard').count(), 2, 'folders stay intact');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  console.log('Machine bulk delete: visible selection, filtering/folders, cancellation, partial failure/retry, keyboard and mobile RTL passed.');
} finally { await browser.close(); }
