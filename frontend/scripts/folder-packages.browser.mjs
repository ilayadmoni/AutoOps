import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { setupFolders } from './folder-packages.fixtures.mjs';

const root = await mkdtemp(join(tmpdir(), 'autoops-folder-ui-'));
const folder = join(root, 'app');
await mkdir(join(folder, 'config'), { recursive: true }); await mkdir(join(folder, 'bin'));
await writeFile(join(folder, 'config', 'app.conf'), 'ready'); await writeFile(join(folder, 'bin', 'run.sh'), '#!/bin/sh\necho ready');
await writeFile(join(folder, 'empty'), '');
const browser = await chromium.launch({ headless: true });
try {
  for (const lang of ['en', 'he']) {
    const { page, state, errors } = await setupFolders(browser, lang);
    const he = lang === 'he';
    const folderUpload = he ? 'העלאת תיקייה' : 'Upload folder';
    const confirm = he ? 'העלאת חבילה' : 'Upload package';
    try {
      await page.getByRole('heading', { name: 'config.json' }).waitFor();
      await page.locator('.fab').click();
      const chooserPromise = page.waitForEvent('filechooser');
      await page.getByRole('menuitem', { name: folderUpload, exact: true }).click();
      await (await chooserPromise).setFiles(folder);
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', { name: 'app', exact: true }).waitFor();
      await dialog.getByText('app.conf', { exact: true }).waitFor();
      assert.equal(await dialog.getByRole('checkbox').count(), 3);
      await dialog.locator('.folderTreeFile').filter({ hasText: 'run.sh' }).getByRole('checkbox').check();
      assert.equal(state.uploads.length, 0, 'preview never uploads before confirmation');
      await page.screenshot({ path: `dist/folder-preview-${lang}.png`, fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await dialog.getByRole('button', { name: confirm, exact: true }).click();
      await dialog.getByText('Test upload failure').waitFor();
      assert.ok(await dialog.locator('.folderTreeFile').filter({ hasText: 'run.sh' }).getByRole('checkbox').isChecked());
      await dialog.getByRole('button', { name: confirm, exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(state.uploads.length, 2);
      assert.ok(state.uploads[1].includes('"executablePaths":["bin/run.sh"]'));
      for (const path of ['config/app.conf', 'bin/run.sh', 'empty']) assert.ok(state.uploads[1].includes(path));
      await page.getByText(he ? 'הצגת תוכן התיקייה' : 'View folder contents', { exact: true }).click();
      await page.getByText('app.conf', { exact: true }).waitFor();
      await page.screenshot({ path: `dist/folder-card-${lang}.png`, fullPage: true });
      // Existing single-file upload remains available through the same menu.
      await page.locator('.fab').click();
      const singleChooser = page.waitForEvent('filechooser');
      await page.getByRole('menuitem').filter({ hasText: he ? 'העלאת קובץ' : 'Upload file' }).click();
      await (await singleChooser).setFiles({ name: 'single.txt', mimeType: 'text/plain', buffer: Buffer.from('single') });
      await page.getByRole('heading', { name: 'single.txt', exact: true }).waitFor();
      // The workflow uses the folder's exact destination and explicit replacement semantics.
      await page.goto(`${process.env.UI_TEST_URL ?? 'http://127.0.0.1:4187'}/workflows/5/edit`);
      await page.getByText('Deploy package', { exact: true }).click();
      const inspector = page.locator('.inspector');
      await inspector.getByText(he ? 'תיקיית יעד' : 'Destination directory', { exact: true }).waitFor();
      await inspector.getByRole('checkbox', { name: he ? 'החלפת תיקייה' : 'Replace directory', exact: true }).check();
      assert.equal(await inspector.locator('input[value="/srv/app/"]').count(), 1);
      await inspector.locator('.selectTrigger').first().click();
      await page.getByRole('option').filter({ hasText: 'config.json' }).click();
      await inspector.locator('.selectTrigger').first().click();
      await page.getByRole('option').filter({ hasText: '#10' }).click();
      assert.ok(!await inspector.getByRole('checkbox', { name: he ? 'החלפת תיקייה' : 'Replace directory', exact: true }).isChecked(), 'changing the source clears destructive replacement');
      assert.deepEqual(errors, []);
      // Enforce server-provided count limits before uploading.
      state.maxFiles = 2;
      await page.goto(`${process.env.UI_TEST_URL ?? 'http://127.0.0.1:4187'}/files`);
      await page.locator('input[webkitdirectory]').setInputFiles(folder);
      await page.getByRole('dialog').getByText(he ? 'התיקייה שנבחרה חורגת ממגבלות ההעלאה.' : 'The selected folder exceeds the upload limits.', { exact: true }).waitFor();
      assert.ok(await page.getByRole('dialog').getByRole('button', { name: confirm, exact: true }).isDisabled());
    } finally { await page.close(); }
  }
  console.log('Folder packages: EN/HE mobile preview, executable selection, multipart upload, retry, tree, workflow destination, file compatibility and limits passed.');
} finally {
  await browser.close();
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'autoops-folder-ui-'));
  await rm(root, { recursive: true, force: true });
}
