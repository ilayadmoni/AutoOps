/** Exercise the current attachment menu rather than the retired standalone buttons. */
export async function openAttachmentPicker(page, kind) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: kind === 'server' ? /^Host from AutoOps/ : /^File from AutoOps/ }).click();
}
