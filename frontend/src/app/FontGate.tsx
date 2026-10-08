import { useEffect, useState, type ReactNode } from 'react';
import { BootLoader } from '../components/ui';

/** Every face the UI draws with, with a sample character so a unicode-range face actually downloads. */
const FACES: [font: string, sample?: string][] = [
  ['400 1em Roboto'],
  ['400 1em "Google Sans"', 'א'],
  ['400 1em "IBM Plex Mono"'],
  ['500 1em "IBM Plex Mono"'],
  ['600 1em "IBM Plex Mono"'],
];
/** A slow or failed font must not lock anyone out: past this, the app opens with whatever loaded. */
const TIMEOUT_MS = 10000;

// Created on first mount, not at import: main.tsx imports this module before the stylesheet, and
// document.fonts.load() resolves empty while no @font-face is declared yet. Shared, so it runs once.
let fontsReady: Promise<void> | null = null;
const loadFonts = () => fontsReady ??= Promise.race([
  Promise.allSettled(FACES.map(([font, sample]) => document.fonts.load(font, sample))).then(() => undefined),
  new Promise<void>((resolve) => setTimeout(resolve, TIMEOUT_MS)),
]);

/** Holds the app behind the boot loader until the self-hosted fonts are in, so text never reflows or flashes. */
export default function FontGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    loadFonts().then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  return ready ? <>{children}</> : <BootLoader />;
}
