/** Dataset states the server is still working through; lists poll while any dataset is in one. */
const BUSY = ['UPLOADED', 'ANALYZING', 'IMPORTING'];

export const isDatasetBusy = (status: string) => BUSY.includes(status);
