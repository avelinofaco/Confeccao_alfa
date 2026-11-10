import { useCallback, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ToastContext } from './feedbackContexts';
import './feedback.css';

const DURACAO_MS = 5000;
const DURACAO_ERRO_MS = 8000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const proximoId = useRef(1);

  const fechar = useCallback((id) => {
    setToasts((atuais) => atuais.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback((tipo, texto) => {
    const id = proximoId.current;
    proximoId.current += 1;
    setToasts((atuais) => [...atuais, { id, tipo, texto }]);
    setTimeout(() => fechar(id), tipo === 'erro' ? DURACAO_ERRO_MS : DURACAO_MS);
  }, [fechar]);

  const valor = useMemo(() => ({
    mostrar,
    sucesso: (texto) => mostrar('sucesso', texto),
    erro: (texto) => mostrar('erro', texto),
    aviso: (texto) => mostrar('aviso', texto),
    info: (texto) => mostrar('info', texto),
  }), [mostrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="feedback-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`feedback-toast ${t.tipo}`} role={t.tipo === 'erro' ? 'alert' : 'status'}>
            <span>{t.texto}</span>
            <button
              type="button"
              className="feedback-toast-fechar"
              onClick={() => fechar(t.id)}
              aria-label="Fechar notificação"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
