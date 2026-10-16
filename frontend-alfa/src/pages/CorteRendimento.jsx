import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ShoppingCart, Crop, Scissors, Users, LogOut,
  Plus, Search, CheckCircle, Activity, X, ArrowRight, Menu, GitBranch, Layers
} from 'lucide-react';

import api from '../services/api';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import WorkflowStepper from '../components/WorkflowStepper';
import './CorteRendimento.css';


function CorteRendimento() {
  const navigate = useNavigate();
  const userName = 'Gestor Alfa';

  const [ordens, setOrdens] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Controle do menu mobile
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  // Modais
  const [showModalEnvio, setShowModalEnvio] = useState(false);
  const [showModalRetorno, setShowModalRetorno] = useState(false);
  const [showModalWorkflow, setShowModalWorkflow] = useState(false);
  const [opGradeModal, setOpGradeModal] = useState(null);

  // Estados de Contexto e Workflow Dinâmico
  const [contextos, setContextos] = useState([]);
  const [dadosContextoOP, setDadosContextoOP] = useState({});
  const [statusWorkflowOP, setStatusWorkflowOP] = useState(null);
  const [avancoData, setAvancoData] = useState({
    quantidade_concluida: '',
    quantidade_perda: 0,
    responsavel_oficina: '',
    observacoes: ''
  });

  // Estados dos formulários mapeados com o seu JSON
  const [novaOP, setNovaOP] = useState({
    codigo_op: '',
    id_produto: '',
    peso_malha_enviado: ''
  });

  const [dadosRetorno, setDadosRetorno] = useState({
    id_op: null,
    codigo_op_exibicao: '',
    quantidade_pecas_cortadas: ''
  });


 const carregarDados = async () => {
    try {
      setLoading(true);
      // 1. Busca as OPs 
      const resOrdens = await api.get('/producao/ordens');
      setOrdens(resOrdens.data || []);

      // 2. Busca os produtos e contextos
      const resProdutos = await api.get('/produtos/');
      setProdutos(resProdutos.data || []);

      const resContextos = await api.get('/contextos/').catch(() => ({ data: [] }));
      setContextos(resContextos.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados de corte:", error);
    } finally {
      setLoading(false);
    }

  };

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) navigate('/');
    else carregarDados();
  }, [navigate]);

  // AÇÃO 1: Enviar para o Corte
  const handleEnviarParaCorte = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        codigo_op: novaOP.codigo_op,
        id_produto: parseInt(novaOP.id_produto),
        peso_malha_enviado: parseFloat(novaOP.peso_malha_enviado || 0),
        dados_contexto: dadosContextoOP
      };

      // Endpoint: enviar para o corte
      await api.post('/producao/ordens', payload);
      alert('OP criada e iniciada no fluxo produtivo com sucesso!');
      
      setShowModalEnvio(false);
      setNovaOP({ codigo_op: '', id_produto: '', peso_malha_enviado: '' });
      setDadosContextoOP({});
      carregarDados();
    } catch (error) {
      console.error("Erro ao enviar para corte:", error);
      alert('Erro ao criar OP. Verifique os dados.');
    }
  };

  // Abrir Modal de Workflow da OP
  const abrirModalWorkflow = async (idOp) => {
    try {
      const res = await api.get(`/contextos/ordens/${idOp}/status-workflow`);
      setStatusWorkflowOP(res.data);
      setAvancoData({
        quantidade_concluida: '',
        quantidade_perda: 0,
        responsavel_oficina: '',
        observacoes: ''
      });
      setShowModalWorkflow(true);
    } catch (err) {
      console.error("Erro ao carregar workflow da OP:", err);
      alert("Não foi possível carregar a esteira desta OP.");
    }
  };

  // Avançar Etapa na Esteira Produtiva
  const handleAvancarEtapa = async (e) => {
    e.preventDefault();
    if (!statusWorkflowOP) return;

    try {
      const payload = {
        quantidade_concluida: parseInt(avancoData.quantidade_concluida),
        quantidade_perda: parseInt(avancoData.quantidade_perda || 0),
        responsavel_oficina: avancoData.responsavel_oficina,
        observacoes: avancoData.observacoes,
        dados_customizados: {}
      };

      const res = await api.post(`/contextos/ordens/${statusWorkflowOP.id_op}/avancar-etapa`, payload);
      setStatusWorkflowOP(res.data);
      alert('Etapa concluída e OP avançada com sucesso na esteira!');
      carregarDados();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erro ao avançar etapa da OP.");
    }
  };


  const abrirModalRetorno = (op) => {
    setDadosRetorno({
      id_op: op.id_op, 
      codigo_op_exibicao: op.codigo_op,
      quantidade_pecas_cortadas: ''
    });
    setShowModalRetorno(true);
  };

  // AÇÃO 2: Registrar Retorno do Corte
  const handleRegistrarRetorno = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        quantidade_pecas_cortadas: parseInt(dadosRetorno.quantidade_pecas_cortadas)
      };

      // Endpoint: registrar retorno
      await api.put(`/producao/ordens/${dadosRetorno.id_op}/retorno-corte`, payload);
      alert('Retorno registrado com sucesso!');
      
      setShowModalRetorno(false);
      carregarDados();
    } catch (error) {
      console.error("Erro ao registrar retorno:", error);
      alert('Erro ao registrar o retorno do corte.');
    }
  };

  const ordensFiltradas = ordens.filter(op => 
    (op.codigo_op || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      {/* CABEÇALHO MOBILE (Só aparece no celular) */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-box-sm">
            <Scissors size={20} color="#00c875" strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>Confecção Alfa</h2>
        </div>
        <button className="btn-menu-mobile" onClick={() => setMenuMobileAberto(!menuMobileAberto)}>
          {menuMobileAberto ? <X size={24} color="#1f2937" /> : <Menu size={24} color="#1f2937" />}
        </button>
      </div>

      {/* Sidebar Dinâmica */}
      <aside className={`sidebar ${menuMobileAberto ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-box-sm"><Scissors size={22} color="#00c875" strokeWidth={2} /></div>
          <h2>Confecção Alfa</h2>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item" onClick={() => { navigate('/dashboard'); setMenuMobileAberto(false); }}><LayoutDashboard size={19} /><span>Dashboard</span></button>
          <button className="nav-item" onClick={() => { navigate('/estoque'); setMenuMobileAberto(false); }}><Package size={19} /><span>Estoque</span></button>
          <button className="nav-item" onClick={() => { navigate('/ficha-tecnica'); setMenuMobileAberto(false); }}><FileText size={19} /><span>Ficha Técnica</span></button>
          <button className="nav-item" onClick={() => { navigate('/comercial'); setMenuMobileAberto(false); }}><ShoppingCart size={19} /><span>Comercial</span></button>
          <button className="nav-item active" onClick={() => { navigate('/corte-rendimento'); setMenuMobileAberto(false); }}><Crop size={19} /><span>Corte/Rendimento</span></button>
          <button className="nav-item" onClick={() => { navigate('/costura'); setMenuMobileAberto(false); }}><Scissors size={19} /><span>Costura</span></button>
          <button className="nav-item" onClick={() => { navigate('/equipe'); setMenuMobileAberto(false); }}><Users size={19} /><span>Equipe</span></button>
          <button className="nav-item" onClick={() => { navigate('/configuracoes'); setMenuMobileAberto(false); }}><Users size={19} /><span>Configurações</span></button>
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item logout" onClick={() => { localStorage.removeItem('token_confeccao'); navigate('/'); }}><LogOut size={19} /><span>Sair</span></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>Corte e Rendimento</h1>
            <p className="subtitle">Gestão de Ordens de Produção (OPs) e acompanhamento</p>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">Administração</span>
            </div>
            <div className="avatar">A</div>
          </div>
        </header>

        <section className="action-bar-card">
          <div className="search-filter-group">
            <div className="search-box">
              <Search size={18} color="#9ca3af" />
              <input 
                type="text" 
                placeholder="Buscar por OP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <button className="primary-btn" onClick={() => setShowModalEnvio(true)}>
            <Plus size={18} />
            <span>Nova OP</span>
          </button>
        </section>

        <section className="table-card">
          {/* A MÁGICA ACONTECE AQUI: Esta div permite a rolagem lateral no mobile! */}
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Código OP</th>
                  <th>Produto & Referência</th>
                  <th>Material / Tecido</th>
                  <th>Peças Cortadas</th>
                  <th>Grade 2D</th>
                  <th>Status na Fábrica</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>Carregando...</td></tr>
                ) : ordensFiltradas.length === 0 ? (
                  <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>Nenhuma OP encontrada.</td></tr>
                ) : (
                  ordensFiltradas.map((op) => {
                    const corteFinalizado = op.quantidade_pecas_cortadas > 0 || op.status_op === 'Corte Finalizado';
                    const infoProduto = produtos.find(p => (p.id_produto || p.id) === op.id_produto) || {};
                    const temGrade = op.grade_distribuicao && Object.keys(op.grade_distribuicao).length > 0;

                    // Mapeia estilo visual do status industrial
                    let statusBadgeClass = 'amber';
                    const st = op.status_op || 'Enviado para Corte';
                    if (st === 'Corte Finalizado' || st === 'Finalizado') statusBadgeClass = 'green';
                    else if (st === 'Em Costura') statusBadgeClass = 'blue';
                    else if (st === 'Em Lavanderia') statusBadgeClass = 'purple';
                    else if (st === 'Em Estamparia') statusBadgeClass = 'orange';

                    return (
                      <tr key={op.id_op || op.id}>
                        <td className="font-semibold text-gray-800">
                          <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{op.codigo_op}</span>
                        </td>
                        
                        {/* Exibindo Modelo e Referência */}
                        <td className="font-medium text-gray-700">
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600 }}>
                              {infoProduto.nome_modelo || infoProduto.nome || 'Produto Desconhecido'}
                            </span>
                            {infoProduto.referencia_codigo && (
                              <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                Ref: {infoProduto.referencia_codigo} {infoProduto.nome_contexto && `• ${infoProduto.nome_contexto}`}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Material Enviado / Consumo */}
                        <td className="font-bold text-gray-700">
                          {op.peso_malha_enviado && parseFloat(op.peso_malha_enviado) > 0 ? (
                            `${op.peso_malha_enviado} kg`
                          ) : op.dados_enfesto?.metragem_denim_consumida_m ? (
                            `${op.dados_enfesto.metragem_denim_consumida_m} m (Denim)`
                          ) : op.dados_enfesto?.metragem_total_tecido_m ? (
                            `${op.dados_enfesto.metragem_total_tecido_m} m (Microfibra)`
                          ) : (
                            <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>Métrico</span>
                          )}
                        </td>

                        {/* Peças e Rendimento */}
                        <td className={corteFinalizado ? "font-bold text-green-600" : "text-gray-400"}>
                          {corteFinalizado ? (
                            <div>
                              <div>{op.quantidade_pecas_cortadas} un</div>
                              {op.rendimento_real && (
                                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'normal' }}>
                                  ({op.rendimento_real} pçs/kg)
                                </span>
                              )}
                            </div>
                          ) : 'Pendente'}
                        </td>

                        {/* Grade 2D */}
                        <td>
                          {temGrade ? (
                            <button
                              className="secondary-btn"
                              style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setOpGradeModal(op)}
                              title="Visualizar distribuição de grade por cor e tamanho"
                            >
                              <Layers size={13} color="#2563eb" /> Matriz
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Padrão</span>
                          )}
                        </td>

                        {/* Status Industrial */}
                        <td>
                          <span className={`status-badge ${statusBadgeClass}`}>
                            <Activity size={13} /> {st}
                          </span>
                        </td>

                        {/* Ações */}
                        <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            className="secondary-btn"
                            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Ver esteira de produção e avançar etapas"
                            onClick={() => abrirModalWorkflow(op.id_op || op.id)}
                          >
                            <GitBranch size={13} color="#00c875" /> Esteira
                          </button>

                          {!corteFinalizado && (
                            <button 
                              className="primary-btn-outline"
                              title="Registrar Retorno"
                              onClick={() => abrirModalRetorno(op)}
                            >
                              Retorno <ArrowRight size={14} />
                            </button>
                          )}
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>{/* FIM DA DIV TABLE-RESPONSIVE */}
        </section>
      </main>

      {/* MODAL DE ENVIO */}
      {showModalEnvio && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Enviar para Corte</h2>
              <button className="close-btn" onClick={() => setShowModalEnvio(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEnviarParaCorte} className="modal-form">
              <div className="input-group">
                <label>Código da OP</label>
                <input 
                  type="text" 
                  value={novaOP.codigo_op}
                  placeholder="Ex: OP#101"
                  onChange={(e) => setNovaOP({...novaOP, codigo_op: e.target.value})}
                  required 
                />
              </div>

              <div className="input-group">
                <label>Modelo / Peça a ser Produzida</label>
                <select 
                  value={novaOP.id_produto}
                  onChange={(e) => {
                    setNovaOP({...novaOP, id_produto: e.target.value});
                    setDadosContextoOP({});
                  }}
                  required
                >
                  <option value="">Selecione o modelo...</option>
                  {produtos.map(p => (
                    <option key={p.id_produto || p.id} value={p.id_produto || p.id}>
                      {p.nome_modelo || p.nome} {p.nome_contexto ? `[${p.nome_contexto}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Adaptação Contextual do Formulário */}
              {(() => {
                const produtoSel = produtos.find(p => (p.id_produto || p.id) === parseInt(novaOP.id_produto));
                const contextoSel = contextos.find(c => c.id_contexto === produtoSel?.id_contexto);

                const pedePeso = contextoSel ? contextoSel.habilita_rendimento_peso : true;
                const labelMateria = pedePeso ? "Peso de Malha Enviado (kg)" : "Metragem de Tecido Enviada (m) / Previsto";

                return (
                  <>
                    {contextoSel && (
                      <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#166534', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
                            {contextoSel.codigo}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#166534' }}>
                            Fluxo: {contextoSel.nome}
                          </span>
                        </div>
                        <p style={{ fontSize: '11px', color: '#15803d', margin: '4px 0 0 0' }}>
                          {contextoSel.descricao}
                        </p>

                        {/* Mini Pipeline Preview */}
                        <WorkflowStepper etapas={contextoSel.etapas || []} />
                      </div>
                    )}

                    <div className="input-group">
                      <label>{labelMateria}</label>
                      <input 
                        type="number" 
                        step="0.001" 
                        placeholder={pedePeso ? "Ex: 25.500" : "Ex: 15.000"}
                        value={novaOP.peso_malha_enviado}
                        onChange={(e) => setNovaOP({...novaOP, peso_malha_enviado: e.target.value})}
                        required={pedePeso}
                      />
                    </div>

                    {/* Campos dinâmicos configurados no Contexto (JSON Schema) */}
                    {contextoSel?.schema_campos_customizados?.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>
                          Especificações da Peça ({contextoSel.nome})
                        </label>
                        <DynamicFormRenderer 
                          schema={contextoSel.schema_campos_customizados}
                          values={dadosContextoOP}
                          onChange={(campo, val) => setDadosContextoOP({...dadosContextoOP, [campo]: val})}
                        />
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalEnvio(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar e Iniciar OP</button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL DE RETORNO */}
      {showModalRetorno && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Registrar Retorno - {dadosRetorno.codigo_op_exibicao}</h2>
              <button className="close-btn" onClick={() => setShowModalRetorno(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRegistrarRetorno} className="modal-form">
              <div className="input-group">
                <label>Quantidade de Peças Cortadas</label>
                <input 
                  type="number" 
                  value={dadosRetorno.quantidade_pecas_cortadas}
                  onChange={(e) => setDadosRetorno({...dadosRetorno, quantidade_pecas_cortadas: e.target.value})}
                  required 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalRetorno(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar Retorno</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE WORKFLOW / ESTEIRA DA OP */}
      {showModalWorkflow && statusWorkflowOP && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h2>Esteira de Produção - {statusWorkflowOP.codigo_op}</h2>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  {statusWorkflowOP.nome_produto} {statusWorkflowOP.contexto ? `[${statusWorkflowOP.contexto.nome}]` : ''}
                </span>
              </div>
              <button className="close-btn" onClick={() => setShowModalWorkflow(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>
                  Status Atual: <span style={{ color: '#00c875' }}>{statusWorkflowOP.status_op}</span>
                </span>
                {statusWorkflowOP.contexto && (
                  <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                    {statusWorkflowOP.contexto.codigo}
                  </span>
                )}
              </div>

              {/* Stepper Visual da Esteira */}
              <WorkflowStepper 
                etapas={statusWorkflowOP.todas_etapas || []} 
                etapaAtualId={statusWorkflowOP.etapa_atual?.id_etapa}
              />

              {/* Se a OP ainda tem etapas a percorrer, exibe o formulário de avanço */}
              {statusWorkflowOP.etapa_atual ? (
                <form onSubmit={handleAvancarEtapa} className="modal-form" style={{ marginTop: '16px', backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937', margin: '0 0 8px 0' }}>
                    Concluir Etapa: <span style={{ color: '#15803d' }}>{statusWorkflowOP.etapa_atual.nome_etapa}</span>
                  </h4>
                  {statusWorkflowOP.etapa_atual.descricao_instrucao && (
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px 0' }}>
                      Instruções: {statusWorkflowOP.etapa_atual.descricao_instrucao}
                    </p>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="input-group">
                      <label>Peças Aprovadas/Concluídas</label>
                      <input 
                        type="number" 
                        value={avancoData.quantidade_concluida} 
                        onChange={(e) => setAvancoData({...avancoData, quantidade_concluida: e.target.value})}
                        placeholder="Ex: 120"
                        required 
                      />
                    </div>
                    <div className="input-group">
                      <label>Perdas / Refugos (un)</label>
                      <input 
                        type="number" 
                        value={avancoData.quantidade_perda} 
                        onChange={(e) => setAvancoData({...avancoData, quantidade_perda: e.target.value})}
                        placeholder="Ex: 2"
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>
                      {statusWorkflowOP.etapa_atual.tipo_operacao === 'EXTERNA' 
                        ? 'Oficina Terceirizada / Facção Responsável' 
                        : 'Operador / Responsável Interno'}
                    </label>
                    <input 
                      type="text" 
                      value={avancoData.responsavel_oficina} 
                      onChange={(e) => setAvancoData({...avancoData, responsavel_oficina: e.target.value})}
                      placeholder="Ex: Oficina Confecções Estrela ou Operador Carlos"
                    />
                  </div>

                  <div className="input-group">
                    <label>Observações do Apontamento</label>
                    <input 
                      type="text" 
                      value={avancoData.observacoes} 
                      onChange={(e) => setAvancoData({...avancoData, observacoes: e.target.value})}
                      placeholder="Ex: Lote finalizado sem defeitos de costura."
                    />
                  </div>

                  <button type="submit" className="primary-btn" style={{ marginTop: '12px', width: '100%', padding: '10px' }}>
                    Concluir Etapa e Avançar Esteira
                  </button>
                </form>
              ) : (
                <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center', marginTop: '16px' }}>
                  <CheckCircle size={28} color="#00c875" style={{ margin: '0 auto 6px auto' }} />
                  <h4 style={{ color: '#166534', margin: '0 0 4px 0' }}>Produção desta OP Finalizada!</h4>
                  <p style={{ color: '#15803d', fontSize: '13px', margin: 0 }}>
                    Todas as etapas configuradas no fluxo desta família de peça foram cumpridas com sucesso.
                  </p>
                </div>
              )}

              {/* Histórico de Apontamentos Anteriores */}
              {statusWorkflowOP.apontamentos?.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h5 style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563', marginBottom: '8px' }}>
                    Histórico de Etapas Concluídas:
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {statusWorkflowOP.apontamentos.map((ap) => (
                      <div key={ap.id_apontamento} style={{ padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{ap.quantidade_concluida} un aprovadas</strong> {ap.quantidade_perda > 0 && <span style={{ color: '#ef4444' }}>({ap.quantidade_perda} perdidas)</span>}
                          {ap.responsavel_oficina && <span style={{ color: '#6b7280' }}> • Resp: {ap.responsavel_oficina}</span>}
                        </div>
                        <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                          {new Date(ap.data_inicio).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="secondary-btn" onClick={() => setShowModalWorkflow(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MATRIZ 2D DE GRADE (CORES X TAMANHOS) & ENFESTO */}
      {opGradeModal && (
        <div className="modal-overlay">
          <div className="modal-card large">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={22} color="#2563eb" />
                <h2 style={{ margin: 0 }}>Matriz 2D de Grade & Enfesto ({opGradeModal.codigo_op})</h2>
              </div>
              <button className="close-btn" onClick={() => setOpGradeModal(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#4b5563' }}>
                Distribuição real de corte por grade de cores e tamanhos:
              </p>

              {(() => {
                const grade = opGradeModal.grade_distribuicao || {};
                const cores = Object.keys(grade);
                // Extrai conjunto único de todos os tamanhos
                const tamanhosSet = new Set();
                cores.forEach(c => {
                  Object.keys(grade[c] || {}).forEach(t => tamanhosSet.add(t));
                });
                const tamanhos = Array.from(tamanhosSet);

                if (cores.length === 0 || tamanhos.length === 0) {
                  return <p style={{ color: '#9ca3af' }}>Nenhuma grade detalhada registrada para esta OP.</p>;
                }

                // Calcula totais
                const totaisPorTamanho = {};
                tamanhos.forEach(t => {
                  totaisPorTamanho[t] = cores.reduce((acc, c) => acc + (parseInt(grade[c]?.[t] || 0)), 0);
                });
                const totalGeral = Object.values(totaisPorTamanho).reduce((a, b) => a + b, 0);

                return (
                  <div className="table-responsive">
                    <table className="grade-matrix-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Cor / Variante</th>
                          {tamanhos.map(t => (
                            <th key={t}>{t}</th>
                          ))}
                          <th style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}>Total Cor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cores.map(cor => {
                          const totalCor = tamanhos.reduce((acc, t) => acc + (parseInt(grade[cor]?.[t] || 0)), 0);
                          return (
                            <tr key={cor}>
                              <td className="row-header">{cor}</td>
                              {tamanhos.map(t => (
                                <td key={t}>{grade[cor]?.[t] || 0}</td>
                              ))}
                              <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>{totalCor} un</td>
                            </tr>
                          );
                        })}
                        <tr className="total-row">
                          <td style={{ textAlign: 'left' }}>Total por Tamanho</td>
                          {tamanhos.map(t => (
                            <td key={t}>{totaisPorTamanho[t]} un</td>
                          ))}
                          <td>{totalGeral} un</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Informações Técnicas de Enfesto e Descanso */}
              <div className="enfesto-info-grid">
                <div className="enfesto-info-item">
                  <span>Comprimento Enfesto</span>
                  <span>{opGradeModal.dados_enfesto?.comprimento_enfesto_m ? `${opGradeModal.dados_enfesto.comprimento_enfesto_m} m` : 'N/A'}</span>
                </div>
                <div className="enfesto-info-item">
                  <span>Camadas de Folha</span>
                  <span>{opGradeModal.dados_enfesto?.camadas_enfesto ? `${opGradeModal.dados_enfesto.camadas_enfesto} folhas` : 'N/A'}</span>
                </div>
                <div className="enfesto-info-item">
                  <span>Aproveitamento Risco</span>
                  <span>{opGradeModal.dados_enfesto?.aproveitamento_risco_pct ? `${opGradeModal.dados_enfesto.aproveitamento_risco_pct}%` : 'N/A'}</span>
                </div>
                <div className="enfesto-info-item">
                  <span>Descanso Cumprido</span>
                  <span>{opGradeModal.horas_descanso_cumpridas ? `${opGradeModal.horas_descanso_cumpridas}h (${opGradeModal.status_descanso || 'Liberado'})` : (opGradeModal.status_descanso || 'Liberado')}</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setOpGradeModal(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}

export default CorteRendimento;