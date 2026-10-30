import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  PlusCircle, 
  Calendar, 
  DollarSign, 
  Shirt, 
  CheckCircle, 
  Clock, 
  Search,
  Filter,
  Truck,
  RotateCcw,
  X,
  AlertTriangle,
  Package,
  Layers,
  Info
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './PedidoCamisetas.css';

function PedidoCamisetas() {
  const hoje = new Date().toISOString().split('T')[0];

  const [modelos, setModelos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [estoqueAcabado, setEstoqueAcabado] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [erroData, setErroData] = useState('');
  const [toast, setToast] = useState(null);

  // Formulário do novo pedido
  const [formData, setFormData] = useState({
    nome_cliente: '',
    id_modelo: '',
    grade_p: 0,
    grade_m: 0,
    grade_g: 0,
    grade_gg: 0,
    prazo_entrega: hoje,
    valor_total: '',
    observacoes: ''
  });

  // Estado do Modal de Registro de Entrega ao Cliente
  const [modalEntregaAberto, setModalEntregaAberto] = useState(false);
  const [pedidoParaEntrega, setPedidoParaEntrega] = useState(null);
  const [dadosEntrega, setDadosEntrega] = useState({
    data_entrega: hoje,
    recebedor: '',
    observacoes: ''
  });
  const [salvandoEntrega, setSalvandoEntrega] = useState(false);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resModelos, resPedidos, resAcabados] = await Promise.all([
        api.get('/camisetas/modelos/').catch(() => ({ data: [] })),
        api.get('/camisetas/pedidos/').catch(() => ({ data: [] })),
        api.get('/camisetas/estoque-acabado/').catch(() => ({ data: [] }))
      ]);
      
      const mods = resModelos.data || [];
      setModelos(mods);
      if (mods.length > 0 && !formData.id_modelo) {
        setFormData(prev => ({ ...prev, id_modelo: mods[0].id_modelo }));
      }
      setPedidos(resPedidos.data || []);
      setEstoqueAcabado(resAcabados.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados de pedidos e estoque:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const totalGrade = Number(formData.grade_p || 0) + 
                     Number(formData.grade_m || 0) + 
                     Number(formData.grade_g || 0) + 
                     Number(formData.grade_gg || 0);

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
    if (!formData.nome_cliente || !formData.id_modelo || !formData.prazo_entrega || !formData.valor_total) {
      alert("Por favor, preencha todos os campos obrigatórios marcados com asterisco (*).");
      return;
    }

    if (formData.prazo_entrega < hoje) {
      setErroData('O prazo de entrega não pode ser anterior à data de hoje.');
      alert("O prazo de entrega não pode ser anterior à data de hoje.");
      return;
    }

    if (totalGrade <= 0) {
      alert("A soma da grade de tamanhos (P, M, G, GG) deve ser superior a zero.");
      return;
    }

    try {
      const codigoGerado = `PED-${Math.floor(100 + Math.random() * 900)}`;
      await api.post('/camisetas/pedidos/', {
        codigo_pedido: codigoGerado,
        nome_cliente: formData.nome_cliente,
        id_modelo: parseInt(formData.id_modelo),
        grade_p: parseInt(formData.grade_p || 0),
        grade_m: parseInt(formData.grade_m || 0),
        grade_g: parseInt(formData.grade_g || 0),
        grade_gg: parseInt(formData.grade_gg || 0),
        prazo_entrega: formData.prazo_entrega,
        valor_total: parseFloat(formData.valor_total),
        observacoes: formData.observacoes
      });

      setToast({
        tipo: 'sucesso',
        texto: `Pedido ${codigoGerado} registrado com sucesso! Status inicial: 'Aguardando Produção'.`
      });
      
      // Limpa formulário
      setFormData({
        nome_cliente: '',
        id_modelo: modelos.length > 0 ? modelos[0].id_modelo : '',
        grade_p: 0,
        grade_m: 0,
        grade_g: 0,
        grade_gg: 0,
        prazo_entrega: hoje,
        valor_total: '',
        observacoes: ''
      });
      setErroData('');

      await carregarDados();
    } catch (err) {
      console.error("Erro ao cadastrar pedido:", err);
      alert(err.response?.data?.detail || "Erro ao salvar pedido de camiseta");
    }
  };

  // Abrir Modal de Entrega ao Cliente
  const abrirModalEntrega = (pedido) => {
    setPedidoParaEntrega(pedido);
    setDadosEntrega({
      data_entrega: hoje,
      recebedor: '',
      observacoes: ''
    });
    setModalEntregaAberto(true);
  };

  // Confirmar Entrega
  const handleConfirmarEntrega = async (e) => {
    e.preventDefault();
    if (!pedidoParaEntrega) return;

    if (!temEstoqueSuficiente) {
      alert(`Operação bloqueada: Estoque pronto insuficiente para entrega! Disponível: ${saldoProntoModelo} peças. Necessário: ${pedidoParaEntrega.quantidade_total} peças.`);
      return;
    }

    try {
      setSalvandoEntrega(true);
      await api.post(`/camisetas/pedidos/${pedidoParaEntrega.id_pedido}/entregar`, {
        data_entrega: dadosEntrega.data_entrega || hoje,
        recebedor: dadosEntrega.recebedor,
        observacoes: dadosEntrega.observacoes
      });

      setModalEntregaAberto(false);
      setToast({
        tipo: 'sucesso',
        texto: `✅ Entrega do pedido ${pedidoParaEntrega.codigo_pedido} (${pedidoParaEntrega.nome_cliente}) concluída! ${pedidoParaEntrega.quantidade_total} peças foram baixadas do Estoque Pronto e deduzidas da Produção Total no Dashboard.`
      });

      await carregarDados();
    } catch (err) {
      console.error("Erro ao registrar entrega:", err);
      alert(err.response?.data?.detail || "Erro ao registrar entrega do pedido.");
    } finally {
      setSalvandoEntrega(false);
    }
  };

  // Reverter Entrega (Controle do Usuário - IHC)
  const handleReverterEntrega = async (pedido) => {
    const confirma = window.confirm(
      `Deseja reverter a entrega do pedido ${pedido.codigo_pedido}?\n\nO status retornará para 'Aguardando Produção' e as ${pedido.quantidade_total} peças serão devolvidas ao Estoque Pronto e à Produção Total.`
    );
    if (!confirma) return;

    try {
      setLoading(true);
      await api.put(`/camisetas/pedidos/${pedido.id_pedido}/status`, {
        status_pedido: 'Aguardando Produção'
      });

      setToast({
        tipo: 'info',
        texto: `Status do pedido ${pedido.codigo_pedido} revertido para 'Aguardando Produção'. As peças foram reincorporadas ao Estoque Pronto.`
      });

      await carregarDados();
    } catch (err) {
      console.error("Erro ao reverter status do pedido:", err);
      alert(err.response?.data?.detail || "Erro ao reverter status.");
    } finally {
      setLoading(false);
    }
  };

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Totais e KPIs
  const totalPecasEstoquePronto = estoqueAcabado.reduce((acc, it) => acc + Number(it.quantidade_total || 0), 0);
  const pedidosEmAberto = pedidos.filter(p => p.status_pedido !== 'Entregue').length;
  const pedidosEntregues = pedidos.filter(p => p.status_pedido === 'Entregue').length;

  const pedidosFiltrados = pedidos.filter(p => 
    (p.nome_cliente || '').toLowerCase().includes(busca.toLowerCase()) ||
    (p.codigo_pedido || '').toLowerCase().includes(busca.toLowerCase()) ||
    (p.nome_modelo || '').toLowerCase().includes(busca.toLowerCase())
  );

  // Estoque do modelo selecionado no modal de entrega
  const estoqueModeloSelecionado = estoqueAcabado.find(
    e => e.id_modelo === pedidoParaEntrega?.id_modelo
  );
  const saldoProntoModelo = estoqueModeloSelecionado ? estoqueModeloSelecionado.quantidade_total : 0;
  const temEstoqueSuficiente = saldoProntoModelo >= (pedidoParaEntrega?.quantidade_total || 0);

  return (
    <div className="pedido-camisetas-container">
      <Sidebar />

      <main className="pedido-camisetas-main">
        {/* Toast Notificação */}
        {toast && (
          <div className={`toast-alerta-flutuante ${toast.tipo}`} role="alert" aria-live="assertive">
            <span>{toast.texto}</span>
            <button 
              type="button" 
              onClick={() => setToast(null)} 
              className="toast-btn-fechar"
              aria-label="Fechar notificação"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Cabeçalho */}
        <header className="page-header">
          <h1>
            <ShoppingCart size={28} color="#2563eb" aria-hidden="true" />
            2. Cadastro e Entrega de Pedidos do Cliente
          </h1>
          <p>
            Registre as demandas comerciais por grade (P, M, G, GG), acompanhe prazos de entrega 
            e registre a entrega final ao cliente com baixa automática no Estoque Pronto e na Produção Total.
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
                <label htmlFor="campo-nome-cliente">Nome do Cliente / Lojista *</label>
                <input 
                  id="campo-nome-cliente"
                  type="text" 
                  placeholder="Ex: Boutique Centro ou Loja Alfa Wear"
                  value={formData.nome_cliente}
                  onChange={(e) => setFormData({ ...formData, nome_cliente: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="campo-modelo-camiseta">Modelo da Camiseta Escolhido *</label>
                <select 
                  id="campo-modelo-camiseta"
                  value={formData.id_modelo}
                  onChange={(e) => setFormData({ ...formData, id_modelo: e.target.value })}
                  required
                >
                  <option value="">Selecione um modelo cadastrado...</option>
                  {modelos.map(mod => {
                    const est = estoqueAcabado.find(ea => ea.id_modelo === mod.id_modelo);
                    const saldoDisp = est ? est.quantidade_total : 0;
                    return (
                      <option key={mod.id_modelo} value={mod.id_modelo}>
                        {mod.nome_modelo} (Estoque Pronto: {saldoDisp} un.)
                      </option>
                    );
                  })}
                </select>
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

            {/* GRADE DE TAMANHOS */}
            <div className="grade-box-container">
              <div className="grade-box-title">
                <span>Distribuição da Grade de Tamanhos (P, M, G, GG)</span>
                <span className="total-grade-badge">Total do Lote: {totalGrade} peças</span>
              </div>
              <div className="grade-inputs-grid">
                <div className="grade-item">
                  <label htmlFor="grade-p">Tam. P</label>
                  <input 
                    id="grade-p"
                    type="number" 
                    min="0"
                    value={formData.grade_p}
                    onChange={(e) => setFormData({ ...formData, grade_p: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="grade-item">
                  <label htmlFor="grade-m">Tam. M</label>
                  <input 
                    id="grade-m"
                    type="number" 
                    min="0"
                    value={formData.grade_m}
                    onChange={(e) => setFormData({ ...formData, grade_m: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="grade-item">
                  <label htmlFor="grade-g">Tam. G</label>
                  <input 
                    id="grade-g"
                    type="number" 
                    min="0"
                    value={formData.grade_g}
                    onChange={(e) => setFormData({ ...formData, grade_g: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="grade-item">
                  <label htmlFor="grade-gg">Tam. GG</label>
                  <input 
                    id="grade-gg"
                    type="number" 
                    min="0"
                    value={formData.grade_gg}
                    onChange={(e) => setFormData({ ...formData, grade_gg: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

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
                  <th scope="col">Modelo</th>
                  <th scope="col">Grade (P / M / G / GG)</th>
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
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
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
                        <td>{ped.nome_modelo}</td>
                        <td>
                          <span className="grade-pill-tag">
                            P:{ped.grade_p} | M:{ped.grade_m} | G:{ped.grade_g} | GG:{ped.grade_gg}
                          </span>
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
                              title="Reverter status da entrega e reincorporar as peças ao estoque pronto"
                              aria-label={`Reverter entrega do pedido ${ped.codigo_pedido}`}
                            >
                              <RotateCcw size={14} />
                              <span>Reverter</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-acao-entregar"
                              onClick={() => abrirModalEntrega(ped)}
                              title="Registrar entrega ao cliente com baixa no Estoque Pronto e dedução na Produção Total"
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

        {/* MODAL PARA REGISTRAR ENTREGA AO CLIENTE (IHC - USABILIDADE E COMUNICABILIDADE) */}
        {modalEntregaAberto && pedidoParaEntrega && (
          <div className="modal-entrega-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-entrega-titulo">
            <div className="modal-entrega-card">
              <header className="modal-entrega-header">
                <div className="modal-header-icone-titulo">
                  <div className="modal-icone-box">
                    <Truck size={24} color="#2563eb" />
                  </div>
                  <div>
                    <h2 id="modal-entrega-titulo">Registrar Entrega ao Cliente</h2>
                    <p>Formalize o despacho do lote, baixe o Estoque Pronto e atualize a Produção Total.</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="modal-btn-fechar" 
                  onClick={() => setModalEntregaAberto(false)}
                  aria-label="Fechar janela de entrega"
                >
                  <X size={20} />
                </button>
              </header>

              <form onSubmit={handleConfirmarEntrega}>
                <div className="modal-entrega-body">
                  {/* Resumo do Pedido */}
                  <div className="resumo-pedido-box">
                    <div className="resumo-item">
                      <span className="resumo-rotulo">Pedido:</span>
                      <strong>{pedidoParaEntrega.codigo_pedido}</strong>
                    </div>
                    <div className="resumo-item">
                      <span className="resumo-rotulo">Cliente:</span>
                      <strong>{pedidoParaEntrega.nome_cliente}</strong>
                    </div>
                    <div className="resumo-item">
                      <span className="resumo-rotulo">Modelo:</span>
                      <strong>{pedidoParaEntrega.nome_modelo}</strong>
                    </div>
                    <div className="resumo-item">
                      <span className="resumo-rotulo">Volume da Grade:</span>
                      <span>P:{pedidoParaEntrega.grade_p} | M:{pedidoParaEntrega.grade_m} | G:{pedidoParaEntrega.grade_g} | GG:{pedidoParaEntrega.grade_gg}</span>
                    </div>
                    <div className="resumo-item destaque">
                      <span className="resumo-rotulo">Total a Entregar:</span>
                      <strong className="destaque-qtd">{pedidoParaEntrega.quantidade_total} peças</strong>
                    </div>
                  </div>

                  {/* Verificação do Estoque Pronto (IHC - Transparência e Prevenção de Erros) */}
                  <div className={`estoque-verificacao-box ${temEstoqueSuficiente ? 'suficiente' : 'bloqueado'}`}>
                    {temEstoqueSuficiente ? (
                      <>
                        <CheckCircle size={22} color="#16a34a" />
                        <div>
                          <strong>Estoque Pronto Suficiente: {saldoProntoModelo} peças disponíveis</strong>
                          <p>O saldo em estoque pronto atende integralmente a entrega deste pedido ({pedidoParaEntrega.quantidade_total} un.).</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={22} color="#dc2626" />
                        <div>
                          <strong className="texto-estoque-bloqueado">Bloqueio de Entrega: Estoque Pronto Insuficiente</strong>
                          <p>
                            O estoque pronto atual possui <strong>{saldoProntoModelo} peças</strong>, mas a entrega deste pedido requer <strong>{pedidoParaEntrega.quantidade_total} peças</strong> (faltam {pedidoParaEntrega.quantidade_total - saldoProntoModelo} un.). A confirmação da entrega está bloqueada até que as peças sejam produzidas.
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Informações da Entrega */}
                  <div className="modal-form-grid">
                    <div className="form-group">
                      <label htmlFor="data-entrega-confirmada">Data da Entrega Realizada *</label>
                      <input 
                        id="data-entrega-confirmada"
                        type="date" 
                        value={dadosEntrega.data_entrega}
                        onChange={(e) => setDadosEntrega({ ...dadosEntrega, data_entrega: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="recebedor-nome">Nome do Recebedor / Responsável</label>
                      <input 
                        id="recebedor-nome"
                        type="text" 
                        placeholder="Ex: Carlos (Gerente Loja Centro)"
                        value={dadosEntrega.recebedor}
                        onChange={(e) => setDadosEntrega({ ...dadosEntrega, recebedor: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '0.8rem' }}>
                    <label htmlFor="obs-entrega">Comentários ou Observações da Entrega (Opcional)</label>
                    <textarea 
                      id="obs-entrega"
                      rows="2"
                      placeholder="Ex: Lote entregue conferido e assinado, nota fiscal acompanhando o motorista..."
                      value={dadosEntrega.observacoes}
                      onChange={(e) => setDadosEntrega({ ...dadosEntrega, observacoes: e.target.value })}
                    ></textarea>
                  </div>

                  {/* Explicação de Impacto nos Pilares IHC */}
                  <div className="aviso-impacto-ihc">
                    <Info size={18} color="#2563eb" />
                    <span>
                      <strong>Impacto Automático no Sistema:</strong> Ao confirmar, o status passará para <strong>Entregue</strong>, 
                      serão baixadas <strong>{pedidoParaEntrega.quantidade_total} peças</strong> do Estoque Pronto e 
                      o card <strong>Produção Total</strong> no Dashboard Geral diminuirá na mesma quantidade entregue.
                    </span>
                  </div>
                </div>

                <footer className="modal-entrega-footer">
                  <button 
                    type="button" 
                    className="modal-btn-cancelar" 
                    onClick={() => setModalEntregaAberto(false)}
                    disabled={salvandoEntrega}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className={`modal-btn-confirmar ${!temEstoqueSuficiente ? 'btn-bloqueado' : ''}`}
                    disabled={salvandoEntrega || !temEstoqueSuficiente}
                    title={!temEstoqueSuficiente ? `Entrega bloqueada: Estoque insuficiente (${saldoProntoModelo}/${pedidoParaEntrega.quantidade_total} peças)` : "Confirmar Entrega e Baixar Estoque"}
                  >
                    <CheckCircle size={18} />
                    <span>
                      {salvandoEntrega 
                        ? 'Processando Baixa...' 
                        : (!temEstoqueSuficiente ? 'Entrega Bloqueada (Sem Estoque)' : 'Confirmar Entrega e Baixar Estoque')
                      }
                    </span>
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PedidoCamisetas;
