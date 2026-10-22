/** Deterministic browser fixtures: every API request is intercepted; no SSH or real mutations. */
export async function installFleetFixtures(page) {
  const now = '2026-10-21T12:00:00Z';
  const state = {
    folders: [
      { id: 501, name: 'Operations', path: 'Operations', parentId: null },
      { id: 502, name: 'Archive', path: 'Archive', parentId: null },
      { id: 503, name: 'Web', path: 'Operations/Web', parentId: 501 },
    ],
    machines: [
      { id: 701, name: 'Alpha', folderId: 503 }, { id: 702, name: 'Beta', folderId: 501 },
      { id: 703, name: 'Unfiled', folderId: null },
    ].map(m => ({ ...m, hostname: m.name.toLowerCase() + '.example', sshPort: 22, trustStatus: 'TRUSTED', createdAt: now })),
    calls: [], history: [701],
    execution: {
      summary: { id: 999001, type: 'WORKFLOW', title: 'Paging UI validation', status: 'RUNNING', mode: 'AUTOMATIC',
        riskLevel: 'LOW', concurrency: 3, failurePolicy: 'CONTINUE', machineCount: 8, succeededMachines: 0,
        failedMachines: 0, pendingApprovals: 0, cancelRequested: false, startedBy: -1, createdAt: now },
      parameters: {}, runWithSudo: false, approvals: [],
      machines: Array.from({ length: 8 }, (_, i) => ({ id: 990 + i, machineId: 900 + i,
        machineName: 'Test server ' + (i + 1), hostname: 'test-' + (i + 1) + '.example', status: i < 3 ? 'RUNNING' : 'PENDING', steps: [] })),
    },
  };
  await page.addInitScript(() => { localStorage.setItem('autoops.lang', 'en'); localStorage.setItem('autoops.theme', 'dark'); });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/refresh') return send({ accessToken: 'fixture-token' });
    if (path === '/auth/me') return send({ id: 999, username: 'ui-test', role: 'USER' });
    if (path.startsWith('/favorites/') || path === '/credentials') return send([]);
    if (path === '/machines' && request.method() === 'GET') return send(state.machines);
    if (path === '/machine-folders') return send(state.folders);
    if (path === '/workflows') return send([{ id: 901, name: 'Fleet check', stepCount: 1, updatedAt: now }]);
    if (path === '/workflows/901/machine-history') return send(state.history);
    if (path === '/executions/999001') return send(state.execution);
    if (path === '/executions/999001/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
    if (path === '/machines/move') {
      const body = request.postDataJSON(); state.calls.push({ path, body });
      state.machines.forEach(m => { if (body.machineIds.includes(m.id)) m.folderId = body.folderId; });
      return send(state.machines.filter(m => body.machineIds.includes(m.id)));
    }
    const move = path.match(/^\/machine-folders\/(\d+)\/move$/);
    if (move) {
      const body = request.postDataJSON(); state.calls.push({ path, body });
      const folder = state.folders.find(f => f.id === Number(move[1]));
      const old = folder.path;
      const destination = state.folders.find(f => f.id === body.folderId);
      const next = destination ? destination.path + '/' + folder.name : folder.name;
      state.folders.forEach(f => { if (f.path === old || f.path.startsWith(old + '/')) f.path = next + f.path.slice(old.length); });
      folder.parentId = body.folderId;
      return route.fulfill({ status: 204 });
    }
    if (path === '/machines/import/preview') return send({ rows: [{ index: 0, name: 'Imported test', hostname: 'imported.example',
      sshPort: 22, username: 'fixture', folderPath: 'Imported', protocol: 'SSH', skipReason: null, warnings: [] }] });
    if (path === '/machines/import') {
      const payload = request.postData() ?? '';
      const match = payload.match(/\{"baseFolderId":[\s\S]*?\}\r\n--/);
      if (!match) return send({ message: 'Missing import selection' }, 400);
      const body = JSON.parse(match[0].replace(/\r\n--$/, '')); state.calls.push({ path, body });
      const base = state.folders.find(f => f.id === body.baseFolderId);
      state.folders.push({ id: 504, name: 'Imported', path: (base ? base.path + '/' : '') + 'Imported', parentId: base?.id ?? null });
      return send({ imported: 1, skipped: 0, failed: 0, outcomes: [{ index: 0, name: 'Imported test', status: 'IMPORTED', reason: null, machineId: 704 }] });
    }
    return send({ code: 'FIXTURE_NOT_FOUND', message: 'Unmocked request: ' + path }, 404);
  });
  return state;
}
