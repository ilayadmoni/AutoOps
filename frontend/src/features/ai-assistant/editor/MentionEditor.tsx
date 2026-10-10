import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent } from 'react';
import { useI18n } from '../../../app/providers/I18nProvider';
import { caret, chip, editingMode, insertTag, placeCaret, read, render } from './editorDom';
import { isEmpty, type Doc, type Sigil, type Tag } from './mentionDoc';

export type TextRange = { node: Text; start: number; end: number };

export type EditorHandle = {
  focus: () => void;
  clear: () => void;
  setDoc: (doc: Doc) => void;
  /** Replaces `range` (or the caret) with an inline tag followed by a space. */
  insert: (tag: Tag, range?: TextRange) => void;
  /** Types a trigger character at the caret so the picker opens. Returns false when it cannot. */
  trigger: (sigil: Sigil) => boolean;
  deleteRange: (range: TextRange) => void;
  caret: () => { node: Text; offset: number } | null;
};

type Props = {
  placeholder: string;
  label: string;
  removeLabel: (sigil: Sigil) => string;
  disabled?: boolean;
  onChange: (doc: Doc) => void;
  /** Fires whenever the caret may have moved, so the picker can follow it. */
  onCaret: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  aria: HTMLAttributes<HTMLDivElement>;
};

/**
 * A small contenteditable editor whose content is text plus atomic resource tags. The DOM is the editing surface
 * and `onChange` reports the explicit document model; tags are never inferred from names in the text.
 */
const MentionEditor = forwardRef<EditorHandle, Props>(function MentionEditor(
  { placeholder, label, removeLabel, disabled, onChange, onCaret, onKeyDown, aria }, ref) {
  const { dir: pageDir } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  const mode = useMemo(editingMode, []);
  const latest = useRef({ onChange, onCaret });
  latest.current = { onChange, onCaret };

  const emit = () => {
    const doc = read(root.current!);
    setEmpty(isEmpty(doc));
    latest.current.onChange(doc);
    latest.current.onCaret();
  };

  useEffect(() => {
    const follow = () => { if (root.current?.contains(document.getSelection()?.anchorNode ?? null)) latest.current.onCaret(); };
    document.addEventListener('selectionchange', follow);
    return () => document.removeEventListener('selectionchange', follow);
  }, []);

  useImperativeHandle(ref, () => ({
    focus: () => root.current?.focus(),
    clear: () => { if (!isEmpty(read(root.current!))) { root.current!.replaceChildren(); emit(); } },
    setDoc: (doc) => { render(root.current!, doc, removeLabel); emit(); },
    insert: (tag, range) => {
      const el = root.current!;
      const at = range ?? (() => { const c = caret(el); return c && { node: c.node, start: c.offset, end: c.offset }; })();
      if (at) insertTag(at.node, at.start, at.end, chip(tag, removeLabel(tag.symbol)));
      else {
        const text = document.createTextNode(' ');
        el.append(chip(tag, removeLabel(tag.symbol)), text);
        placeCaret(text, 1);
      }
      el.focus(); emit();
    },
    trigger: (sigil) => {
      const el = root.current!;
      el.focus();
      const c = caret(el);
      const text = c ? c.node.data : '';
      const spaced = c && c.offset > 0 && !/[\s(]/.test(text[c.offset - 1]) ? ' ' : '';
      if (c) { c.node.insertData(c.offset, spaced + sigil); placeCaret(c.node, c.offset + spaced.length + 1); }
      else { const node = document.createTextNode(sigil); el.append(node); placeCaret(node, 1); }
      emit();
      return true;
    },
    deleteRange: ({ node, start, end }) => {
      node.deleteData(start, end - start); placeCaret(node, start); root.current?.focus(); emit();
    },
    caret: () => (root.current ? caret(root.current, false) : null),
  }));

  const onClick = (event: React.MouseEvent) => {
    const button = (event.target as HTMLElement).closest('[data-remove]');
    if (!button || disabled) return;
    const tag = button.parentElement!;
    const next = tag.nextSibling;
    tag.remove();
    if (next?.nodeType === Node.TEXT_NODE) placeCaret(next, 0); else root.current?.focus();
    emit();
  };

  return (
    <div
      ref={root} className="mentionEditor" data-empty={empty || undefined} data-placeholder={placeholder}
      contentEditable={disabled ? false : mode} suppressContentEditableWarning spellCheck dir={empty ? pageDir : 'auto'}
      role="combobox" aria-multiline="true" aria-label={label} aria-disabled={disabled} aria-autocomplete="list" aria-haspopup="listbox"
      tabIndex={disabled ? -1 : 0} {...aria}
      onInput={emit} onClick={onClick}
      onKeyDown={(event) => { if (!event.nativeEvent.isComposing) onKeyDown(event); }}
      onPaste={(event) => {
        if (mode === 'plaintext-only') return;
        event.preventDefault();
        document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
      }}
    />
  );
});

export default MentionEditor;
