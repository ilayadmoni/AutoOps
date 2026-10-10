import { useState, type FormEvent } from 'react';
import { MessageCircleQuestionMark, Send } from 'lucide-react';
import type { AIOperation } from '../../types/api';
import { Button, ChoiceList, TextInput, type Choice } from '../../components/ui';
import { useI18n } from '../../app/providers/I18nProvider';

/**
 * A clarifying question from the assistant. The question itself is in the reply text above; this
 * card holds the answers. Any answer is sent as the user's next chat message, exactly as if typed.
 */
export default function QuestionCard({ op, onAnswer, answer, busy }: {
  op: AIOperation;
  onAnswer: (text: string) => void;
  /** The user's reply that followed this question; once present the card is read-only. */
  answer?: string;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const [other, setOther] = useState('');
  const p = op.payload as { question?: string; options?: Choice[]; allowOther?: boolean };
  const locked = answer !== undefined || !!busy;

  const sendOther = (e: FormEvent) => {
    e.preventDefault();
    if (other.trim() && !locked) onAnswer(other.trim());
  };

  return (
    <div className="proposal question">
      <div className="proposalHead">
        <MessageCircleQuestionMark />
        <span>{t('ai.questionNote')}</span>
      </div>
      <div className="proposalBody">
        <ChoiceList
          label={p.question ?? t('ai.questionNote')}
          choices={p.options ?? []}
          chosen={answer}
          disabled={locked}
          onPick={(c) => onAnswer(c.label)}
        />
        {p.allowOther !== false && answer === undefined && (
          <form className="questionOther" onSubmit={sendOther}>
            <TextInput
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder={t('ai.otherPlaceholder')}
              aria-label={t('ai.otherPlaceholder')}
              disabled={locked}
            />
            <Button type="submit" small icon={<Send size={14} />} disabled={locked || !other.trim()}>{t('ai.otherSend')}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
