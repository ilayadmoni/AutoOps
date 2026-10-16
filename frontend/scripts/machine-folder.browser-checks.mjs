import assert from 'node:assert/strict';

export async function verifyFolderBrowser(page) {
  const nav = page.getByRole('navigation', { name: 'Folder navigation', exact: true });
  const heading = name => page.getByRole('heading', { name, exact: true });
  const folder = name => page.locator('.machineFolderCard').filter({ has: heading(name) });
  await heading('Unfiled node').waitFor();
  assert.equal(await heading('App node').count(), 0, 'nested VM stays inside its folder');
  assert.equal(await heading('Lab node').count(), 0);
  assert.equal(await page.locator('details').count(), 0, 'machine browser has no accordions');
  assert.equal(await page.locator('.machineFolderFilter').count(), 0);
  await folder('Lab').click();
  await heading('Lab node').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('folder'), '1');
  assert.equal(await heading('Unfiled node').count(), 0);
  assert.equal(await heading('App node').count(), 0);
  await folder('Apps').focus();
  await page.keyboard.press('Enter');
  await heading('App node').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('folder'), '2');
  await nav.getByRole('link', { name: 'Lab', exact: true }).waitFor();
  await page.goBack();
  await heading('Lab node').waitFor();
  await page.goForward();
  await heading('App node').waitFor();
  // A newly added VM should inherit the current folder.
  await page.locator('.fab').click();
  await page.getByRole('menuitem', { name: 'Add machine', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add machine', exact: true });
  assert.equal(await form.locator('select[name="folderId"]').inputValue(), '2');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await nav.getByRole('link', { name: 'All machines', exact: true }).click();
  await heading('Unfiled node').waitFor();
  await folder('Empty').click();
  await page.getByText('This folder is empty', { exact: true }).waitFor();
  await nav.getByRole('link', { name: 'All machines', exact: true }).click();
  // A nested match keeps its ancestor folder discoverable from the root.
  await page.getByRole('searchbox').fill('app.example');
  await folder('Lab').waitFor();
  assert.equal(await folder('Lab').count(), 1);
  assert.equal(await heading('Unfiled node').count(), 0);
  await folder('Lab').click();
  assert.equal(await page.getByRole('searchbox').inputValue(), '', 'navigation clears the search');
  await nav.getByRole('link', { name: 'All machines', exact: true }).click();
  await page.locator('main').screenshot({ path: 'D:/AutoOps/frontend/dist/machine-folder-browser.png' });
}
