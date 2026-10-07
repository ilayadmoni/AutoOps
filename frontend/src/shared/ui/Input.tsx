import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Search } from 'lucide-react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Icon rendered inside the leading edge. Decorative: the field still needs a label. */
  lead?: ReactNode;
  /** Static adornment on the trailing edge, such as a unit or a counter. */
  tail?: ReactNode;
};

/**
 * Single-line text field. Without `lead` or `tail` it renders a bare input so it can be dropped
 * into `Field` (which clones its child to attach the label and description ids) unchanged.
 */
export default function TextInput({ lead, tail, className, ...rest }: InputProps) {
  const input = <input className={className} {...rest} />;
  if (!lead && !tail) return input;
  return (
    <span className={['inputWrap', lead ? 'hasLead' : '', tail ? 'hasTail' : ''].filter(Boolean).join(' ')}>
      {input}
      {lead && <span className="inputLead">{lead}</span>}
      {tail && <span className="inputTail">{tail}</span>}
    </span>
  );
}

/** Toolbar search. `type="search"` gives the platform clear affordance and history behaviour. */
export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={['inputWrap', 'hasLead', 'searchBox', className ?? ''].filter(Boolean).join(' ')}>
      <input type="search" {...rest} />
      <span className="inputLead"><Search size={15} /></span>
    </span>
  );
}

/** Multi-line text. Vertical resize only, so a drag can never break the form's column width. */
export function Textarea({ rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} {...rest} />;
}
