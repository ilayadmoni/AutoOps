import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { AIOperation } from '../../shared/api/types';
import ProposalCard from './ProposalCard';
import { useI18n } from '../../i18n/I18nProvider';

export type Msg = { role: 'user' | 'assistant'; content: string; operations?: AIOperation[] };

/**
 * One turn in the thread. Assistant text is Markdown; links are forced to open safely and
 * images are dropped, since message content originates from a model and must not embed remote
 * resources into an operations console.
 */
export default function ChatMessage({ msg, onWorkflow, onRun }: {
  msg: Msg;
  onWorkflow: (op: AIOperation) => void;
  onRun: (op: AIOperation) => void;
}) {
  const { t } = useI18n();
  const isUser = msg.role === 'user';
  return (
    <article className={'message ' + msg.role}>
      <div className="msgAvatar">{isUser ? <User size={16} /> : <Bot size={16} />}</div>
      <div className="msgBody">
        <span className="msgWho">{isUser ? t('ai.you') : 'AutoOps'}</span>
        {isUser ? (
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
        ) : (
          <div className="prose">
            <ReactMarkdown
              components={{
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
                ),
                img: () => null,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
        {msg.operations?.map((op, i) => (
          <ProposalCard key={i} op={op} onWorkflow={() => onWorkflow(op)} onRun={() => onRun(op)} />
        ))}
      </div>
    </article>
  );
}

/** Pending assistant turn. Animated dots carry the same meaning as the text for reduced-motion users. */
export function ThinkingMessage() {
  const { t } = useI18n();
  return (
    <article className="message assistant">
      <div className="msgAvatar"><Bot size={16} /></div>
      <div className="msgBody">
        <span className="msgWho">AutoOps</span>
        <span className="thinking" role="status" aria-live="polite">
          <span className="thinkingDots" aria-hidden="true"><i /><i /><i /></span>
          {t('ai.thinking')}
        </span>
      </div>
    </article>
  );
}
