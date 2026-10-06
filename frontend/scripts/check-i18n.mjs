// Fails the build when a literal t('key') used in the UI is missing from the English dictionary.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: on Windows the latter yields '/D:/...' and join() then doubles the drive letter.
const root = fileURLToPath(new URL('../src', import.meta.url));
const en = readFileSync(join(root, 'i18n/en.ts'), 'utf8');
const keys = new Set([...en.matchAll(/'([A-Za-z0-9_.]+)':/g)].map((m) => m[1]));
const missing = new Set();
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      for (const m of readFileSync(p, 'utf8').matchAll(/\bt\('([A-Za-z0-9_.]+)'/g)) {
        if (!m[1].endsWith('.') && !keys.has(m[1])) missing.add(m[1] + '  (' + p.replace(root, 'src') + ')');
      }
    }
  }
};
walk(root);
if (missing.size) {
  console.error('Missing i18n keys:\n  ' + [...missing].join('\n  '));
  process.exit(1);
}
console.log(`i18n: ${keys.size} keys, all literal keys present`);
