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

test('draws the AutoOps brand as a themed vector with an accessible name', async () => {
  // The supplied raster carries a black plate that showed as a box on light surfaces, so the
  // mark is redrawn from it as SVG; the wordmark must still announce itself as AutoOps.
  const brand = await source('src/components/ui/Brand.tsx');
  assert.match(brand, /<svg/);
  assert.match(brand, /aria-label="AutoOps"/);
  assert.doesNotMatch(brand, /<img/);
});

test('floating layers are shared, portalled primitives', async () => {
  const [tooltip, select, menu, index] = await Promise.all([
    source('src/components/ui/Tooltip.tsx'),
    source('src/components/ui/Select.tsx'),
    source('src/components/ui/Menu.tsx'),
    source('src/components/ui/index.tsx'),
  ]);
  for (const layer of [tooltip, select, menu]) {
    assert.match(layer, /createPortal/);
    assert.match(layer, /useFloating/);
  }
  assert.match(index, /Tooltip/);
  assert.match(index, /Menu/);
  assert.match(index, /Select/);
});

test('the workflow canvas lives in the components folder and the assistant splits to show it', async () => {
  const [canvas, builder, assistant] = await Promise.all([
    source('src/components/ui/flow/FlowCanvas.tsx'),
    source('src/pages/workflows/WorkflowBuilderPage.tsx'),
    source('src/pages/ai-assistant/AIAssistantPage.tsx'),
  ]);
  assert.match(canvas, /@xyflow\/react/);
  assert.match(builder, /components\/ui\/flow/);
  assert.match(assistant, /WorkflowWorkspace/);
  assert.match(assistant, /split/);
});

test('renders the supplied boot and inline loader family', async () => {
  const [app, loaders, styles] = await Promise.all([
    source('src/app/App.tsx'),
    source('src/components/ui/Loaders.tsx'),
    allStyles(),
  ]);
  assert.match(app, /<BootLoader/);
  assert.match(loaders, /role="status"/);
  assert.match(loaders, /SkeletonList/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});

test('implements the bilingual split login with a password reveal', async () => {
  const login = await source('src/pages/auth/LoginPage.tsx');
  assert.match(login, /loginShell/);
  assert.match(login, /<AppControls/);
  assert.match(login, /PasswordInput/);
  // The submit control is the shared Button now; `busy` is what sets aria-busy and blocks
  // double submits, so the prop is the thing worth asserting.
  assert.match(login, /busy=\{busy\}/);
});

test('puts language and theme buttons in a floating pill, opposite the sidebar', async () => {
  const [layout, footer, controls] = await Promise.all([
    source('src/app/layout/AppLayout.tsx'),
    source('src/app/layout/SidebarFooter.tsx'),
    source('src/components/AppControls.tsx'),
  ]);
  assert.match(layout, /<SidebarFooter/);
  assert.match(layout, /className="appFloat"><AppControls/);
  assert.match(controls, /Globe2/);
  assert.match(controls, /langCode/);
  assert.match(controls, /toggleTheme/);
  assert.doesNotMatch(footer, /setLang|setTheme/);
});
