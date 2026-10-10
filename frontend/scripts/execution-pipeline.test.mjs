import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Start Vite on port 5178 (or set UI_TEST_URL); all API calls are intercepted, so no machines run.
const baseURL = process.env.UI_TEST_URL || 'http://localhost:5178';
const step = (id, status, extra = {}) => ({
  id, stepName: `Step ${id}`, stepType: 'COMMAND', status, attemptNumber: 1,
  runWithSudo: false, retryable: false, ...extra,
});
const detail = () => ({
  summary: { id: 42, type: 'WORKFLOW', title: 'Deploy services', status: 'RUNNING',
    mode: 'AUTOMATIC', riskLevel: 'LOW', concurrency: 2, failurePolicy: 'CONTINUE',
    machineCount: 2, succeededMachines: 0, startedBy: 1, createdAt: '2026-10-09T08:00:00Z' },
  parameters: {}, approvals: [], runWithSudo: false,
  machines: [1, 2].map((id) => ({ id, machineId: id, machineName: `Server ${id}`,
    hostname: `server-${id}.example`, status: 'RUNNING', preflight: { id, status: 'SUCCESS' },
    steps: [step(id * 10, 'SUCCESS', { stdout: 'Services ready' }),
      step(id * 10 + 1, 'RUNNING', { stepType: 'FILE_TRANSFER' })] })),
});

test('execution pipelines are vertical, update status, preserve output and fit mobile RTL', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let data = detail();
  const errors = [];
  let retryRequested = false;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/events')) return route.abort();
    if (path === '/api/executions/steps/11/retry') {
      retryRequested = true;
      data.machines[0].steps.push(step(12, 'RUNNING', { stepName: 'Step 11', attemptNumber: 2, retryOfStepRunId: 11 }));
      data.machines[0].steps[1].retryable = false;
      return route.fulfill({ json: data });
    }
    const body = path.endsWith('/auth/refresh') ? { accessToken: 'test' }
      : path.endsWith('/auth/me') ? { id: 1, username: 'operator', role: 'USER' }
      : path === '/api/executions/42' ? data : [];
    await route.fulfill({ json: body });
  });
  try {
    await page.goto(`${baseURL}/executions/42`);
    const columns = page.locator('.executionColumn');
    await columns.first().waitFor();
    assert.equal(await columns.count(), 2);
    const first = columns.first();
    const nodes = first.locator('.executionNode');
    assert.equal(await nodes.count(), 3);
    const boxes = await nodes.evaluateAll((items) => items.map((item) => {
      const box = item.getBoundingClientRect(); return { x: box.x, y: box.y };
    }));
    assert.ok(boxes[0].y < boxes[1].y && boxes[1].y < boxes[2].y);
    assert.equal(boxes[0].x, boxes[2].x);
    assert.ok((await columns.nth(1).boundingBox()).x > (await first.boundingBox()).x);
    await first.getByRole('button', { name: /Step 10/ }).click();
    assert.ok(await first.getByText('Services ready', { exact: true }).isVisible());
    data.machines[0].steps[1] = step(11, 'FAILED', { failureReason: 'Transfer refused', retryable: true });
    await first.locator('.executionNode.failed').waitFor();
    assert.ok(await first.getByText('Transfer refused', { exact: true }).isVisible());
    assert.ok(await first.getByRole('button', { name: 'Retry', exact: true }).isVisible());
    assert.equal(await first.locator('.executionNode.success').count(), 2);
    await page.screenshot({ path: join(tmpdir(), 'execution-pipeline-desktop.png'), fullPage: true });
    await first.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Retry', exact: true }).click();
    await first.getByText('attempt 2', { exact: false }).waitFor();
    assert.ok(retryRequested);
    assert.equal(await first.locator('.executionNode.failed').count(), 1);
    assert.equal(await first.locator('.executionNode.running').count(), 1);
    await page.evaluate(() => {
      localStorage.setItem('autoops.lang', 'he'); localStorage.setItem('autoops.theme', 'light');
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.locator('.executionColumn').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: join(tmpdir(), 'execution-pipeline-mobile.png'), fullPage: true });
    await page.evaluate(() => localStorage.setItem('autoops.theme', 'dark'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.locator('.executionNode.running').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('.executionNode.running .executionState svg').first()
      .evaluate((icon) => getComputedStyle(icon).animationName), 'none');
    await page.screenshot({ path: join(tmpdir(), 'execution-pipeline-dark.png'), fullPage: true });
    data = detail();
    data.summary.type = 'COMMAND';
    data.summary.status = 'PARTIAL';
    data.machines[0].preflight.status = 'FAILED';
    data.machines[0].preflight.failureReason = 'SSH connection refused';
    data.machines[0].steps = [];
    data.machines[0].status = 'FAILED';
    const states = ['SUCCESS', 'FAILED', 'WAITING_APPROVAL', 'PENDING', 'CANCELLED', 'SKIPPED'];
    data.machines[1].steps = states.map((status, index) => step(100 + index, status));
    await page.reload();
    await page.getByText('SSH connection refused', { exact: true }).waitFor();
    assert.equal(await page.locator('.executionColumn').first().locator('.executionNode').count(), 1);
    for (const status of states) {
      assert.ok(await page.locator('.executionColumn').nth(1).locator(`.executionNode.${status.toLowerCase()}`).count() > 0);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
