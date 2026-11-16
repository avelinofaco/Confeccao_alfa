import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, ExternalLink, Scissors, ShoppingBag } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/feedback/useToast';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { ItensPedidoEditor } from '../components/pedidos/ItensPedidoEditor';
import { itemParaApi, itemVazio, problemaDosItens, resumoDoItem } from '../utils/pedidoItens';
import '../components/cadastros/cadastros.css';
import './PortalCliente.css';

const prazoPadrao = () => {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toLocaleDateString('sv-SE');
};

export default function PortalCatalogoCliente() {
  const { token } = useParams();
  const toast = useToast();
  const hoje = new Date().toLocaleDateString('sv-SE');

  const [catalogo, setCatalogo] = useState(null);
  const [erro, setErro] = useState('');
  const [itens, setItens] = useState(() => [itemVazio(1)]);
  const [prazoEntrega, setPrazoEntrega] = useState(prazoPadrao);
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/portal/cliente/${token}`);
      setCatalogo(data);
      setItens((atuais) =>
        atuais[0]?.id_modelo || data.modelos.length === 0
          ? atuais
          : atuais.map((it, idx) => (idx === 0 ? { ...it, id_modelo: String(data.modelos[0].id_modelo) } : it)),
      );
      setErro('');
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível abrir o Portal do Cliente.'));
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const enviarPedido = async (e) => {
    e.preventDefault();
    if (!prazoEntrega || prazoEntrega < hoje) {
      toast.aviso('Escolha uma data de entrega a partir de hoje.');
      return;
    }
    const problema = problemaDosItens(itens);
    if (problema) {
      toast.aviso(problema);
      return;
    }
    try {
      setEnviando(true);
      const { data: criado } = await api.post(`/portal/cliente/${token}/pedidos`, {
        prazo_entrega: prazoEntrega,
        observacoes: observacoes.trim() || null,
        itens: itens.map(itemParaApi),
      });
      toast.sucesso(`Pedido ${criado.codigo_pedido} enviado com ${criado.quantidade_total} peças!`);
      setItens([itemVazio(1, catalogo?.modelos[0]?.id_modelo ?? '')]);
      setObservacoes('');
      await carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível enviar o pedido.'));
    } finally {
      setEnviando(false);
    }
  };

  if (erro) {
    return (
      <div className="portal-cliente-pagina">
        <div className="portal-cliente-container">
          <div className="portal-card">
            <h2>Portal do Cliente indisponível</h2>
            <p>{erro}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!catalogo) {
    return (
      <div className="portal-cliente-pagina">
        <div className="portal-cliente-container">
          <div className="portal-card">Carregando catálogo da confecção…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-cliente-pagina">
      <div className="portal-cliente-container">
        <header className="portal-cabecalho">
          <div className="portal-marca">
            <Scissors size={24} color="#2563eb" aria-hidden="true" />
            <div>
              <h1>Confecção Alfa · Portal do Cliente</h1>
              <small>Olá, {catalogo.nome_cliente}! Monte seu pedido abaixo.</small>
            </div>
          </div>
        </header>

        {catalogo.estampas.length > 0 && (
          <section className="portal-card" aria-labelledby="titulo-vitrine-estampas">
            <h2 id="titulo-vitrine-estampas">Catálogo de Estampas Disponíveis</h2>
            <ul className="portal-vitrine-estampas">
              {catalogo.estampas.map((est) => (
                <li key={est.id_estampa} className="portal-vitrine-card">
                  <img src={est.imagem_data_url} alt={est.nome} loading="lazy" />
                  <code className="cadastro-etiqueta">{est.codigo}</code>
                  <strong style={{ fontSize: '0.82rem' }}>{est.nome}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="portal-card" aria-labelledby="titulo-novo-pedido-portal">
          <h2 id="titulo-novo-pedido-portal">
            <ShoppingBag size={20} color="#2563eb" aria-hidden="true" /> Montar Novo Pedido
          </h2>
          <form onSubmit={enviarPedido} noValidate>
            <ItensPedidoEditor
              itens={itens}
              onChange={setItens}
              modelos={catalogo.modelos}
              cores={catalogo.cores}
              estampas={catalogo.estampas}
              idPrefixo="portal-item"
            />
            <div className="cadastro-grid" style={{ marginBottom: '1rem' }}>
              <div className="cadastro-campo">
                <label htmlFor="portal-prazo">Prazo de entrega desejado *</label>
                <input
                  id="portal-prazo"
                  type="date"
                  min={hoje}
                  value={prazoEntrega}
                  onChange={(e) => setPrazoEntrega(e.target.value)}
                  required
                />
              </div>
              <div className="cadastro-campo">
                <label htmlFor="portal-obs">Observações do pedido (opcional)</label>
                <input
                  id="portal-obs"
                  placeholder="Ex: Embalar separado por tamanho..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="cadastro-btn primario" disabled={enviando}>
              <CheckCircle size={17} aria-hidden="true" />
              {enviando ? 'Enviando pedido…' : 'Enviar Pedido para a Confecção'}
            </button>
          </form>
        </section>

        {catalogo.pedidos.length > 0 && (
          <section className="portal-card" aria-labelledby="titulo-meus-pedidos-portal">
            <h2 id="titulo-meus-pedidos-portal">Meus Pedidos ({catalogo.pedidos.length})</h2>
            <ul className="portal-itens-lista">
              {catalogo.pedidos.map((ped) => (
                <li key={ped.id_pedido} className="portal-resumo-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>{ped.codigo_pedido} · {ped.quantidade_total} peças</strong>
                    <span className={`portal-selo ${ped.status_aprovacao_cliente === 'Aprovado' ? 'aprovado' : ped.status_aprovacao_cliente === 'Ajuste Solicitado' ? 'ajuste' : 'pendente'}`}>
                      {ped.status_aprovacao_cliente}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', margin: '0.35rem 0' }}>
                    {ped.itens.map((it) => resumoDoItem(it)).join(' | ')}
                  </div>
                  {ped.token_aprovacao && (
                    <Link
                      to={`/portal/pedido/${ped.token_aprovacao}`}
                      style={{ fontSize: '0.82rem', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <ExternalLink size={13} aria-hidden="true" /> Ver detalhes / aprovação
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
