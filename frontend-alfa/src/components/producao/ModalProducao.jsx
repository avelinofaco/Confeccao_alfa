import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import '../cadastros/cadastros.css';
import './producao.css';

/** Moldura de modal das telas de produção: portal no body; Esc e clique fora fecham. */
export function ModalProducao({ titulo, idTitulo, onFechar, largo = false, children }) {
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return createPortal(
    <div className="cadastro-modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className={`cadastro-modal${largo ? ' largo' : ''}`} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        <header className="cadastro-modal-cabecalho">
          <h2 id={idTitulo}>{titulo}</h2>
          <button type="button" className="cadastro-btn-icone" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
