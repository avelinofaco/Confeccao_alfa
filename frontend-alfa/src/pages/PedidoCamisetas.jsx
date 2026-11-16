import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  PlusCircle,
  CheckCircle,
  Search,
  Truck,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/feedback/useToast';
import { useConfirm } from '../components/feedback/useConfirm';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
import { SeletorCliente } from '../components/cadastros/SeletorCliente';
import { ItensPedidoEditor } from '../components/pedidos/ItensPedidoEditor';
import { ModalItensPedido } from '../components/pedidos/ModalItensPedido';
import { ModalEntregaPedido } from '../components/pedidos/ModalEntregaPedido';
import {
  itemParaApi,
  itemVazio,
  problemaDosItens,
  resumoDoItem,
  saldosDosProdutos,
} from '../utils/pedidoItens';
import './PedidoCamisetas.css';

const formularioVazio = (hoje, idModelo = '') => ({
  cliente: null,
  itens: [itemVazio(1, idModelo)],
  prazo_entrega: hoje,
  valor_total: '',
  observacoes: '',
});

function PedidoCamisetas() {
  const hoje = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do navegador

  const [modelos, setModelos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [produtosProntos, setProdutosProntos] = useState([]);
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [erroData, setErroData] = useState('');
  const toast = useToast();
  const confirmar = useConfirm();

  // Formulário do novo pedido
  const [formData, setFormData] = useState(() => formularioVazio(hoje));

  // Modais: entrega ao cliente e edição dos itens
  const [pedidoParaEntrega, setPedidoParaEntrega] = useState(null);
  const [pedidoEmEdicao, setPedidoEmEdicao] = useState(null);

  const carregarDados = async () => {
    setLoading(true);
    const { dados, houveFalha } = await buscarEmParalelo([
      '/camisetas/modelos/', '/camisetas/pedidos/', '/camisetas/produtos-prontos/', '/camisetas/cores/',
    ]);
    const [mods, listaPedidos, prontos, listaCores] = dados;
    setModelos(mods);
    setFormData((atual) => (atual.itens[0]?.id_modelo || mods.length === 0
      ? atual
      : { ...atual, itens: atual.itens.map((item, indice) => (indice === 0 ? { ...item, id_modelo: String(mods[0].id_modelo) } : item)) }));
    setPedidos(listaPedidos);
    setProdutosProntos(prontos);
    setCores(listaCores);
    if (houveFalha) {
      toast.erro('Não foi possível carregar todos os dados de pedidos. Verifique a conexão e recarregue a página.');
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Validação estrita do prazo de entrega (IHC: prevenção de erros)
  const handlePrazoChange = (e) => {
    const val = e.target.value;
    if (val && val < hoje) {
      setErroData('O prazo de entrega desejado não pode ser anterior à data de hoje.');
    } else {
      setErroData('');
    }
    setFormData({ ...formData, prazo_entrega: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.cliente) {
      toast.aviso('Escolha o cliente do pedido (ou cadastre um novo pela própria busca).');
      return;
    }
    if (!formData.prazo_entrega || !formData.valor_total) {
      toast.aviso('Preencha o prazo de entrega e o valor do pedido.');
      return;
    }
    if (formData.prazo_entrega < hoje) {
      setErroData('O prazo de entrega não pode ser anterior à data de hoje.');
      return;
    }
    const problema = problemaDosItens(formData.itens);
    if (problema) {
      toast.aviso(problema);
      return;
    }
    try {
      const { data: pedidoCriado } = await api.post('/camisetas/pedidos/', {
        id_cliente: formData.cliente.id_cliente,
        itens: formData.itens.map(itemParaApi),
        prazo_entrega: formData.prazo_entrega,
        valor_total: parseFloat(formData.valor_total),
        observacoes: formData.observacoes,
      });
      toast.sucesso(`Pedido ${pedidoCriado.codigo_pedido} registrado com ${pedidoCriado.quantidade_total} peças. Status inicial: 'Aguardando Produção'.`);
      setFormData(formularioVazio(hoje, modelos[0]?.id_modelo ?? ''));
      setErroData('');
      await carregarDados();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Erro ao salvar o pedido.'));
    }
  };

  // Reverter Entrega (Controle do Usuário - IHC)
  const handleReverterEntrega = async (pedido) => {
    const confirmou = await confirmar({
      titulo: `Reverter a entrega do pedido ${pedido.codigo_pedido}?`,
      mensagem: `O status volta para 'Aguardando Produção' e as ${pedido.quantidade_total} peças voltam para Produtos Prontos.`,
      textoConfirmar: 'Reverter entrega',
      perigo: true,
    });
    if (!confirmou) return;

    try {
      setLoading(true);
      await api.put(`/camisetas/pedidos/${pedido.id_pedido}/status`, { status_pedido: 'Aguardando Produção' });
      toast.info(`Entrega do pedido ${pedido.codigo_pedido} revertida. As peças voltaram para Produtos Prontos.`);
      await carregarDados();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Erro ao reverter a entrega.'));
    } finally {
      setLoading(false);
    }
  };

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Totais e KPIs
  const totalPecasEstoquePronto = produtosProntos.reduce((acc, linha) => acc + linha.total, 0);
  const saldos = useMemo(() => saldosDosProdutos(produtosProntos), [produtosProntos]);
  const pedidosEmAberto = pedidos.filter(p => p.status_pedido !== 'Entregue').length;
  const pedidosEntregues = pedidos.filter(p => p.status_pedido === 'Entregue').length;

  const termo = busca.toLowerCase();
  const pedidosFiltrados = pedidos.filter(p =>
    (p.nome_cliente || '').toLowerCase().includes(termo) ||
    (p.codigo_pedido || '').toLowerCase().includes(termo) ||
    (p.nome_modelo || '').toLowerCase().includes(termo) ||
    (p.itens || []).some((i) => i.nome_modelo.toLowerCase().includes(termo))
  );

  return (
    <div className="pedido-camisetas-container">
      <Sidebar />

      <main className="pedido-camisetas-main">

        {/* Cabeçalho */}
        <header className="page-header">
          <h1>
            <ShoppingCart size={28} color="#2563eb" aria-hidden="true" />
            2. Cadastro e Entrega de Pedidos do Cliente
          </h1>
          <p>
            Registre os pedidos por modelo, cor e tamanho, acompanhe prazos e registre a entrega
            com baixa automática em Produtos Prontos.
          </p>
        </header>

        {/* CARDS DE VISÃO RÁPIDA / IHC */}
        <section className="kpi-pedidos-grid" aria-label="Resumo comercial e de estoque pronto">
          <div className="kpi-pedido-card aberto">
            <span className="kpi-label">Pedidos em Aberto</span>
            <div className="kpi-valor">{pedidosEmAberto}</div>
            <span className="kpi-desc">Aguardando produção ou expedição</span>
          </div>

          <div className="kpi-pedido-card entregue">
            <span className="kpi-label">Pedidos Concluídos</span>
            <div className="kpi-valor">{pedidosEntregues}</div>
            <span className="kpi-desc">Entregas formalizadas aos clientes</span>
          </div>

          <div className="kpi-pedido-card estoque-pronto">
            <span className="kpi-label">Estoque Pronto de Camisetas</span>
            <div className="kpi-valor">{totalPecasEstoquePronto} un.</div>
            <span className="kpi-desc">Saldo de peças acabadas prontas para entrega</span>
          </div>
        </section>

        {/* FORMULÁRIO DE CADASTRO */}
        <div className="form-card">
          <h2>
            <PlusCircle size={20} color="#2563eb" aria-hidden="true" />
            Novo Pedido Comercial de Camisetas
          </h2>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="campo-cliente">Cliente *</label>
                <SeletorCliente
                  id="campo-cliente"
                  cliente={formData.cliente}
                  onChange={(cliente) => setFormData((atual) => ({ ...atual, cliente }))}
                />
              </div>

              {/* PRAZO DE ENTREGA DESEJADO COM BLOQUEIO DE DATAS PASSADAS (IHC) */}
              <div className="form-group">
                <label htmlFor="campo-prazo-entrega">
                  Prazo de Entrega Desejado *
                </label>
                <input
                  id="campo-prazo-entrega"
                  type="date"
                  min={hoje}
                  value={formData.prazo_entrega}
                  onChange={handlePrazoChange}
                  className={erroData ? 'input-error' : ''}
                  aria-invalid={!!erroData}
                  aria-describedby={erroData ? "erro-prazo" : undefined}
                  required
                />
                {erroData && (
                  <span id="erro-prazo" className="form-error-text" role="alert">
                    <AlertTriangle size={14} />
                    {erroData}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="campo-valor-total">Valor Financeiro Total (R$) *</label>
                <input
                  id="campo-valor-total"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 3500.00"
                  value={formData.valor_total}
                  onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                  required
                />
              </div>
            </div>

            <ItensPedidoEditor
              itens={formData.itens}
              onChange={(itens) => setFormData((atual) => ({ ...atual, itens }))}
              modelos={modelos}
              cores={cores}
              idPrefixo="novo-item"
            />

            <div className="form-group" style={{ marginBottom: '1.4rem' }}>
              <label htmlFor="campo-observacoes">Observações Comerciais (Opcional)</label>
              <textarea
                id="campo-observacoes"
                rows="2"
                placeholder="Ex: Embalagem individual plástica, tag Alfa Premium aplicada na manga esquerda..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              ></textarea>
            </div>

            <button type="submit" className="btn-acao-rapida" disabled={loading || !!erroData}>
              <CheckCircle size={18} />
              <span>Salvar Pedido (Status: Aguardando Produção)</span>
            </button>
          </form>
        </div>

        {/* TABELA DE PEDIDOS SALVOS */}
        <div className="table-card">
          <div className="table-header-box">
            <h2>Pedidos Comerciais ({pedidosFiltrados.length})</h2>

            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Buscar por cliente, modelo ou código..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ paddingLeft: '2.1rem', borderRadius: 8, border: '1px solid #cbd5e1', padding: '0.5rem 0.8rem 0.5rem 2rem' }}
                  aria-label="Buscar pedidos"
                />
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="pedidos-table" aria-label="Tabela de pedidos comerciais">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Itens</th>
                  <th scope="col">Total Peças</th>
                  <th scope="col">Prazo Entrega</th>
                  <th scope="col">Valor Total</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Ação de Entrega</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      Nenhum pedido de camiseta encontrado.
                    </td>
                  </tr>
                ) : (
                  pedidosFiltrados.map((ped) => {
                    const isEntregue = ped.status_pedido === 'Entregue';
                    return (
                      <tr key={ped.id_pedido} className={isEntregue ? 'linha-entregue' : ''}>
                        <td><strong>{ped.codigo_pedido}</strong></td>
                        <td>{ped.nome_cliente}</td>
                        <td>
                          <ul className="pedido-itens-resumo">
                            {ped.itens.map((item) => (
                              <li key={item.id_item} className={item.id_cor ? undefined : 'sem-cor'}>{resumoDoItem(item)}</li>
                            ))}
                          </ul>
                          {!isEntregue && (
                            <button type="button" className="btn-link-itens" onClick={() => setPedidoEmEdicao(ped)}>
                              {ped.itens.some((item) => !item.id_cor) ? 'Definir cor' : 'Editar itens'}
                            </button>
                          )}
                        </td>
                        <td><strong>{ped.quantidade_total} un.</strong></td>
                        <td>
                          {new Date(ped.prazo_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td><strong>{formatarMoeda(ped.valor_total)}</strong></td>
                        <td>
                          <span className={`badge-status-pedido ${
                            isEntregue ? 'concluido' :
                            ped.status_pedido.includes('Produção') ? 'producao' : 'aguardando'
                          }`}>
                            {isEntregue ? 'Entregue ao Cliente' : ped.status_pedido}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isEntregue ? (
                            <button
                              type="button"
                              className="btn-acao-reverter"
                              onClick={() => handleReverterEntrega(ped)}
                              title="Reverter status da entrega e devolver as peças a Produtos Prontos"
                              aria-label={`Reverter entrega do pedido ${ped.codigo_pedido}`}
                            >
                              <RotateCcw size={14} />
                              <span>Reverter</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-acao-entregar"
                              onClick={() => setPedidoParaEntrega(ped)}
                              title="Registrar entrega ao cliente com baixa no estoque de cada cor e tamanho"
                              aria-label={`Registrar entrega ao cliente do pedido ${ped.codigo_pedido}`}
                            >
                              <Truck size={15} />
                              <span>Registrar Entrega</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {pedidoParaEntrega && (
          <ModalEntregaPedido
            pedido={pedidoParaEntrega}
            saldos={saldos}
            hoje={hoje}
            onFechar={() => setPedidoParaEntrega(null)}
            onEntregue={() => { setPedidoParaEntrega(null); carregarDados(); }}
          />
        )}
        {pedidoEmEdicao && (
          <ModalItensPedido
            pedido={pedidoEmEdicao}
            modelos={modelos}
            cores={cores}
            onFechar={() => setPedidoEmEdicao(null)}
            onSalvo={() => { setPedidoEmEdicao(null); carregarDados(); }}
          />
        )}
      </main>
    </div>
  );
}

export default PedidoCamisetas;
