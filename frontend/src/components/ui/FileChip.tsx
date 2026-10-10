import { FileText, X } from 'lucide-react';
import { formatBytes } from '../../utils/format';

/** A file as a compact pill: icon, name, size, and an optional remove button. */
export default function FileChip({ name, size, busy, removeLabel, onRemove }: {
  name: string;
  size?: number;
  busy?: boolean;
  removeLabel?: string;
  onRemove?: () => void;
}) {
  return (
    <span className={'fileChip' + (busy ? ' busy' : '')} title={name}>
      <FileText size={14} aria-hidden="true" />
      <span className="fileChipName" dir="ltr">{name}</span>
      {size != null && <small>{formatBytes(size)}</small>}
      {onRemove && (
        <button type="button" className="fileChipRemove" aria-label={removeLabel ? `${removeLabel}: ${name}` : name} onClick={onRemove}>
          <X size={12} />
        </button>
      )}
    </span>
  );
}
