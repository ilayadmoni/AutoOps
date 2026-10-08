import { useRef, type InputHTMLAttributes, type ReactNode } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'children'> & {
  onPick: (file?: File) => void;
  children: (open: () => void) => ReactNode;
};

/** Hidden native file input with a shared trigger contract. */
export default function FilePicker({ onPick, children, accept, disabled, multiple, ...rest }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        {...rest}
        ref={input}
        type="file"
        hidden
        accept={accept}
        disabled={disabled}
        multiple={multiple}
        onChange={(event) => {
          onPick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {children(() => input.current?.click())}
    </>
  );
}
