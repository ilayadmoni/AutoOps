import { createContext, useCallback, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

type Toast = { id: number; kind: 'success' | 'error'; text: string };

export interface ToastContextValue {
  success: (text: string) => void;
  error: (text: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({ success: () => {}, error: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((x) => x.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, kind, text }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
  }, [dismiss]);
  const success = useCallback((text: string) => push('success', text), [push]);
  const error = useCallback((text: string) => push('error', text), [push]);
  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.kind}>
            {t.kind === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{t.text}</span>
            <button className="icon" aria-label="dismiss" onClick={() => dismiss(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
