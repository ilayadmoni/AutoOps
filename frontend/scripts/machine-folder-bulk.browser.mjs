import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupMachines } from './machine-bulk-delete.fixtures.mjs';

const browser = await chromium.launch({ headless: true });
try {
  for (const lang of ['en', 'he']) {
    const { page, state, errors } = await setupMachines(browser, lang);
    const he = lang === 'he';
    const machine = name => page.getByRole('checkbox', { name: `${he ? 'בחירת' : 'Select'} ${name}`, exact: true });
    const folder = name => page.getByRole('checkbox', { name: he
      ? `בחירת כל השרתים בתיקייה ${name}, כולל תיקיות משנה` : `Select all machines in ${name}, including subfolders`, exact: true });
    const deletion = n => page.getByRole('button', { name: he ? `מחיקת הנבחרים (${n})` : `Delete selected (${n})`, exact: true });
    try {
      state.folders.push({ id: 2, name: 'Apps', path: 'Lab/Apps', parentId: 1 }, { id: 3, name: 'Lab2', path: 'Lab2', parentId: null });
      state.machines.push(
        { ...state.machines[0], id: 6, name: 'Nested host', folderId: 2 },
        { ...state.machines[0], id: 7, name: 'Other folder host', folderId: 3 },
      );
      await page.reload();
      await page.getByRole('heading', { name: 'Alpha', exact: true }).waitFor();
      await page.getByRole('button', { name: he ? 'עריכה' : 'Edit', exact: true }).click();
      await machine('Alpha').waitFor();
      assert.ok(await folder('Empty').isDisabled());
      assert.equal(await page.locator('.machineFolderCard input').count(), 0, 'checkbox is separate from the navigation link');
      await machine('Alpha').check();
      await folder('Lab').focus();
      await page.keyboard.press('Space');
      await deletion(4).waitFor();
      assert.equal(new URL(page.url()).search, '', 'folder selection does not navigate');
      assert.equal(await folder('Lab2').isChecked(), false, 'similar folder prefixes stay independent');
      await page.locator('.machineFolderCard[href$="?folder=1"]').click();
      assert.ok(await machine('Lab one').isChecked());
      assert.ok(await machine('Lab two').isChecked());
      assert.ok(await folder('Apps').isChecked(), 'nested folder machines are included');
      await machine('Lab one').uncheck();
      await page.getByRole('navigation', { name: he ? 'ניווט בתיקיות' : 'Folder navigation' })
        .getByRole('link', { name: he ? 'כל המכונות' : 'All machines', exact: true }).click();
      assert.ok(await folder('Lab').evaluate(input => input.indeterminate), 'partial child selection updates the parent');
      await folder('Lab').check();
      await folder('Lab').uncheck();
      await deletion(1).waitFor();
      assert.ok(await machine('Alpha').isChecked(), 'deselecting a folder preserves unrelated selections');
      await page.getByRole('searchbox').fill('Lab one');
      await folder('Lab').check();
      await deletion(4).click();
      const dialog = page.getByRole('dialog');
      const names = await dialog.locator('.machineDeleteList strong').allTextContents();
      assert.deepEqual(names, ['Alpha', 'Lab one', 'Lab two', 'Nested host'], 'folder selection includes all descendants even under a search filter');
      assert.equal(state.deletes.length, 0);
      await dialog.getByRole('button', { name: he ? 'ביטול' : 'Cancel', exact: true }).click();
      await page.getByRole('searchbox').fill('');
      await page.screenshot({ path: `dist/machine-folder-selection-${lang}.png`, fullPage: true });
      await page.getByRole('button', { name: he ? 'סיום' : 'Done', exact: true }).click();
      assert.equal(await page.getByRole('checkbox').count(), 0);
      assert.equal(await deletion(4).count(), 0, 'done hides bulk controls');
      await page.getByRole('button', { name: he ? 'עריכה' : 'Edit', exact: true }).click();
      assert.equal(await machine('Alpha').isChecked(), false, 'starting edit mode again clears old selection');
      assert.equal(await folder('Lab').isChecked(), false);
      await machine('Alpha').check();
      await folder('Lab').check();
      state.failures.clear();
      await deletion(4).click();
      await page.getByRole('dialog').getByRole('button', { name: he ? 'מחיקת הנבחרים (4)' : 'Delete selected (4)', exact: true }).click();
      await machine('Alpha').waitFor({ state: 'detached' });
      assert.deepEqual([...state.deletes].sort(), [1, 4, 5, 6]);
      assert.deepEqual(state.machines.map(item => item.id), [2, 3, 7]);
      assert.equal(state.folders.length, 4, 'deleting selected VMs preserves folders');
      assert.ok(await folder('Lab').isDisabled(), 'folder becomes unselectable once emptied');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  console.log('Folder bulk selection: recursive selection, mixed state, filtering, deselection, navigation, deletion and mobile RTL passed.');
} finally { await browser.close(); }
