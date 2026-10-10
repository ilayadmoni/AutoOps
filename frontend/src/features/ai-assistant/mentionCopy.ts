import { useI18n } from '../../app/providers/I18nProvider';

const en = {
  servers: 'Attach server (@)', files: 'Attach file (#)', removeServer: 'Remove server',
  serverTitle: 'Servers', fileTitle: 'Stored files', search: 'Type to search',
  emptyServers: 'No matching servers', emptyFiles: 'No matching files',
  selected: 'Attached', limit: 'Attachment limit reached',
  add: 'Add', fromPc: 'File from computer', fromPcHint: 'Upload from this device',
  storedFile: 'File from AutoOps', storedFileHint: 'Type # to search stored files',
  host: 'Host from AutoOps', hostHint: 'Type @ to search servers',
  keys: '↑ ↓ to navigate · Enter to attach · Esc to close',
};
const he: typeof en = {
  servers: 'צירוף שרת (@)', files: 'צירוף קובץ (#)', removeServer: 'הסרת שרת',
  serverTitle: 'שרתים', fileTitle: 'קבצים שמורים', search: 'הקלידו לחיפוש',
  emptyServers: 'לא נמצאו שרתים מתאימים', emptyFiles: 'לא נמצאו קבצים מתאימים',
  selected: 'מצורף', limit: 'הגעת למגבלת הצירופים',
  add: 'הוספה', fromPc: 'קובץ מהמחשב', fromPcHint: 'העלאה מהמכשיר הזה',
  storedFile: 'קובץ מ-AutoOps', storedFileHint: 'הקלידו # לחיפוש קבצים שמורים',
  host: 'שרת מ-AutoOps', hostHint: 'הקלידו @ לחיפוש שרתים',
  keys: '↑ ↓ לניווט · Enter לצירוף · Esc לסגירה',
};
export const useMentionCopy = () => useI18n().lang === 'he' ? he : en;
