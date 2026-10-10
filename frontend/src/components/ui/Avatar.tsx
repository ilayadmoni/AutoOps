/** A person's initial in a tinted rounded square. `status` adds a small presence dot in the corner. */
export default function Avatar({ name, size = 34, status }: { name?: string | null; size?: number; status?: 'online' }) {
  const initial = name?.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {initial}
      {status && <i className={'avatarStatus ' + status} />}
    </span>
  );
}
