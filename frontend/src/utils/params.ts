/** Drops empty values so server-side defaults apply. */
export function cleanParams(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));
}
