import assert from 'node:assert/strict';

export async function verifyFolderSelection(page, dialog) {
  const folder = name => dialog.getByRole('checkbox', { name: `Select folder ${name}`, exact: true });
  const lab = dialog.locator('details[data-folder-path="Lab"]');
  const parent = folder('Lab');
  const status = text => dialog.getByText(text, { exact: true }).waitFor();
  assert.equal(await folder('Unfiled').isDisabled(), true, 'a skipped-only folder cannot be selected');
  await parent.uncheck();
  await status('0 of 4 sessions selected');
  assert.equal(await dialog.locator('details[open]').count(), 0, 'folder checkbox does not open its accordion');
  await parent.check();
  await status('2 of 4 sessions selected');
  assert.equal(await lab.getAttribute('open'), null);
  await parent.uncheck();
  await status('0 of 4 sessions selected');
  await lab.locator(':scope > summary').click();
  await folder('Lab/Apps').focus();
  await page.keyboard.press('Space');
  await status('1 of 4 sessions selected');
  assert.equal(await parent.evaluate(el => el.indeterminate), true, 'parent reflects partially selected descendants');
  assert.equal(await dialog.locator('details[open]').count(), 1, 'keyboard selection leaves child folders closed');
  await folder('Lab/Data').check();
  await status('2 of 4 sessions selected');
  assert.equal(await parent.isChecked(), true, 'skipped Windows row does not prevent full eligible selection');
  await folder('Lab/Apps').uncheck();
  await status('1 of 4 sessions selected');
  assert.equal(await folder('Lab/Data').isChecked(), true, 'sibling folder selection is preserved');
  await parent.click();
  await status('2 of 4 sessions selected');
  assert.equal(await parent.isChecked(), true, 'clicking a mixed parent selects all eligible descendants');
  await parent.uncheck();
  await status('0 of 4 sessions selected');
  await parent.check();
  await status('2 of 4 sessions selected');
  await lab.locator(':scope > summary').click();
}
