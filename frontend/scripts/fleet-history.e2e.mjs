import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { installFleetFixtures } from './fleet-fixtures.mjs';

const base = process.env.AUTOOPS_UI_URL ?? 'http://localhost:5173';
const output = new URL('../../.cache/fleet-ui/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const state = await installFleetFixtures(page);
try {
  await page.goto(base + '/workflows');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('searchbox').fill('Alpha');
  const alpha = dialog.locator('.check.boxed').filter({ hasText: 'Alpha' });
  await alpha.getByText('Run previously', { exact: true }).waitFor();
  assert.equal(await dialog.locator('input[type="checkbox"]:checked').count(), 0, 'History must never preselect machines');
  assert.equal(await dialog.getByRole('button', { name: 'Start', exact: true }).isDisabled(), true);
  await dialog.getByRole('searchbox').fill('Beta');
  assert.equal(await dialog.locator('.check.boxed').filter({ hasText: 'Beta' }).getByText('Run previously').count(), 0);
  await dialog.getByRole('searchbox').fill('Alpha');
  await page.screenshot({ path: fileURLToPath(new URL('workflow-history-desktop.png', output)) });
  await dialog.getByRole('checkbox', { name: /Select all machines in Operations, including subfolders/ }).check();
  assert.equal(await dialog.getByRole('button', { name: 'Start', exact: true }).isEnabled(), true);
  assert((await dialog.innerText()).includes('2 selected.'));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: fileURLToPath(new URL('workflow-history-mobile.png', output)) });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  state.history = [702];
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await dialog.getByRole('searchbox').fill('Beta');
  await dialog.locator('.check.boxed').filter({ hasText: 'Beta' }).getByText('Run previously', { exact: true }).waitFor();
  assert.equal(await dialog.locator('input[type="checkbox"]:checked').count(), 0);
  console.log('PASS: historical markers, no automatic selection, folder scope during search, fresh history on reopen, mobile layout');
} finally { await browser.close(); }
