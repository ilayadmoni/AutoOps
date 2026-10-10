import { Fragment } from 'react';
import { FileChip } from '../../components/ui';
import { isTag, parseText } from './editor/mentionDoc';
import { splitAttachments } from './attachments';
import ServerChip from './ServerChip';
import { useMentionCopy } from './mentionCopy';

/**
 * A user's message with its tags inline, where they were typed. Historical messages carry attachments as a trailing
 * metadata block instead; those still render as chips after the text, so old conversations keep working.
 */
export default function MessageText({ content }: { content: string }) {
  const copy = useMentionCopy();
  const { text, files, machines } = splitAttachments(content);
  const doc = parseText(text);
  const tags = doc.filter(isTag);
  const loose = {
    files: files.filter((f) => !tags.some((t) => t.symbol === '#' && t.id === f.id)),
    machines: machines.filter((m) => !tags.some((t) => t.symbol === '@' && t.id === m.id)),
  };
  return (
    <>
      {doc.map((part, i) => isTag(part) ? (
        <span key={i} className={'mentionTag ' + (part.symbol === '@' ? 'isServer' : 'isFile')}
          title={`${part.symbol === '@' ? copy.serverTitle : copy.fileTitle} #${part.id}`}>
          <span aria-hidden="true">{part.symbol}</span><span dir="auto">{part.label}</span>
        </span>
      ) : <Fragment key={i}>{part.text}</Fragment>)}
      {(loose.files.length > 0 || loose.machines.length > 0) && (
        <div className="bubbleFiles">
          {loose.machines.map((server) => <ServerChip key={server.id} server={server} />)}
          {loose.files.map((f) => <FileChip key={f.id} name={f.filename} size={f.size} />)}
        </div>
      )}
    </>
  );
}
