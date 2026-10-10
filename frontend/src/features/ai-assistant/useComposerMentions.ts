import { useEffect, useId, useState, type KeyboardEvent, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Machine, StoredFile } from '../../types/api';
import { get } from '../../services/client';
import { formatBytes } from '../../utils/format';
import { MAX_FILES, MAX_SERVERS, referencesOf, tag, type Doc, type Sigil } from './editor/mentionDoc';
import type { EditorHandle, TextRange } from './editor/MentionEditor';
import { mentionAt, type MentionOption, type MentionQuery } from './mentionModel';

type Active = MentionQuery & { node: Text };

/** Picker state for the inline editor: follows the caret, lists matches, and inserts the chosen tag where the query was typed. */
export function useComposerMentions({ editor, doc, disabled }: {
  editor: RefObject<EditorHandle | null>; doc: Doc; disabled: boolean;
}) {
  const id = useId();
  const [mention, setMention] = useState<Active | null>(null);
  const [active, setActive] = useState(0);
  const refs = referencesOf(doc);
  const servers = useQuery({ queryKey: ['machines'], queryFn: () => get<Machine[]>('/machines'), enabled: mention?.symbol === '@' && !disabled });
  const files = useQuery({ queryKey: ['files'], queryFn: () => get<StoredFile[]>('/files'), enabled: mention?.symbol === '#' && !disabled });
  const query = mention?.symbol === '@' ? servers : files;
  const atLimit = mention?.symbol === '@' ? refs.servers.length >= MAX_SERVERS : refs.files.length >= MAX_FILES;
  const needle = mention?.query.toLocaleLowerCase() ?? '';
  const options: MentionOption[] = (mention?.symbol === '@'
    ? (servers.data ?? []).map((s) => ({ id: s.id, label: s.name, detail: s.hostname, selected: refs.servers.some((m) => m.id === s.id) }))
    : (files.data ?? []).map((f) => ({ id: f.id, label: f.filename, detail: formatBytes(f.size), selected: refs.files.some((a) => a.id === f.id) })))
    .filter((option) => `${option.label} ${option.detail} ${option.id}`.toLocaleLowerCase().includes(needle))
    .map((option) => ({ ...option, disabled: option.selected || atLimit }));
  const activeIndex = Math.min(active, Math.max(0, options.length - 1));
  useEffect(() => {
    if (mention) document.getElementById(`${id}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, activeIndex, mention]);

  useEffect(() => setActive(0), [mention?.symbol, mention?.query]);
  const detect = () => {
    const at = disabled ? null : editor.current?.caret() ?? null;
    const found = at && mentionAt(at.node.data, at.offset);
    setMention(found && at ? { ...found, node: at.node } : null);
  };
  const range = (m: Active): TextRange => ({ node: m.node, start: m.start, end: m.end });
  const close = () => {
    if (mention && !mention.query) editor.current?.deleteRange(range(mention));
    setMention(null);
  };
  const select = (option: MentionOption) => {
    if (!mention || option.disabled || disabled) return;
    const label = mention.symbol === '@' ? servers.data?.find((s) => s.id === option.id)?.name : files.data?.find((f) => f.id === option.id)?.filename;
    if (label === undefined) return;
    editor.current?.insert(tag(mention.symbol, option.id, label), range(mention));
    setMention(null);
  };
  const keyDown = (event: KeyboardEvent) => {
    if (!mention) return false;
    if (event.key === 'Escape') { event.preventDefault(); close(); return true; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % (options.length || 1));
      return true;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); if (options[activeIndex]) select(options[activeIndex]); return true;
    }
    if (event.key === 'Tab') setMention(null);
    return false;
  };
  return { id, mention, options, activeIndex, atLimit, query, detect, close, select, keyDown, setActive,
    open: (sigil: Sigil) => { if (!disabled) editor.current?.trigger(sigil); }, dismiss: () => setMention(null) };
}
