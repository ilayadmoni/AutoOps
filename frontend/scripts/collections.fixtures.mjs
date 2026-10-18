export async function collectionFixtures(page, lang) {
  const state = { user: 1, role: 'USER', favorites: new Map(), deletes: [], failFavorite: false,
    folders: [{ id: 10, name: 'Lab', path: 'Lab', parentId: null }] };
  const now = '2026-10-18T09:00:00Z';
  const common = id => ({ id, name: `Item ${id}`, createdAt: now, updatedAt: now });
  state.items = {
    workflows: [1, 2, 3].map(id => ({ ...common(id), stepCount: 1 })),
    credentials: [1, 2, 3].map(id => ({ ...common(id), username: 'ops', authType: 'PASSWORD' })),
    files: [1, 2, 3].map(id => ({ id, filename: `Item ${id}`, checksum: 'a'.repeat(64), size: 10, createdAt: now, referencedBy: id === 3 ? ['Workflow'] : [] })),
    commands: [1, 2, 3].map(id => ({ ...common(id), commandTemplate: `echo ${id}`, parameters: [], riskLevel: 'LOW',
      status: 'APPROVED', source: 'USER', ownedByCurrentUser: id !== 3 })),
    machines: [1, 2, 3].map(id => ({ ...common(id), hostname: `node${id}`, sshPort: 22, trustStatus: 'TRUSTED', folderId: id === 1 ? 10 : null })),
  };
  await page.addInitScript(language => localStorage.setItem('autoops.lang', language), lang);
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method();
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: 'fixture' } });
    if (path === '/api/auth/me') return route.fulfill({ json: { id: state.user, username: `operator${state.user}`, role: state.role } });
    if (path === '/api/machine-folders') return route.fulfill({ json: state.folders });
    const favorite = path.match(/^\/api\/favorites\/([\w-]+)(?:\/(\d+))?$/);
    if (favorite) {
      const [, tab, id] = favorite, key = `${state.user}:${tab}`;
      if (!state.favorites.has(key)) state.favorites.set(key, new Set());
      const saved = state.favorites.get(key);
      if (method === 'GET') return route.fulfill({ json: [...saved] });
      if (state.failFavorite) { state.failFavorite = false; return route.fulfill({ status: 503, json: { message: 'Favorite save failed' } }); }
      if (method === 'PUT') saved.add(Number(id)); else saved.delete(Number(id));
      return route.fulfill({ status: 204 });
    }
    const item = path.match(/^\/api\/(workflows|commands|credentials|files|machines)(?:\/(\d+))?$/);
    if (item) {
      const [, tab, id] = item;
      if (method === 'DELETE') {
        state.deletes.push(`${tab}:${id}`);
        if (id === '2') return route.fulfill({ status: 409, json: { message: 'Item is in use' } });
        state.items[tab] = state.items[tab].filter(row => row.id !== Number(id));
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ json: state.items[tab] });
    }
    return route.fulfill({ json: [] });
  });
  return state;
}
