import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ArrowUp, FolderOpen, Monitor, Plus, Server } from 'lucide-react';
import { useI18n } from '../../app/providers/I18nProvider';
import { FileChip, FilePicker, IconButton, Menu, Spinner } from '../../components/ui';
import type { StoredFile } from '../../types/api';
import MentionEditor, { type EditorHandle } from './editor/MentionEditor';
import { MAX_FILES, MAX_LENGTH, isEmpty, referencesOf, serialize, tag, type Doc } from './editor/mentionDoc';
import { useComposerMentions } from './useComposerMentions';
import { useMentionCopy } from './mentionCopy';
import MentionPicker from './MentionPicker';

export default function Composer({ doc, onChange, onSubmit, disabled, busy, uploading, onUpload }: {
  doc: Doc;
  onChange: (doc: Doc) => void;
  onSubmit: () => void;
  disabled?: boolean;
  busy?: boolean;
  uploading?: string | null;
  /** Uploads a file and resolves to the stored file, which is then inserted as an inline tag. */
  onUpload: (file: File) => Promise<StoredFile>;
}) {
  const { t } = useI18n();
  const copy = useMentionCopy();
  const editor = useRef<EditorHandle>(null);
  const locked = !!(disabled || busy || uploading);
  const picker = useComposerMentions({ editor, doc, disabled: locked });
  const length = serialize(doc).length;

  // The page clears the composer after sending; the editor owns its DOM, so mirror an emptied document into it.
  useEffect(() => { if (isEmpty(doc)) editor.current?.clear(); }, [doc]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (picker.keyDown(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  const files = referencesOf(doc).files.length;
  const canSend = !isEmpty(doc) && length <= MAX_LENGTH && !busy && !disabled && !uploading;
  const canAttach = !locked && files < MAX_FILES;
  const remaining = MAX_LENGTH - length;
  return (
    <div className="composerWrap">
      <form className="composer" onSubmit={(e) => { e.preventDefault(); if (canSend) onSubmit(); }}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) picker.dismiss(); }}>
        <MentionPicker picker={picker} />
        {uploading && (
          <div className="composerFiles">
            <span className="composerUploading"><Spinner /> <FileChip name={uploading} busy /></span>
          </div>
        )}
        <MentionEditor
          ref={editor}
          placeholder={t('ai.placeholder')} label={t('ai.placeholder')} disabled={disabled || busy}
          removeLabel={(sigil) => (sigil === '@' ? copy.removeServer : t('ai.removeFile'))}
          onChange={(next) => onChange(next)} onCaret={picker.detect} onKeyDown={onKeyDown}
          aria={{
            'aria-expanded': !!picker.mention,
            'aria-controls': picker.mention ? picker.id : undefined,
            'aria-activedescendant': picker.mention && picker.options.length ? `${picker.id}-${picker.activeIndex}` : undefined,
          }}
        />
        <div className="composerBar">
          <FilePicker onPick={(file) => {
            if (file) void onUpload(file).then((stored) => editor.current?.insert(tag('#', stored.id, stored.filename))).catch(() => undefined);
          }} disabled={!canAttach}>
            {(open) => (
              <Menu
                label={copy.add} side="top"
                items={[
                  { key: 'pc', label: copy.fromPc, hint: copy.fromPcHint, icon: <Monitor />, onSelect: () => { if (canAttach) open(); } },
                  { key: 'file', label: copy.storedFile, hint: copy.storedFileHint, icon: <FolderOpen />, onSelect: () => { if (canAttach) picker.open('#'); } },
                  { key: 'host', label: copy.host, hint: copy.hostHint, icon: <Server />, onSelect: () => picker.open('@') },
                ]}
                trigger={
                  <IconButton
                    className="composerAttach" label={copy.add} disabled={locked}
                    hint={files >= MAX_FILES ? t('ai.attachLimit', { n: MAX_FILES }) : undefined}
                  >
                    <Plus size={18} />
                  </IconButton>
                }
              />
            )}
          </FilePicker>
          {remaining < 400 && <span className="composerCount" aria-live="polite">{remaining}</span>}
          <IconButton className="composerSend" type="submit" disabled={!canSend} label={t('ai.send')}>
            <ArrowUp size={18} />
          </IconButton>
        </div>
      </form>
    </div>
  );
}
