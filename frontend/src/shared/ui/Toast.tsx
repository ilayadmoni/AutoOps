import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

type Toast = { id: number; kind: 'success' | 'error'; text: string };
const Ctx = createContext<{ success: (t: string) => void; error: (t: string) => void }>({ success: () => {}, error: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, kind, text }]);
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  const success = useCallback((t: string) => push('success', t), [push]);
  const error = useCallback((t: string) => push('error', t), [push]);
  return (
    <Ctx.Provider value={{ success, error }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.kind}>
            {t.kind === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{t.text}</span>
            <button className="icon" aria-label="dismiss" onClick={() => setToasts((x) => x.filter((v) => v.id !== t.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
