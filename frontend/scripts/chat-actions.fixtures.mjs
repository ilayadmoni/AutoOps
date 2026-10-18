export const workflow = { id: 5, name: 'Deploy nginx', status: 'ACTIVE', version: 1, stepCount: 1 };
export const server = { id: 8, name: 'Lab server', hostname: 'lab.example', sshPort: 22, trustStatus: 'TRUSTED', preferredCredentialId: 2 };
export const credential = { id: 2, name: 'Lab SSH', username: 'admin', authType: 'PASSWORD' };
export const form = action => ({ type: 'OFFER_ACTION_FORM', payload: { action }, missingFields: [] });
export const proposal = (type, payload) => ({ type, payload, missingFields: [] });
export const base = process.env.UI_TEST_URL ?? 'http://127.0.0.1:4179';

export async function setup(browser, { lang = 'en', mobile = false, configured = true } = {}) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1366, height: 900 } });
  const state = { chats: [], writes: [], operations: [], answer: 'Tell me the required details to continue.', failChat: false, failCredential: false };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(language => {
    localStorage.setItem('autoops.lang', language);
    localStorage.setItem('autoops.ai.historyOpen', '0');
  }, lang);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/ai/chat') {
      state.chats.push(request.postDataJSON());
      if (state.failChat) return route.fulfill({ status: 503, json: { message: 'Assistant unavailable' } });
      return route.fulfill({ json: {
        conversationId: 1, messageId: state.chats.length, message: state.answer,
        operations: state.operations, toolsUsed: [], missingFields: [],
      } });
    }
    if (request.method() === 'POST' && !path.startsWith('/api/auth/')) {
      const data = request.postDataJSON();
      state.writes.push({ path, data });
      if (path.endsWith('/run')) return route.fulfill({ status: 400, json: { message: 'Run checked without executing' } });
      if (path === '/api/credentials' && state.failCredential) return route.fulfill({ status: 400, json: { message: 'Credential save failed' } });
      return route.fulfill({ json: path === '/api/credentials' ? credential : path === '/api/machines' ? server : { id: 4, status: 'APPROVED' } });
    }
    const data = path === '/api/auth/refresh' ? { accessToken: 'test-token' }
      : path === '/api/auth/me' ? { id: 1, username: 'operator', role: 'USER' }
      : path === '/api/ai/status' ? { configured }
      : path === '/api/workflows' ? [workflow]
      : path === '/api/machines' ? [server]
      : path === '/api/credentials' ? [credential] : [];
    return route.fulfill({ json: data });
  });
  await page.goto(base);
  if (configured) await page.locator('.chatStarters .tile:enabled').first().waitFor();
  return { page, state, errors };
}
