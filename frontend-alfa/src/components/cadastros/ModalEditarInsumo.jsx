import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import './cadastros.css';

const UNIDADES = [['kg', 'Quilos (kg)'], ['unidades', 'Unidades'], ['metros', 'Metros']];

/**
 * Edição cadastral de insumo (saldo e custo médio não mudam aqui).
 * @param {{ insumo: object, cores: object[], onSalvo: (insumo: object) => void, onFechar: () => void }} props
 */
export function ModalEditarInsumo({ insumo, cores, onSalvo, onFechar }) {
  const toast = useToast();
  const [dados, setDados] = useState({
    tipo_malha_ou_aviamento: insumo.tipo_malha_ou_aviamento,
    cor: insumo.cor || '',
    id_cor: insumo.id_cor ?? '',
    unidade_medida: insumo.unidade_medida,
    estoque_minimo: String(insumo.estoque_minimo ?? 0),
    embalagem_compra: insumo.embalagem_compra != null ? String(insumo.embalagem_compra) : '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ehRolo = insumo.categoria === 'ROLO_TECIDO';

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const alterar = (campo) => (e) => setDados({ ...dados, [campo]: e.target.value });

  const salvar = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dados.tipo_malha_ou_aviamento.trim()) {
      setErro('Informe a descrição do insumo.');
      return;
    }
    try {
      setSalvando(true);
      setErro('');
      const { data } = await api.put(`/camisetas/insumos/${insumo.id_insumo}`, {
        ...dados,
        id_cor: dados.id_cor ? Number(dados.id_cor) : null,
        estoque_minimo: Number(dados.estoque_minimo || 0),
        // Vazio significa "sem embalagem fechada", e o backend aceita nulo.
        embalagem_compra: ehRolo || dados.embalagem_compra === '' ? null : Number(dados.embalagem_compra),
      });
      toast.sucesso(`Insumo ${insumo.codigo} atualizado.`);
      onSalvo(data);
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível salvar o insumo.'));
    } finally {
      setSalvando(false);
    }
  };

  return createPortal(
    <div className="cadastro-modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <form className="cadastro-modal compacto" onSubmit={salvar} role="dialog" aria-modal="true" aria-labelledby="titulo-editar-insumo" noValidate>
        <header className="cadastro-modal-cabecalho">
          <h2 id="titulo-editar-insumo">Editar {insumo.codigo}</h2>
          <button type="button" className="cadastro-btn-icone" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </header>
        {erro && <p className="cadastro-erro" role="alert">{erro}</p>}
        <div className="cadastro-grid">
          <div className="cadastro-campo cadastro-campo-largo">
            <label htmlFor="insumo-descricao">Descrição *</label>
            <input id="insumo-descricao" value={dados.tipo_malha_ou_aviamento} onChange={alterar('tipo_malha_ou_aviamento')} maxLength={150} autoFocus />
          </div>
          <div className="cadastro-campo">
            <label htmlFor="insumo-cor-texto">Cor / tingimento</label>
            <input id="insumo-cor-texto" value={dados.cor} onChange={alterar('cor')} maxLength={80} />
          </div>
          {ehRolo && (
            <div className="cadastro-campo">
              <label htmlFor="insumo-id-cor">Cor da camiseta que esta malha produz</label>
              <select id="insumo-id-cor" value={dados.id_cor} onChange={alterar('id_cor')}>
                <option value="">Não definida</option>
                {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
              </select>
            </div>
          )}
          <div className="cadastro-campo">
            <label htmlFor="insumo-unidade">Unidade</label>
            <select id="insumo-unidade" value={dados.unidade_medida} onChange={alterar('unidade_medida')}>
              {UNIDADES.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </div>
          <div className="cadastro-campo">
            <label htmlFor="insumo-minimo">Estoque mínimo</label>
            <input id="insumo-minimo" type="number" min="0" step="0.001" inputMode="decimal" value={dados.estoque_minimo} onChange={alterar('estoque_minimo')} />
          </div>
          {!ehRolo && (
            <div className="cadastro-campo">
              <label htmlFor="insumo-embalagem">Embalagem do fornecedor</label>
              <input
                id="insumo-embalagem"
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                placeholder="Ex: 1000"
                value={dados.embalagem_compra}
                onChange={alterar('embalagem_compra')}
              />
              <small className="cadastro-dica">
                Quantidade que o fornecedor vende fechada (caixa de 1000 etiquetas, rolo de 100 m).
                A sugestão de compra pede múltiplos disso. Vazio = compra fracionada.
              </small>
            </div>
          )}
        </div>
        <p className="painel-cadastro-vazio">Saldo e custo médio mudam pelas notas fiscais (Lançamento / Entrada NF).</p>
        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
