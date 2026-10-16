export const initialFile = { id: 1, filename: 'config.json', size: 7, checksum: 'a'.repeat(64), createdAt: '2026-10-16T10:00:00Z', referencedBy: [] };
export async function setupFolders(browser, lang) {
  const page = await browser.newPage({ viewport: { width: lang === 'he' ? 390 : 1366, height: 900 } });
  const state = { files: [initialFile], uploads: [], fail: true, maxFiles: 1000 };
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(language => localStorage.setItem('autoops.lang', language), lang);
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === '/api/files/folders' && request.method() === 'POST') {
      const body = request.postDataBuffer().toString('utf8'); state.uploads.push(body);
      if (state.fail) { state.fail = false; return route.fulfill({ status: 400, json: { message: 'Test upload failure' } }); }
      const saved = { ...initialFile, id: 10, filename: 'app.tar.gz', folderName: 'app', fileCount: 3 };
      state.files.push(saved); return route.fulfill({ status: 201, json: saved });
    }
    if (path === '/api/files' && request.method() === 'POST') {
      const saved = { ...initialFile, id: 2, filename: 'single.txt' }; state.files.push(saved);
      return route.fulfill({ status: 201, json: saved });
    }
    const data = path === '/api/auth/refresh' ? { accessToken: 'test-token' }
      : path === '/api/auth/me' ? { id: 1, username: 'operator', role: 'USER' }
      : path === '/api/files' ? state.files
      : path === '/api/files/folders/limits' ? { maxFiles: state.maxFiles, maxBytes: 1000000 }
      : path === '/api/files/10/manifest' ? [{ path: 'config/app.conf', size: 5, checksum: 'a', executable: false }, { path: 'bin/run.sh', size: 6, checksum: 'b', executable: true }]
      : path === '/api/workflows/5' ? { id: 5, name: 'Deploy folder', description: '', version: 1, nodes: [{
        key: 's1', type: 'FILE_TRANSFER', name: 'Deploy package', storedFileId: 10, destinationPath: '/srv/app/', overwrite: false,
        useSudo: false, requiresApproval: false, timeoutSeconds: 300, successNext: null, failureNext: null,
      }] } : [];
    return route.fulfill({ json: data });
  });
  await page.goto(`${process.env.UI_TEST_URL ?? 'http://127.0.0.1:4187'}/files`);
  return { page, state, errors };
}
