import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, Truck, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { linhasDaEntrega } from '../../utils/pedidoItens';
import './pedidos.css';

function situacao(linha) {
  if (linha.semCor) return 'Defina a cor';
  if (linha.disponivel < linha.necessario) return `Faltam ${linha.necessario - linha.disponivel}`;
  return 'OK';
}

function mensagemDaConferencia(semCor, faltando) {
  if (semCor) return 'Defina a cor dos itens antes de entregar (botão “Definir cor” na lista de pedidos).';
  if (faltando.length > 0) return `Estoque insuficiente em ${faltando.length} item(ns): a entrega fica bloqueada até as peças ficarem prontas.`;
  return 'Estoque suficiente para entregar o pedido inteiro.';
}

const descreverFaltas = (faltas) => faltas.map((f) => `${f.sku}: precisa ${f.necessario}, tem ${f.disponivel}`).join('; ');

/** Registro da entrega: confere o estoque de cada cor e tamanho do pedido antes de baixar. */
export function ModalEntregaPedido({ pedido, saldos, hoje, onFechar, onEntregue }) {
  const toast = useToast();
  const [dados, setDados] = useState({ data_entrega: hoje, recebedor: '', observacoes: '' });
  const [salvando, setSalvando] = useState(false);
  const linhas = linhasDaEntrega(pedido, saldos);
  const semCor = linhas.some((l) => l.semCor);
  const faltando = linhas.filter((l) => !l.semCor && l.disponivel < l.necessario);
  const podeEntregar = !semCor && faltando.length === 0;

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const confirmar = async (e) => {
    e.preventDefault();
    if (!podeEntregar) return;
    try {
      setSalvando(true);
      await api.post(`/camisetas/pedidos/${pedido.id_pedido}/entregar`, {
        data_entrega: dados.data_entrega || hoje, recebedor: dados.recebedor, observacoes: dados.observacoes,
      });
      toast.sucesso(`Entrega do pedido ${pedido.codigo_pedido} (${pedido.nome_cliente}) registrada: ${pedido.quantidade_total} peças saíram de Produtos Prontos.`);
      onEntregue();
    } catch (err) {
      const faltas = err.response?.data?.detail?.faltas;
      toast.erro(faltas
        ? `${mensagemDeErro(err, 'Estoque insuficiente.')} ${descreverFaltas(faltas)}`
        : mensagemDeErro(err, 'Erro ao registrar a entrega do pedido.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-entrega-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-entrega-titulo">
      <div className="modal-entrega-card">
        <header className="modal-entrega-header">
          <div className="modal-header-icone-titulo">
            <div className="modal-icone-box"><Truck size={24} color="#2563eb" aria-hidden="true" /></div>
            <div>
              <h2 id="modal-entrega-titulo">Registrar entrega ao cliente</h2>
              <p>{pedido.codigo_pedido} · {pedido.nome_cliente} · {pedido.quantidade_total} peças</p>
            </div>
          </div>
          <button type="button" className="modal-btn-fechar" onClick={onFechar} aria-label="Fechar janela de entrega">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={confirmar}>
          <div className="modal-entrega-body">
            <table className="entrega-skus">
              <caption className="sr-only">Conferência do estoque por cor e tamanho</caption>
              <thead>
                <tr><th scope="col">Item</th><th scope="col">Pedido</th><th scope="col">Em estoque</th><th scope="col">Situação</th></tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.chave} className={linha.semCor || linha.disponivel < linha.necessario ? 'entrega-falta' : undefined}>
                    <td>{linha.sku}</td>
                    <td>{linha.necessario}</td>
                    <td>{linha.semCor ? '—' : linha.disponivel}</td>
                    <td>{situacao(linha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={`estoque-verificacao-box ${podeEntregar ? 'suficiente' : 'bloqueado'}`}>
              {podeEntregar
                ? <CheckCircle size={22} color="#16a34a" aria-hidden="true" />
                : <AlertTriangle size={22} color="#dc2626" aria-hidden="true" />}
              <div>
                <strong className={podeEntregar ? undefined : 'texto-estoque-bloqueado'}>{mensagemDaConferencia(semCor, faltando)}</strong>
              </div>
            </div>

            <div className="modal-form-grid">
              <div className="form-group">
                <label htmlFor="data-entrega-confirmada">Data da entrega realizada *</label>
                <input id="data-entrega-confirmada" type="date" max={hoje} value={dados.data_entrega}
                  onChange={(e) => setDados({ ...dados, data_entrega: e.target.value })} required />
              </div>
              <div className="form-group">
                <label htmlFor="recebedor-nome">Nome do recebedor / responsável</label>
                <input id="recebedor-nome" type="text" placeholder="Ex.: Carlos (gerente da loja)" value={dados.recebedor}
                  onChange={(e) => setDados({ ...dados, recebedor: e.target.value })} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '0.8rem' }}>
              <label htmlFor="obs-entrega">Observações da entrega (opcional)</label>
              <textarea id="obs-entrega" rows="2" value={dados.observacoes}
                onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} />
            </div>

            <div className="aviso-impacto-ihc">
              <Info size={18} color="#2563eb" aria-hidden="true" />
              <span>Ao confirmar, o pedido passa para <strong>Entregue</strong> e as peças saem do estoque de cada cor e tamanho em Produtos Prontos.</span>
            </div>
          </div>

          <footer className="modal-entrega-footer">
            <button type="button" className="modal-btn-cancelar" onClick={onFechar} disabled={salvando}>Cancelar</button>
            <button type="submit" className={`modal-btn-confirmar${podeEntregar ? '' : ' btn-bloqueado'}`} disabled={salvando || !podeEntregar}>
              <CheckCircle size={18} aria-hidden="true" />
              <span>{salvando ? 'Registrando…' : 'Confirmar entrega e baixar estoque'}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
