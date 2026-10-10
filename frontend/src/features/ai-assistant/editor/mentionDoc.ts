/** The composer's document: plain text and resource tags, each tag carrying the exact id of its server or stored file. */
export type Sigil = '@' | '#';
export type Tag = { kind: 'tag'; symbol: Sigil; id: number; label: string };
export type Part = { kind: 'text'; text: string } | Tag;
export type Doc = Part[];

export const MAX_FILES = 5;
export const MAX_SERVERS = 20;
export const MAX_LENGTH = 4000;

const KIND = { '@': 'server', '#': 'file' } as const;
const escape = (label: string) => label.replace(/[\\[\]]/g, '\\$&').replace(/\s+/g, ' ');
const TOKEN = /([@#])\[((?:\\.|[^\]\\\n])*)\]\((server|file):(\d+)\)/g;

export const tag = (symbol: Sigil, id: number, label: string): Tag => ({ kind: 'tag', symbol, id, label });
export const isTag = (part: Part): part is Tag => part.kind === 'tag';

/** What the backend and the model read: `@[Name](server:8)`, so identity never depends on a display name. */
export const tagToken = (t: Tag) => `${t.symbol}[${escape(t.label)}](${KIND[t.symbol]}:${t.id})`;

export const serialize = (doc: Doc) => doc.map((p) => (isTag(p) ? tagToken(p) : p.text)).join('').trim();

/** Inverse of {@link serialize}. Text without tokens (including historical messages) comes back as one text part. */
export function parseText(text: string): Doc {
  const doc: Doc = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if ((m[1] === '@') !== (m[3] === 'server')) continue;
    if (m.index > last) doc.push({ kind: 'text', text: text.slice(last, m.index) });
    doc.push(tag(m[1] as Sigil, Number(m[4]), m[2].replace(/\\(.)/g, '$1')));
    last = m.index + m[0].length;
  }
  if (last < text.length) doc.push({ kind: 'text', text: text.slice(last) });
  return doc;
}

export const tagsOf = (doc: Doc) => doc.filter(isTag);

/** Distinct resources referenced by the document, in first-use order. */
export function referencesOf(doc: Doc) {
  const unique = (symbol: Sigil) => [...new Map(tagsOf(doc).filter((t) => t.symbol === symbol).map((t) => [t.id, t])).values()];
  return { servers: unique('@'), files: unique('#') };
}

export const isEmpty = (doc: Doc) => serialize(doc) === '';
export const textDoc = (text: string): Doc => (text ? [{ kind: 'text', text }] : []);
