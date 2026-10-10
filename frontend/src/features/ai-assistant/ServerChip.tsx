import { Server, X } from 'lucide-react';
import type { ServerAttachment } from './attachments';
import { useMentionCopy } from './mentionCopy';

export default function ServerChip({ server, onRemove }: { server: ServerAttachment; onRemove?: () => void }) {
  const copy = useMentionCopy();
  return (
    <span className="fileChip serverChip" title={`${server.name} · ${server.hostname} · #${server.id}`}>
      <Server size={14} aria-hidden="true" />
      <span className="fileChipName" dir="auto">{server.name}</span>
      {onRemove && <button type="button" className="fileChipRemove" aria-label={`${copy.removeServer}: ${server.name}`} onClick={onRemove}>
        <X size={12} />
      </button>}
    </span>
  );
}
