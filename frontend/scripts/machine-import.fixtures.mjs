export const rows = [
  { index: 0, name: 'App node', hostname: 'app.example', sshPort: 2222, username: 'ops', folderPath: 'Lab/Apps', protocol: 'SSH', skipReason: null, warnings: [] },
  { index: 1, name: 'Database', hostname: 'db.example', sshPort: 22, username: 'dbadmin', folderPath: 'Lab/Data', protocol: 'SSH', skipReason: null, warnings: ['PRIVATE_KEY'] },
  { index: 2, name: 'Windows host', hostname: 'win.example', sshPort: 3389, username: 'admin', folderPath: 'Lab', protocol: 'RDP', skipReason: 'WINDOWS', warnings: [] },
  { index: 3, name: 'Existing host', hostname: 'old.example', sshPort: 22, username: 'ops', folderPath: '', protocol: 'SSH', skipReason: 'DUPLICATE', warnings: [] },
];

export async function mockMachineImport(page) {
  const state = { payload: undefined, imported: false };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = {};
    if (path === '/api/auth/refresh') data = { accessToken: 'browser-test-token' };
    if (path === '/api/auth/me') data = { id: 1, username: 'operator', role: 'USER' };
    if (path === '/api/machines') data = state.imported ? [
      { id: 91, name: 'App node', hostname: 'app.example', sshPort: 2222, folderId: 2, trustStatus: 'UNTRUSTED' },
      { id: 92, name: 'Unfiled node', hostname: 'root.example', sshPort: 22, folderId: null, trustStatus: 'UNTRUSTED' },
      { id: 93, name: 'Lab node', hostname: 'lab.example', sshPort: 22, folderId: 1, trustStatus: 'UNTRUSTED' },
    ] : [];
    if (path === '/api/machine-folders') data = state.imported ? [
      { id: 1, name: 'Lab', path: 'Lab', parentId: null },
      { id: 2, name: 'Apps', path: 'Lab/Apps', parentId: 1 },
      { id: 3, name: 'Empty', path: 'Empty', parentId: null },
    ] : [];
    if (path === '/api/credentials') data = [];
    if (path === '/api/machines/import/preview') data = { rows };
    if (path === '/api/machines/import') {
      state.payload = route.request().postDataBuffer().toString();
      state.imported = true;
      data = { imported: 1, skipped: 3, failed: 0, outcomes: rows.map(row => ({
        index: row.index, name: row.name, status: row.index === 0 ? 'IMPORTED' : 'SKIPPED',
        reason: row.index === 0 ? null : row.skipReason ?? 'NOT_SELECTED', machineId: row.index === 0 ? 91 : null,
      })) };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return state;
}
