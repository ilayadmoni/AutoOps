import type { StoredFile } from '../types/api';

/** Storage filenames remain available for downloads; folder labels always use the original name. */
export const storedFileName = (file: Pick<StoredFile, 'filename' | 'folderName'>) => file.folderName ?? file.filename;
