import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingCart,
  PlusCircle,
  CheckCircle,
  Search,
  Truck,
  RotateCcw,
  AlertTriangle,
  Link2,
  Printer,
  Pencil,
  Trash2,
  Menu,
  X,
  Scissors,
} from 'lucide-react';
import api from '../services/api';
import { paraCampoNumerico } from '../utils/numeros';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/feedback/useToast';
import { useConfirm } from '../components/feedback/useConfirm';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
import { SeletorCliente } from '../components/cadastros/SeletorCliente';
import { ItensPedidoEditor } from '../components/pedidos/ItensPedidoEditor';
import { ModalItensPedido } from '../components/pedidos/ModalItensPedido';
import { ModalEntregaPedido } from '../components/pedidos/ModalEntregaPedido';
import { ModalPdfPedido } from '../components/pedidos/ModalPdfPedido';
import {
  itemParaApi,
  itemVazio,
  problemaDosItens,
  resumoDoItem,
  saldosDosProdutos,
  totalCalculadoDosItens,
} from '../utils/pedidoItens';
import './PedidoCamisetas.css';

const formularioVazio = (hoje, idModelo = '', idCor = '') => ({
  cliente: null,
  itens: [itemVazio(1, idModelo, idCor)],
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
  const [estampas, setEstampas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [erroData, setErroData] = useState('');
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const toast = useToast();
  const confirmar = useConfirm();

  // Formulário do novo pedido
  const [formData, setFormData] = useState(() => formularioVazio(hoje));
  const [valorManual, setValorManual] = useState(false);
  const valorTabelado = useMemo(() => totalCalculadoDosItens(formData.itens, modelos), [formData.itens, modelos]);
  const valorExibido = valorManual
    ? formData.valor_total
    : valorTabelado > 0
      ? paraCampoNumerico(valorTabelado)
      : formData.valor_total;

  // Modais: entrega ao cliente, edição dos itens e exportação de PDF
  const [pedidoParaEntrega, setPedidoParaEntrega] = useState(null);
  const [pedidoEmEdicao, setPedidoEmEdicao] = useState(null);
  const [pedidoParaPdf, setPedidoParaPdf] = useState(null);

  // Seleção múltipla para exportar PDF em lote
  const [selecionados, setSelecionados] = useState(new Set());

  const carregarDados = async () => {
    setLoading(true);
    const { dados, houveFalha } = await buscarEmParalelo([
      '/camisetas/modelos/', '/camisetas/pedidos/', '/camisetas/produtos-prontos/', '/camisetas/cores/', '/camisetas/estampas/',
    ]);
    const [mods, listaPedidos, prontos, listaCores, listaEstampas] = dados;
    setModelos(mods);
    setFormData((atual) => ({
      ...atual,
      itens: atual.itens.map((item, indice) =>
        indice === 0
          ? {
              ...item,
              id_modelo: item.id_modelo || (mods[0] ? String(mods[0].id_modelo) : ''),
              id_cor: item.id_cor || (listaCores[0] ? String(listaCores[0].id_cor) : ''),
            }
          : item
      ),
    }));
    setPedidos(listaPedidos);
    setProdutosProntos(prontos);
    setCores(listaCores);
    setEstampas(listaEstampas);
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
    if (!formData.prazo_entrega || (valorExibido === '' && valorTabelado <= 0)) {
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
      const valorFinal = valorExibido !== '' ? parseFloat(valorExibido) : valorTabelado;
      const { data: pedidoCriado } = await api.post('/camisetas/pedidos/', {
        id_cliente: formData.cliente.id_cliente,
        itens: formData.itens.map(itemParaApi),
        prazo_entrega: formData.prazo_entrega,
        valor_total: valorFinal,
        observacoes: formData.observacoes,
      });
      toast.sucesso(`Pedido ${pedidoCriado.codigo_pedido} registrado com ${pedidoCriado.quantidade_total} peças. Status inicial: 'Aguardando Produção'.`);
      setFormData(formularioVazio(hoje, modelos[0]?.id_modelo ?? '', cores[0]?.id_cor ?? ''));
      setValorManual(false);
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

  // Excluir pedido com confirmação
  const handleExcluirPedido = async (pedido) => {
    const confirmou = await confirmar({
      titulo: `Excluir pedido ${pedido.codigo_pedido}?`,
      mensagem: `Esta ação removerá permanentemente o pedido de "${pedido.nome_cliente}". Pedidos já entregues não podem ser excluídos.`,
      textoConfirmar: 'Excluir pedido',
      perigo: true,
    });
    if (!confirmou) return;

    try {
      setLoading(true);
      await api.delete(`/camisetas/pedidos/${pedido.id_pedido}`);
      toast.sucesso(`Pedido ${pedido.codigo_pedido} excluído com sucesso.`);
      setSelecionados((prev) => { const s = new Set(prev); s.delete(pedido.id_pedido); return s; });
      await carregarDados();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível excluir o pedido.'));
    } finally {
      setLoading(false);
    }
  };

  // Seleção múltipla
  const toggleSelecionado = useCallback((id) => {
    setSelecionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }, []);

  const toggleTodos = useCallback((pedidosFiltrados) => {
    setSelecionados((prev) => {
      const idsFiltrados = pedidosFiltrados.map((p) => p.id_pedido);
      const todosSelecionados = idsFiltrados.every((id) => prev.has(id));
      if (todosSelecionados) {
        const s = new Set(prev);
        idsFiltrados.forEach((id) => s.delete(id));
        return s;
      }
      const s = new Set(prev);
      idsFiltrados.forEach((id) => s.add(id));
      return s;
    });
  }, []);

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const copiarLinkAprovacao = async (pedido) => {
    if (!pedido.token_aprovacao) return;
    const url = `${window.location.origin}/portal/pedido/${pedido.token_aprovacao}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.sucesso(`Link de aprovação do pedido ${pedido.codigo_pedido} copiado!`);
    } catch {
      toast.info(`Link de aprovação: ${url}`);
    }
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
    (p.itens || []).some(
      (i) =>
        i.nome_modelo.toLowerCase().includes(termo) ||
        (i.nome_estampa || '').toLowerCase().includes(termo) ||
        (i.codigo_estampa || '').toLowerCase().includes(termo)
    )
  );

  return (
    <div className="pedido-camisetas-container">
      {/* CABEÇALHO MOBILE (Só aparece no celular) */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-box-sm">
            <Scissors size={20} color="#2563eb" strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>Confecção Alfa</h2>
        </div>
        <button 
          type="button"
          className="btn-menu-mobile" 
          onClick={() => setMenuMobileAberto(!menuMobileAberto)}
          aria-label="Abrir menu de navegação"
        >
          {menuMobileAberto ? <X size={24} color="#1f2937" /> : <Menu size={24} color="#1f2937" />}
        </button>
      </div>

      {/* Backdrop escuro para fechar ao tocar fora no mobile */}
      {menuMobileAberto && (
        <div className="sidebar-backdrop" onClick={() => setMenuMobileAberto(false)} aria-hidden="true" />
      )}

      <Sidebar menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto} />

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
                  placeholder="Calculado pelos itens ou digite..."
                  value={valorExibido}
                  onChange={(e) => {
                    setValorManual(true);
                    setFormData({ ...formData, valor_total: e.target.value });
                  }}
                  required
                />
                {valorManual && valorTabelado > 0 && (
                  <button
                    type="button"
                    className="btn-link-itens"
                    onClick={() => {
                      setValorManual(false);
                      setFormData((atual) => ({ ...atual, valor_total: '' }));
                    }}
                  >
                    Usar valor tabelado ({formatarMoeda(valorTabelado)})
                  </button>
                )}
              </div>
            </div>

            <ItensPedidoEditor
              itens={formData.itens}
              onChange={(itens) => setFormData((atual) => ({ ...atual, itens }))}
              modelos={modelos}
              cores={cores}
              estampas={estampas}
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

            <button type="submit" className="btn-salvar-pedido btn-acao-rapida" disabled={loading || !!erroData}>
              <CheckCircle size={18} />
              <span>Salvar Pedido (Status: Aguardando Produção)</span>
            </button>
          </form>
        </div>

        {/* TABELA DE PEDIDOS SALVOS */}
        <div className="table-card">
          {/* Cabeçalho: título à esquerda, busca + botão PDF à direita */}
          <div className="table-header-box">
            <h2>Pedidos Comerciais ({pedidosFiltrados.length})</h2>

            <div className="tabela-controles-direita">
              <div className="busca-pedidos-wrapper">
                <Search size={15} className="busca-pedidos-icone" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, modelo ou código..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="busca-pedidos-input"
                  aria-label="Buscar pedidos"
                />
              </div>

              <button
                type="button"
                className={`btn-exportar-pdf-global ${selecionados.size === 0 ? 'desabilitado' : ''}`}
                disabled={selecionados.size === 0}
                onClick={() => {
                  // Abre o modal de PDF para o primeiro selecionado
                  // Para múltiplos, o modal já existe e suportamos a exportação individual
                  const primeiro = pedidosFiltrados.find((p) => selecionados.has(p.id_pedido));
                  if (primeiro) setPedidoParaPdf(primeiro);
                }}
                title={selecionados.size === 0 ? 'Selecione ao menos um pedido' : `Exportar PDF de ${selecionados.size} pedido(s) selecionado(s)`}
              >
                <Printer size={15} />
                Exportar PDF{selecionados.size > 0 ? ` (${selecionados.size})` : ''}
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="pedidos-table" aria-label="Tabela de pedidos comerciais">
              <thead>
                <tr>
                  {/* Checkbox selecionar todos */}
                  <th scope="col" className="col-checkbox">
                    <input
                      type="checkbox"
                      className="checkbox-pedido"
                      checked={pedidosFiltrados.length > 0 && pedidosFiltrados.every((p) => selecionados.has(p.id_pedido))}
                      onChange={() => toggleTodos(pedidosFiltrados)}
                      title="Selecionar / desmarcar todos"
                      aria-label="Selecionar todos os pedidos visíveis"
                    />
                  </th>
                  <th scope="col">Código</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Itens</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Total Peças</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Prazo Entrega</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Valor Total</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Ação de Entrega</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      Nenhum pedido de camiseta encontrado.
                    </td>
                  </tr>
                ) : (
                  pedidosFiltrados.map((ped) => {
                    const isEntregue = ped.status_pedido === 'Entregue';
                    const isSelecionado = selecionados.has(ped.id_pedido);
                    return (
                      <tr
                        key={ped.id_pedido}
                        className={[
                          isEntregue ? 'linha-entregue' : '',
                          isSelecionado ? 'linha-selecionada' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {/* Checkbox linha */}
                        <td className="col-checkbox">
                          <input
                            type="checkbox"
                            className="checkbox-pedido"
                            checked={isSelecionado}
                            onChange={() => toggleSelecionado(ped.id_pedido)}
                            aria-label={`Selecionar pedido ${ped.codigo_pedido}`}
                          />
                        </td>

                        {/* Código */}
                        <td><strong className="codigo-pedido-pill">{ped.codigo_pedido}</strong></td>

                        {/* Cliente */}
                        <td className="col-cliente">{ped.nome_cliente}</td>

                        {/* Itens */}
                        <td className="col-itens">
                          <ul className="pedido-itens-resumo">
                            {ped.itens.map((item) => (
                              <li key={item.id_item} className={`pedido-item-linha ${item.id_cor ? '' : 'sem-cor'}`}>
                                {item.imagem_estampa_url && (
                                  <img
                                    src={item.imagem_estampa_url}
                                    alt={item.nome_estampa || 'Estampa'}
                                    className="pedido-item-thumb-mini"
                                  />
                                )}
                                <span>{resumoDoItem(item)}</span>
                              </li>
                            ))}
                          </ul>
                          {/* Tamanhos em tags compactas */}
                          {ped.itens.some((it) => it.quantidades && Object.keys(it.quantidades).length > 0) && (
                            <div className="tamanhos-tags-linha">
                              {ped.itens.flatMap((it) =>
                                Object.entries(it.quantidades || {})
                                  .filter(([, qty]) => qty > 0)
                                  .map(([tam, qty]) => (
                                    <span key={`${it.id_item}-${tam}`} className="tamanho-tag-mini">
                                      {tam}: {qty}
                                    </span>
                                  ))
                              )}
                            </div>
                          )}
                          {!isEntregue && (
                            <button
                              type="button"
                              className="btn-editar-itens"
                              onClick={() => setPedidoEmEdicao(ped)}
                            >
                              <Pencil size={12} />
                              {ped.itens.some((item) => !item.id_cor) ? 'Definir cor' : 'Editar itens'}
                            </button>
                          )}
                        </td>

                        {/* Total Peças */}
                        <td style={{ textAlign: 'center' }}>
                          <strong>{ped.quantidade_total} un.</strong>
                        </td>

                        {/* Prazo Entrega */}
                        <td style={{ textAlign: 'center' }}>
                          {new Date(ped.prazo_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </td>

                        {/* Valor Total */}
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <strong>{formatarMoeda(ped.valor_total)}</strong>
                        </td>

                        {/* Status */}
                        <td>
                          <div className="status-coluna-bloco">
                            <span className={`badge-status-pedido ${
                              isEntregue ? 'concluido' :
                              ped.status_pedido.includes('Produção') ? 'producao' : 'aguardando'
                            }`}>
                              {isEntregue ? 'Entregue ao Cliente' : ped.status_pedido}
                            </span>
                            <span className={`badge-status-cliente ${
                              (ped.status_aprovacao_cliente || '').toLowerCase() === 'aprovado' ? 'aprovado' : 'pendente'
                            }`}>
                              Cliente: {ped.status_aprovacao_cliente || 'Pendente'}
                            </span>
                            {ped.observacao_cliente && (
                              <div className="obs-cliente-inline">
                                "{ped.observacao_cliente}"
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Ação de Entrega */}
                        <td style={{ textAlign: 'center' }}>
                          <div className="acoes-coluna-bloco">
                            {/* Link de aprovação */}
                            {ped.token_aprovacao && (
                              <button
                                type="button"
                                className="btn-acao-secundaria"
                                onClick={() => copiarLinkAprovacao(ped)}
                                title="Copiar link para o cliente ver e aprovar o pedido no celular"
                              >
                                <Link2 size={13} />
                                Link de aprovação
                              </button>
                            )}

                            {/* Reverter ou Registrar Entrega */}
                            {isEntregue ? (
                              <button
                                type="button"
                                className="btn-acao-reverter"
                                onClick={() => handleReverterEntrega(ped)}
                                title="Reverter status da entrega e devolver as peças a Produtos Prontos"
                                aria-label={`Reverter entrega do pedido ${ped.codigo_pedido}`}
                              >
                                <RotateCcw size={13} />
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
                                <Truck size={14} />
                                <span>Registrar Entrega</span>
                              </button>
                            )}

                            {/* Excluir pedido */}
                            <button
                              type="button"
                              className="btn-excluir-pedido"
                              onClick={() => handleExcluirPedido(ped)}
                              title="Excluir pedido"
                              aria-label={`Excluir pedido ${ped.codigo_pedido}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
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
            estampas={estampas}
            onFechar={() => setPedidoEmEdicao(null)}
            onSalvo={() => { setPedidoEmEdicao(null); carregarDados(); }}
          />
        )}
        {pedidoParaPdf && (
          <ModalPdfPedido
            pedido={pedidoParaPdf}
            onFechar={() => setPedidoParaPdf(null)}
          />
        )}
      </main>
    </div>
  );
}

export default PedidoCamisetas;
