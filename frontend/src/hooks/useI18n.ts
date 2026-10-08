import { useContext } from 'react';
import { I18nContext } from '../app/providers/I18nProvider';

export const useI18n = () => useContext(I18nContext);
