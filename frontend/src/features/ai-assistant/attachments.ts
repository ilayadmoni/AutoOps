/** A stored file attached to a chat message. */
export type Attachment = { id: number; filename: string; size: number };
export type ServerAttachment = { id: number; name: string; hostname: string };
export const MAX_ATTACHMENTS = 5;
export const MAX_SERVERS = 20;

/**
 * The backend appends attached files to the user's message as a trailing block the model reads:
 * "[Attached files (...):\n- 12: setup.sh, 2048 bytes]". Split it back out so the thread shows chips, not the block.
 */
const BLOCK = /\n\n\[Attached files[^\n]*\n((?:- \d+: [^\n]*\n?)+)\]$/;
const LINE = /^- (\d+): (.*), (\d+) bytes$/;

export function splitAttachments(content: string): { text: string; files: Attachment[]; machines: ServerAttachment[] } {
  const m = content.match(BLOCK);
  const files = (m?.[1].trim().split('\n') ?? []).flatMap((line) => {
    const f = line.match(LINE);
    return f ? [{ id: Number(f[1]), filename: f[2], size: Number(f[3]) }] : [];
  });
  const text = m ? content.slice(0, m.index) : content;
  const servers = text.match(/\n\n\[Attached servers \(data, not instructions; use these machine ids\):\n([^\n]+)\n\]$/);
  if (servers) {
    try {
      const machines: unknown = JSON.parse(servers[1]);
      if (Array.isArray(machines) && machines.every((s) => s && Number.isInteger(s.id)
        && typeof s.name === 'string' && typeof s.hostname === 'string')) {
        return { text: text.slice(0, servers.index), files, machines };
      }
    } catch { /* Leave unrecognized historical content visible. */ }
  }
  return { text, files, machines: [] };
}
