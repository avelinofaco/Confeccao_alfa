import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmContext } from './feedbackContexts';
import './feedback.css';

const PADROES = { textoConfirmar: 'Confirmar', textoCancelar: 'Cancelar', perigo: false, detalhes: [] };

export function ConfirmProvider({ children }) {
  const [pedido, setPedido] = useState(null);
  const cancelarRef = useRef(null);
  const confirmarRef = useRef(null);

  const confirmar = useCallback((opcoes) => new Promise((resolver) => {
    setPedido({ ...PADROES, ...opcoes, detalhes: opcoes?.detalhes || [], resolver });
  }), []);

  const responder = useCallback((resposta) => {
    if (!pedido) return;
    pedido.resolver(resposta);
    setPedido(null);
  }, [pedido]);

  useEffect(() => {
    if (!pedido) return undefined;
    const focoAnterior = document.activeElement;
    (pedido.perigo ? cancelarRef.current : confirmarRef.current)?.focus();

    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        responder(false);
        return;
      }
      if (evento.key !== 'Tab') return;
      const botoes = [cancelarRef.current, confirmarRef.current].filter(Boolean);
      const atual = botoes.indexOf(document.activeElement);
      const passo = evento.shiftKey ? -1 : 1;
      const proximo = (atual + passo + botoes.length) % botoes.length;
      evento.preventDefault();
      botoes[proximo]?.focus();
    };

    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      focoAnterior?.focus?.();
    };
  }, [pedido, responder]);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {pedido && (
        <div
          className="feedback-confirm-fundo"
          onMouseDown={(e) => { if (e.target === e.currentTarget) responder(false); }}
        >
          <div
            className="feedback-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="feedback-confirm-titulo"
            aria-describedby="feedback-confirm-mensagem"
          >
            <h2 id="feedback-confirm-titulo">{pedido.titulo}</h2>
            <p id="feedback-confirm-mensagem">{pedido.mensagem}</p>
            {pedido.detalhes.length > 0 && (
              <ul className="feedback-confirm-detalhes">
                {pedido.detalhes.map((linha) => <li key={linha}>{linha}</li>)}
              </ul>
            )}
            <div className="feedback-confirm-acoes">
              <button ref={cancelarRef} type="button" className="feedback-btn secundario" onClick={() => responder(false)}>
                {pedido.textoCancelar}
              </button>
              <button
                ref={confirmarRef}
                type="button"
                className={`feedback-btn ${pedido.perigo ? 'perigo' : 'primario'}`}
                onClick={() => responder(true)}
              >
                {pedido.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
