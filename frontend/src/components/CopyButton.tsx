import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { IconButton } from './Button';
import { useI18n } from '../hooks/useI18n';

/**
 * Copies text and confirms it in place for two seconds. The confirmation is the feedback, so
 * copying never raises a toast: the action is local and the result is visible where it happened.
 */
export default function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <IconButton
      label={copied ? t('common.copied') : label ?? t('common.copy')}
      onClick={() => {
        // Clipboard access can be refused (insecure origin, permission); leave the label unchanged.
        navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => undefined);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </IconButton>
  );
}
