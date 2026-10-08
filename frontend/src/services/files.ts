import { del, get, getBlob, upload } from '../lib/apiClient';
import type { StoredFile } from '../types/api';

export const filesService = {
  list: () => get<StoredFile[]>('/files'),
  upload: (file: File) => upload<StoredFile>('/files', file),
  content: (id: number) => getBlob(`/files/${id}/content`),
  remove: (id: number) => del('/files/' + id),
};
