import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async (path) => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
};

/** assets/styles/index.css is only an import manifest, so assertions run against every layer it pulls in. */
const allStyles = async () => {
  const dir = new URL('../src/assets/styles/', import.meta.url);
  const files = await readdir(dir);
  const parts = await Promise.all(files.filter((f) => f.endsWith('.css')).map((f) => readFile(new URL(f, dir), 'utf8')));
  return parts.join('\n');
};

test('uses the supplied AutoOps logo asset in the shared brand', async () => {
  const brand = await source('src/components/Brand.tsx');
  assert.match(brand, /AutoOpsLogo\.png/);
  assert.match(brand, /alt="AutoOps"/);
});

test('renders the supplied boot and inline loader family', async () => {
  const [app, loaders, styles] = await Promise.all([
    source('src/app/App.tsx'),
    source('src/components/Loaders.tsx'),
    allStyles(),
  ]);
  assert.match(app, /<BootLoader/);
  assert.match(loaders, /role="status"/);
  assert.match(loaders, /SkeletonList/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});

test('implements the bilingual split login with a password reveal', async () => {
  const login = await source('src/pages/LoginPage.tsx');
  assert.match(login, /loginShell/);
  assert.match(login, /LoginLanguageToggle/);
  assert.match(login, /PasswordInput/);
  // The submit control is the shared Button now; `busy` is what sets aria-busy and blocks
  // double submits, so the prop is the thing worth asserting.
  assert.match(login, /busy=\{busy\}/);
});

test('uses option C controls in the sidebar footer', async () => {
  const [layout, footer] = await Promise.all([
    source('src/app/layout/AppLayout.tsx'),
    source('src/app/layout/SidebarFooter.tsx'),
  ]);
  assert.match(layout, /<SidebarFooter/);
  assert.match(footer, /Globe2/);
  assert.match(footer, /langCode/);
  assert.match(footer, /toggleTheme/);
});

/** Every .ts/.tsx file under a src/ folder, with its contents. */
const sourcesUnder = async (folder) => {
  const root = new URL(`../src/${folder}/`, import.meta.url);
  const entries = await readdir(root, { recursive: true });
  const files = entries.filter((f) => /\.tsx?$/.test(f));
  return Promise.all(files.map(async (f) => [`${folder}/${f}`, await readFile(new URL(f, root), 'utf8')]));
};

test('keeps HTTP calls in services: UI layers never use the raw fetch helpers', async () => {
  const ui = (await Promise.all(['app', 'components', 'features', 'hooks', 'pages'].map(sourcesUnder))).flat();
  // ApiError (for instanceof checks) and the session plumbing used by AuthProvider are allowed.
  const rawHelper = /import\s*\{[^}]*\b(api|get|post|put|patch|del|upload|getBlob|streamEvents)\b[^}]*\}\s*from\s*'[./]*lib\/apiClient'/;
  const offenders = ui.filter(([, text]) => rawHelper.test(text)).map(([file]) => file);
  assert.deepEqual(offenders, []);
  assert.ok(!ui.some(([, text]) => /(?<![\w.])fetch\(/.test(text)), 'no direct fetch() outside lib/');
});

test('pages are route views: only the router imports them', async () => {
  const others = (await Promise.all(['components', 'features', 'hooks', 'services', 'utils', 'lib', 'types'].map(sourcesUnder))).flat();
  const offenders = others.filter(([, text]) => /from\s*'[./]*pages\//.test(text)).map(([file]) => file);
  assert.deepEqual(offenders, []);
});
