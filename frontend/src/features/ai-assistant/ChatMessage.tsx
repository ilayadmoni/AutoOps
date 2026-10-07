import { Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, useReducedMotion } from 'motion/react';
import type { AIOperation } from '../../shared/api/types';
import { CopyButton } from '../../shared/ui';
import ProposalCard from './ProposalCard';
import { useI18n } from '../../i18n/I18nProvider';

export type Msg = { role: 'user' | 'assistant'; content: string; operations?: AIOperation[] };

/** One arrival, one movement. A turn rises into place once and then stays still. */
function useEnter() {
  const reduce = useReducedMotion();
  if (reduce) return {};
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
  };
}

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
  const enter = useEnter();

  if (msg.role === 'user') {
    return (
      <motion.article className="message user" {...enter}>
        <div className="userBubble">{msg.content}</div>
      </motion.article>
    );
  }

  return (
    <motion.article className="message reply" {...enter}>
      <div className="msgHead">
        <span className="msgAvatar"><Bot size={15} /></span>
        <span className="msgWho">AutoOps</span>
        <span className="msgActions"><CopyButton text={msg.content} label={t('ai.copyReply')} /></span>
      </div>
      <div className="msgBody">
        <div className="prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ children, href }) => (
                <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
              ),
              img: () => null,
              table: ({ children }) => <div className="proseTable"><table>{children}</table></div>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
        {msg.operations?.map((op, i) => (
          <ProposalCard key={i} op={op} onWorkflow={() => onWorkflow(op)} onRun={() => onRun(op)} />
        ))}
      </div>
    </motion.article>
  );
}

/** Pending assistant turn. The dots are decoration; the text carries the same meaning alone. */
export function ThinkingMessage() {
  const { t } = useI18n();
  return (
    <article className="message reply">
      <div className="msgHead">
        <span className="msgAvatar"><Bot size={15} /></span>
        <span className="msgWho">AutoOps</span>
      </div>
      <div className="msgBody">
        <span className="thinking" role="status" aria-live="polite">
          <span className="thinkingDots" aria-hidden="true"><i /><i /><i /></span>
          {t('ai.thinking')}
        </span>
      </div>
    </article>
  );
}
