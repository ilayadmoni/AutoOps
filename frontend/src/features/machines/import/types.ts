export interface ImportRow {
  index: number; name: string; hostname: string; sshPort: number; username: string; folderPath: string;
  protocol: string; skipReason: string | null; warnings: string[];
}
export interface CredentialDraft { name: string; username: string; password: string }
export interface ImportOutcome { index: number; name: string; status: 'IMPORTED' | 'SKIPPED' | 'FAILED'; reason: string | null; machineId: number | null }
export interface ImportResult { imported: number; skipped: number; failed: number; outcomes: ImportOutcome[] }
