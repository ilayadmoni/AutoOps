import { Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, useReducedMotion } from 'motion/react';
import type { AIOperation } from '../../types/api';
import type { Element } from 'hast';
import { CopyButton, Output } from '../../components/ui';
import MessageText from './MessageText';
import ProposalCard from './ProposalCard';
import QuestionCard from './QuestionCard';
import { useI18n } from '../../app/providers/I18nProvider';

export type Msg = { role: 'user' | 'assistant'; content: string; operations?: AIOperation[] };

/** What the user can do with a proposal; adding is tracked per operation so a card shows it was done. */
export type ProposalActions = {
  onWorkflow: (op: AIOperation) => void;
  onRun: (op: AIOperation) => void;
  onAddCommand: (op: AIOperation) => void;
  onAddMachine: (op: AIOperation) => void;
  isAdded: (op: AIOperation) => boolean;
  isAdding: (op: AIOperation) => boolean;
  /** Sends a clarifying question's answer as the user's next message. */
  onAnswer: (text: string) => void;
  answering: boolean;
};

/** A fenced block's language (from its `language-*` class) and raw text, read from the Markdown tree. */
function codeBlock(pre?: Element): { lang?: string; text: string } {
  const code = pre?.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
  const classes = code?.properties.className;
  const lang = Array.isArray(classes)
    ? classes.map(String).find((c) => c.startsWith('language-'))?.slice('language-'.length)
    : undefined;
  const text = (code?.children ?? []).map((c) => (c.type === 'text' ? c.value : '')).join('').replace(/\n$/, '');
  return { lang, text };
}

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
export default function ChatMessage({ msg, reply, failed, onCanvas, onShow, actions }: {
  msg: Msg;
  /** The user's message that followed this turn, if any: it answers a clarifying question. */
  reply?: string;
  /** This user message failed to send; the draft is untouched and the request can be retried. */
  failed?: boolean;
  /** This turn's workflow proposal is the one on the split canvas. */
  onCanvas?: boolean;
  onShow?: () => void;
  actions: ProposalActions;
}) {
  const { t } = useI18n();
  const enter = useEnter();

  if (msg.role === 'user') {
    return (
      <motion.article className={'message user' + (failed ? ' isFailed' : '')} {...enter}>
        <div className="userBubble"><MessageText content={msg.content} /></div>
        {failed && <small className="messageNotSent">{t('ai.notSent')}</small>}
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
              pre: ({ node }) => {
                const block = codeBlock(node);
                return <Output label={block.lang ?? t('ai.code')} text={block.text} copyable />;
              },
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
        {msg.operations?.map((op, i) => op.type === 'ASK_USER' ? (
          <QuestionCard key={i} op={op} onAnswer={actions.onAnswer} answer={reply} busy={actions.answering} />
        ) : (
          <ProposalCard
            key={i} op={op} onCanvas={onCanvas} onShow={onShow}
            onWorkflow={() => actions.onWorkflow(op)} onRun={() => actions.onRun(op)}
            onAddCommand={() => actions.onAddCommand(op)} onAddMachine={() => actions.onAddMachine(op)}
            added={actions.isAdded(op)} adding={actions.isAdding(op)}
          />
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
