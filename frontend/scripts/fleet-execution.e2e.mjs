import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { installFleetFixtures } from './fleet-fixtures.mjs';

const base = process.env.AUTOOPS_UI_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
const output = new URL('../../.cache/fleet-ui/', import.meta.url);
await mkdir(output, { recursive: true });
const state = await installFleetFixtures(page);
const firstName = () => page.locator('.executionColumn h2').first().innerText();
const waitForServer = name => page.waitForFunction(value => document.querySelector('.executionColumn h2')?.textContent === value, name, { timeout: 10000 });
try {
  await page.goto(base + '/executions/999001');
  await waitForServer('Test server 1');
  assert.equal(await page.locator('.executionColumn').count(), 3);
  state.execution.machines.forEach((m, i) => { if (i < 6) m.status = i < 3 ? 'SUCCESS' : 'RUNNING'; });
  state.execution.summary.succeededMachines = 3;
  await waitForServer('Test server 4');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  state.execution.machines.forEach((m, i) => { m.status = i < 6 ? 'SUCCESS' : 'RUNNING'; });
  await page.waitForTimeout(2500);
  assert.equal(await firstName(), 'Test server 1', 'Manual navigation must pause automatic following');
  await page.getByRole('button', { name: 'Follow execution', exact: true }).click();
  await waitForServer('Test server 7');
  assert.equal(await page.locator('.executionColumn').count(), 2);
  state.execution.machines.forEach(m => { m.status = 'SUCCESS'; });
  state.execution.summary.status = 'SUCCESS'; state.execution.summary.succeededMachines = 8;
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'First page', exact: true }).click();
  assert.equal(await firstName(), 'Test server 1');
  await page.getByRole('button', { name: 'Page 2 of 3', exact: true }).click();
  assert.equal(await firstName(), 'Test server 4');
  assert.equal(await page.getByRole('button', { name: 'Page 2 of 3', exact: true }).getAttribute('aria-current'), 'page');
  await page.waitForTimeout(250); // Capture the settled design-system color transition.
  await page.screenshot({ path: fileURLToPath(new URL('execution-pager-desktop.png', output)) });
  await page.getByRole('button', { name: 'Last page', exact: true }).click();
  assert.equal(await firstName(), 'Test server 7');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.reload(); await waitForServer('Test server 1');
  assert.equal(await firstName(), 'Test server 1', 'Opening completed history should start at page one');
  await page.locator('.appControls button').first().click();
  await page.locator('.appControls button').nth(1).click();
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
  await page.waitForTimeout(250);
  await page.screenshot({ path: fileURLToPath(new URL('execution-pager-mobile-rtl-light.png', output)) });
  await page.setViewportSize({ width: 320, height: 844 });
  assert.equal(await page.evaluate(() => {
    const pager = document.querySelector('.executionPager');
    return pager.scrollWidth > pager.clientWidth || document.documentElement.scrollWidth > innerWidth;
  }), false, 'Compact RTL pager must fit narrow touch screens');
  console.log('PASS: automatic advance, manual pause/resume, partial last page, completed navigation and mobile layout');
} finally { await browser.close(); }
