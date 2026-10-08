import { useContext } from 'react';
import { ToastContext } from '../app/providers/ToastProvider';

export const useToast = () => useContext(ToastContext);
