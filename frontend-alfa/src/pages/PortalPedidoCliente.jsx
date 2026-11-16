import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, MessageSquareWarning, Printer, Scissors } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/feedback/useToast';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { PERFIS_PDF_PEDIDO, imprimirPdfPedido } from '../utils/pdfPedido';
import '../components/cadastros/cadastros.css';
import './PortalCliente.css';

const formatarMoeda = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

const classeSelo = (status) => {
  if (status === 'Aprovado') return 'aprovado';
  if (status === 'Ajuste Solicitado') return 'ajuste';
  return 'pendente';
};

export default function PortalPedidoCliente() {
  const { token } = useParams();
  const toast = useToast();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/portal/pedido/${token}`);
      setPedido(data);
      setObservacao(data.observacao_cliente || '');
      setErro('');
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível carregar este pedido.'));
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const responder = async (decisao) => {
    if (decisao === 'Ajuste Solicitado' && !observacao.trim()) {
      toast.aviso('Descreva no campo abaixo o que você gostaria de ajustar no pedido.');
      return;
    }
    try {
      setEnviando(true);
      const { data } = await api.post(`/portal/pedido/${token}/responder`, {
        decisao,
        observacao_cliente: observacao.trim() || null,
      });
      setPedido(data);
      toast.sucesso(
        decisao === 'Aprovado'
          ? 'Pedido aprovado com sucesso! A confecção já foi avisada.'
          : 'Solicitação de ajuste enviada para a confecção.',
      );
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível registrar sua resposta.'));
    } finally {
      setEnviando(false);
    }
  };

  if (erro) {
    return (
      <div className="portal-cliente-pagina">
        <div className="portal-cliente-container">
          <div className="portal-card">
            <h2>Link de pedido indisponível</h2>
            <p>{erro}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="portal-cliente-pagina">
        <div className="portal-cliente-container">
          <div className="portal-card">Carregando detalhes do pedido…</div>
        </div>
      </div>
    );
  }

  const jaEntregue = pedido.status_pedido === 'Entregue';

  return (
    <div className="portal-cliente-pagina">
      <div className="portal-cliente-container">
        <header className="portal-cabecalho">
          <div className="portal-marca">
            <Scissors size={24} color="#2563eb" aria-hidden="true" />
            <div>
              <h1>Confecção Alfa · Pedido {pedido.codigo_pedido}</h1>
              <small>Cliente: {pedido.nome_cliente}</small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="cadastro-btn secundario"
              onClick={() =>
                imprimirPdfPedido(
                  pedido,
                  PERFIS_PDF_PEDIDO.cliente.opcoes,
                  PERFIS_PDF_PEDIDO.cliente.tituloDoc,
                  () => toast.aviso('Permita janelas pop-up para salvar o PDF.'),
                )
              }
            >
              <Printer size={15} aria-hidden="true" /> Salvar PDF
            </button>
            <span className={`portal-selo ${classeSelo(pedido.status_aprovacao_cliente)}`}>
              {pedido.status_aprovacao_cliente}
            </span>
          </div>
        </header>

        <section className="portal-card" aria-label="Resumo do pedido">
          <div className="portal-resumo-grid">
            <div className="portal-resumo-item">
              <span>Total de Peças</span>
              <strong>{pedido.quantidade_total} un.</strong>
            </div>
            <div className="portal-resumo-item">
              <span>Prazo de Entrega</span>
              <strong>{new Date(`${pedido.prazo_entrega}T00:00:00`).toLocaleDateString('pt-BR')}</strong>
            </div>
            <div className="portal-resumo-item">
              <span>Valor do Pedido</span>
              <strong>{Number(pedido.valor_total) > 0 ? formatarMoeda(pedido.valor_total) : 'A orçar pela confecção'}</strong>
            </div>
            <div className="portal-resumo-item">
              <span>Andamento</span>
              <strong>{pedido.status_pedido}</strong>
            </div>
          </div>
          {pedido.observacoes && (
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              <strong>Observações:</strong> {pedido.observacoes}
            </p>
          )}
        </section>

        <section className="portal-card" aria-labelledby="titulo-itens-portal">
          <h2 id="titulo-itens-portal">Itens, Cores, Estampas e Tamanhos</h2>
          <ul className="portal-itens-lista">
            {pedido.itens.map((item, idx) => (
              <li key={item.id_item || idx} className="portal-item-card">
                <div className="portal-item-arte">
                  {item.imagem_estampa_url ? (
                    <img src={item.imagem_estampa_url} alt={item.nome_estampa || 'Estampa'} />
                  ) : (
                    <span className="portal-item-lisa">Peça lisa</span>
                  )}
                </div>
                <div>
                  <div>
                    <strong>{item.nome_modelo}</strong>
                    {' · '}
                    {item.hex_cor && (
                      <span
                        className="cadastro-amostra"
                        style={{ background: item.hex_cor, marginRight: '0.3rem' }}
                        aria-hidden="true"
                      />
                    )}
                    <span>{item.nome_cor || 'Cor a definir'}</span>
                  </div>
                  {item.id_estampa && (
                    <div style={{ fontSize: '0.86rem', marginTop: '0.2rem' }}>
                      Estampa: <strong>[{item.codigo_estampa}] {item.nome_estampa}</strong>
                      {' · Posição: '}
                      <strong>{item.posicao_estampa || 'Frente'}</strong>
                    </div>
                  )}
                  <div className="portal-item-tamanhos">
                    {item.quantidades.map((q) => (
                      <span key={q.id_tamanho} className="cadastro-etiqueta">
                        {q.rotulo}: {q.quantidade}
                      </span>
                    ))}
                    <span className="cadastro-etiqueta">Total: {item.total} pçs</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {!jaEntregue && (
          <section className="portal-card" aria-labelledby="titulo-aprovacao-portal">
            <h2 id="titulo-aprovacao-portal">Confirmação do Cliente</h2>
            <div className="cadastro-campo">
              <label htmlFor="portal-observacao-cliente">
                Observação para a confecção (obrigatória caso peça ajuste)
              </label>
              <textarea
                id="portal-observacao-cliente"
                rows={2}
                placeholder="Ex: Arte e tamanhos conferidos! / Gostaria de mudar..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
            <div className="portal-acoes-aprovacao">
              <button
                type="button"
                className="cadastro-btn primario"
                disabled={enviando}
                onClick={() => responder('Aprovado')}
              >
                <CheckCircle size={17} aria-hidden="true" /> Aprovar Pedido
              </button>
              <button
                type="button"
                className="cadastro-btn secundario"
                disabled={enviando}
                onClick={() => responder('Ajuste Solicitado')}
              >
                <MessageSquareWarning size={17} aria-hidden="true" /> Solicitar Ajuste
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
