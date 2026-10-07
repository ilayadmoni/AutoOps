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

/** styles.css is only an import manifest, so assertions run against every layer it pulls in. */
const allStyles = async () => {
  const dir = new URL('../src/styles/', import.meta.url);
  const files = await readdir(dir);
  const parts = await Promise.all(files.filter((f) => f.endsWith('.css')).map((f) => readFile(new URL(f, dir), 'utf8')));
  return parts.join('\n');
};

test('uses the supplied AutoOps logo asset in the shared brand', async () => {
  const brand = await source('src/shared/ui/Brand.tsx');
  assert.match(brand, /AutoOpsLogo\.png/);
  assert.match(brand, /alt="AutoOps"/);
});

test('renders the supplied boot and inline loader family', async () => {
  const [app, loaders, styles] = await Promise.all([
    source('src/App.tsx'),
    source('src/shared/ui/Loaders.tsx'),
    allStyles(),
  ]);
  assert.match(app, /<BootLoader/);
  assert.match(loaders, /role="status"/);
  assert.match(loaders, /SkeletonList/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});

test('implements the bilingual split login with a password reveal', async () => {
  const login = await source('src/features/auth/LoginPage.tsx');
  assert.match(login, /loginShell/);
  assert.match(login, /LoginLanguageToggle/);
  assert.match(login, /PasswordInput/);
  // The submit control is the shared Button now; `busy` is what sets aria-busy and blocks
  // double submits, so the prop is the thing worth asserting.
  assert.match(login, /busy=\{busy\}/);
});

test('uses option C controls in the sidebar footer', async () => {
  const [layout, footer] = await Promise.all([
    source('src/layouts/AppLayout.tsx'),
    source('src/layouts/SidebarFooter.tsx'),
  ]);
  assert.match(layout, /<SidebarFooter/);
  assert.match(footer, /Globe2/);
  assert.match(footer, /langCode/);
  assert.match(footer, /toggleTheme/);
});
