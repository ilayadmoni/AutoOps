/**
 * The AutoOps component vocabulary. Every page imports from here, so a change to a primitive
 * lands everywhere at once — that is what keeps the system consistent.
 *
 * Form controls: nothing renders a bare `input`, `select` or `textarea` outside this folder.
 * Going through `TextInput` / `Select` / `Checkbox` / `Radio` / `Switch` / `NumberInput` is what
 * guarantees one height, one focus ring and one disabled treatment across every page.
 */
export { default as Button, IconButton } from './Button';
export { default as Brand } from './Brand';
export { default as Card, CardHeader, Stat } from './Card';
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as CopyButton } from './CopyButton';
export { default as Modal } from './Modal';
export { default as PageHeader } from './PageHeader';
export { default as Segmented } from './Segmented';
export { default as Tooltip } from './Tooltip';

export { default as TextInput, SearchInput, Textarea } from './Input';
export { default as Select } from './Select';
export { default as NumberInput } from './NumberInput';
export { default as Checkbox, Radio, Switch } from './Toggle';

export { BootLoader, Loading, SkeletonList, Spinner } from './Loaders';
export { RiskBadge, StatusBadge } from './Badges';
export { Code, EmptyState, ErrorAlert, Field, Output, errorMessage } from './Feedback';

export type { ButtonProps } from './Button';
export type { SegmentedOption } from './Segmented';
export type { SelectOption } from './Select';
