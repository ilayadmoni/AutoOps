export async function setupMachines(browser, lang) {
  const page = await browser.newPage({ viewport: { width: lang === 'he' ? 390 : 1366, height: 900 } });
  const state = { deletes: [], failures: new Set([2]), active: 0, peak: 0, machines: [
    [1, 'Alpha', null], [2, 'Beta', null], [3, 'Gamma', null], [4, 'Lab one', 1], [5, 'Lab two', 1],
  ].map(([id, name, folderId]) => ({ id, name, folderId, hostname: `host-${id}.example`, sshPort: 22, trustStatus: 'TRUSTED' })) };
  state.folders = [{ id: 1, name: 'Lab', path: 'Lab', parentId: null }, { id: 9, name: 'Empty', path: 'Empty', parentId: null }];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(language => localStorage.setItem('autoops.lang', language), lang);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'DELETE' && /^\/api\/machines\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1));
      state.deletes.push(id); state.active++; state.peak = Math.max(state.peak, state.active);
      await new Promise(resolve => setTimeout(resolve, 100));
      state.active--;
      if (state.failures.has(id)) return route.fulfill({ status: 409, json: { code: 'MACHINE_IN_USE', message: 'Machine is part of an execution in progress' } });
      state.machines = state.machines.filter(machine => machine.id !== id);
      return route.fulfill({ status: 204 });
    }
    const data = path === '/api/auth/refresh' ? { accessToken: 'test-token' }
      : path === '/api/auth/me' ? { id: 1, username: 'operator', role: 'USER' }
      : path === '/api/machines' ? state.machines
      : path === '/api/machine-folders' ? state.folders : [];
    await route.fulfill({ json: data });
  });
  await page.goto(`${process.env.UI_TEST_URL ?? 'http://127.0.0.1:4184'}/machines`);
  return { page, state, errors };
}
