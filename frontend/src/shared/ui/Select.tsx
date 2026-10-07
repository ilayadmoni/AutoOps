import type { ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export type SelectOption = { value: string | number; label: ReactNode; disabled?: boolean };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  /** Options as data. Pass `children` instead when you need optgroups. */
  options?: SelectOption[];
  children?: ReactNode;
  /** Leading blank choice, e.g. "Any status". Its value is the empty string. */
  placeholder?: string;
  /** Fills the available width instead of sizing to the longest option. */
  block?: boolean;
};

/**
 * Select built on the native element: the popup list, type-ahead, keyboard model and the mobile
 * picker sheet are the platform's. Only the closed control is restyled, and the chevron replaces
 * the OS arrow that cannot be themed.
 */
export default function Select({ options, children, placeholder, block, className, ...rest }: Props) {
  return (
    <span className={['selectWrap', block ? 'block' : '', className ?? ''].filter(Boolean).join(' ')}>
      <select {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={String(option.value)} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown aria-hidden="true" />
    </span>
  );
}
