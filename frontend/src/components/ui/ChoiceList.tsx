import { Check } from 'lucide-react';

export type Choice = { label: string; description?: string };

/**
 * Stacked single-pick answers, such as the options of a clarifying question. Picking acts at once
 * (no separate confirm). `chosen` marks the answer already given; the list is then read-only.
 */
export default function ChoiceList({ choices, onPick, chosen, disabled, label }: {
  choices: Choice[];
  onPick: (choice: Choice) => void;
  chosen?: string;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="choiceList" role="group" aria-label={label}>
      {choices.map((c) => {
        const picked = chosen === c.label;
        return (
          <button
            key={c.label}
            type="button"
            className="choice"
            aria-pressed={picked}
            disabled={disabled}
            onClick={() => onPick(c)}
          >
            <span className="choiceText">
              <span className="choiceLabel" dir="auto">{c.label}</span>
              {c.description && <small dir="auto">{c.description}</small>}
            </span>
            {picked && <Check size={15} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
