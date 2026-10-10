import { tag, type Doc, type Sigil, type Tag } from './mentionDoc';

/** Plain-text editing keeps paste and line breaks as text; browsers without it fall back to rich editing. */
export function editingMode(): 'plaintext-only' | 'true' {
  const probe = document.createElement('div');
  try { probe.contentEditable = 'plaintext-only'; } catch { return 'true'; }
  return probe.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true';
}

const textNode = (text: string) => document.createTextNode(text);

/** An atomic, non-editable tag. Its remove button is found by `data-remove`, so one delegated handler serves all tags. */
export function chip(t: Tag, removeLabel: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'mentionTag ' + (t.symbol === '@' ? 'isServer' : 'isFile');
  el.contentEditable = 'false';
  el.dataset.symbol = t.symbol; el.dataset.id = String(t.id); el.dataset.label = t.label;
  const name = document.createElement('span');
  const sign = document.createElement('span');
  sign.setAttribute('aria-hidden', 'true'); sign.textContent = t.symbol;
  const text = document.createElement('span');
  text.dir = 'auto'; text.textContent = t.label;
  name.append(sign, text);
  const remove = document.createElement('button');
  remove.type = 'button'; remove.tabIndex = -1; remove.dataset.remove = '1';
  remove.setAttribute('aria-label', `${removeLabel}: ${t.label}`); remove.textContent = '×';
  el.append(name, remove);
  return el;
}

export function render(root: HTMLElement, doc: Doc, removeLabel: (symbol: Sigil) => string) {
  root.replaceChildren(...doc.map((p) => (p.kind === 'tag' ? chip(p, removeLabel(p.symbol)) : textNode(p.text))));
}

export function read(root: HTMLElement): Doc {
  const doc: Doc = [];
  const push = (text: string) => {
    const last = doc[doc.length - 1];
    if (last?.kind === 'text') last.text += text; else if (text) doc.push({ kind: 'text', text });
  };
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child instanceof HTMLElement && child.dataset.id) doc.push(tag(child.dataset.symbol as Sigil, Number(child.dataset.id), child.dataset.label ?? ''));
      else if (child.nodeName === 'BR') push('\n');
      else if (child.nodeType === Node.TEXT_NODE) push(child.textContent ?? '');
      else { if (doc.length && child.nodeName === 'DIV') push('\n'); walk(child); }
    });
  };
  walk(root);
  return doc;
}

/** The text node holding the caret and the caret's offset in it, when the selection is collapsed inside `root`. */
export function caret(root: HTMLElement, create = true): { node: Text; offset: number } | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed || !root.contains(sel.anchorNode)) return null;
  const { anchorNode: node, anchorOffset: offset } = sel;
  if (node?.nodeType === Node.TEXT_NODE) return { node: node as Text, offset };
  if (node !== root || !create) return null;
  const empty = textNode('');
  root.insertBefore(empty, root.childNodes[offset] ?? null);
  return { node: empty, offset: 0 };
}

export function placeCaret(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset); range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges(); sel?.addRange(range);
}

/** Swaps `[start, end)` of a text node for a tag followed by a space, and puts the caret after the space. */
export function insertTag(node: Text, start: number, end: number, el: HTMLElement) {
  const after = node.splitText(end);
  node.data = node.data.slice(0, start);
  node.after(el);
  const gap = after.data.startsWith(' ') ? after : textNode(' ');
  if (gap !== after) el.after(gap);
  placeCaret(gap, 1);
}
