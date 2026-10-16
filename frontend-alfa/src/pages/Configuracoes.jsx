import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ShoppingCart, Crop, Scissors, Users, LogOut, Settings, User, Lock, Menu, X,
  Sliders, Plus, Trash2, Sparkles, Check, AlertCircle
} from 'lucide-react';

import api from '../services/api';
import WorkflowStepper from '../components/WorkflowStepper';
import './Configuracoes.css';

function Configuracoes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('perfil');
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  
  const idUsuarioLogado = 1; 
  const [perfil, setPerfil] = useState({ nome_usuario: '', login: '' });
  const [senha, setSenha] = useState({ nova_senha: '', confirmar_senha: '' });
  const [loading, setLoading] = useState(true);

  // Estados para Gestão de Contextos e Fluxos
  const [contextos, setContextos] = useState([]);
  const [contextoSelecionado, setContextoSelecionado] = useState(null);
  const [loadingContextos, setLoadingContextos] = useState(false);
  const [showModalNovoContexto, setShowModalNovoContexto] = useState(false);
  const [showModalNovaEtapa, setShowModalNovaEtapa] = useState(false);
  const [showModalNovoCampo, setShowModalNovoCampo] = useState(false);

  // Formulário de Novo Contexto
  const [novoContexto, setNovoContexto] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    unidade_principal: 'UNIDADE',
    habilita_grade_tamanhos: true,
    habilita_lavanderia: false,
    habilita_estamparia: false,
    habilita_controle_elasticos: false,
    habilita_rendimento_peso: true
  });

  // Formulário de Nova Etapa
  const [novaEtapa, setNovaEtapa] = useState({
    codigo_etapa: '',
    nome_etapa: '',
    tipo_operacao: 'INTERNA',
    descricao_instrucao: ''
  });

  // Formulário de Novo Campo Customizado
  const [novoCampo, setNovoCampo] = useState({
    nome: '',
    label: '',
    tipo: 'text',
    opcoes_str: '',
    required: false
  });

  // Carrega Perfil
  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) {
      navigate('/');
      return;
    }

    const carregarPerfil = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/usuarios/${idUsuarioLogado}`);
        if (response.data) {
          setPerfil({
            nome_usuario: response.data.nome_usuario || '',
            login: response.data.login || ''
          });
        }
      } catch (error) {
        console.error("Erro ao carregar dados do perfil:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarPerfil();
  }, [navigate]);

  // Carrega Contextos
  const carregarContextos = async () => {
    try {
      setLoadingContextos(true);
      const res = await api.get('/contextos/');
      const lista = res.data || [];
      setContextos(lista);
      if (lista.length > 0 && !contextoSelecionado) {
        setContextoSelecionado(lista[0]);
      } else if (contextoSelecionado) {
        const atualizado = lista.find(c => c.id_contexto === contextoSelecionado.id_contexto);
        setContextoSelecionado(atualizado || lista[0]);
      }
    } catch (err) {
      console.error("Erro ao carregar contextos:", err);
    } finally {
      setLoadingContextos(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'contextos') {
      carregarContextos();
    }
  }, [activeTab]);

  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/usuarios/${idUsuarioLogado}`, perfil);
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar perfil.');
    }
  };

  const handleSalvarSenha = async (e) => {
    e.preventDefault();
    if (senha.nova_senha !== senha.confirmar_senha) {
      alert('As senhas não coincidem!');
      return;
    }
    try {
      await api.put(`/usuarios/${idUsuarioLogado}`, { senha: senha.nova_senha });
      alert('Senha alterada com segurança!');
      setSenha({ nova_senha: '', confirmar_senha: '' });
    } catch (error) {
      console.error(error);
      alert('Erro ao alterar senha.');
    }
  };

  // Restaurar Padrões da Indústria
  const handleSemearPadroes = async () => {
    if (!window.confirm("Deseja semear/restaurar os fluxos padrões da confecção (Camisetas, Calcinhas, Jeans)?")) return;
    try {
      setLoadingContextos(true);
      const res = await api.post('/contextos/semear-padroes');
      setContextos(res.data || []);
      if (res.data?.length > 0) setContextoSelecionado(res.data[0]);
      alert("Fluxos padrões da indústria configurados com sucesso!");
    } catch (err) {
      console.error("Erro ao semear padrões:", err);
      alert("Erro ao semear contextos padrão.");
    } finally {
      setLoadingContextos(false);
    }
  };

  // Salvar alterações no contexto ativo
  const handleSalvarContextoAtivo = async () => {
    if (!contextoSelecionado) return;
    try {
      await api.put(`/contextos/${contextoSelecionado.id_contexto}`, {
        nome: contextoSelecionado.nome,
        descricao: contextoSelecionado.descricao,
        unidade_principal: contextoSelecionado.unidade_principal,
        habilita_grade_tamanhos: contextoSelecionado.habilita_grade_tamanhos,
        habilita_lavanderia: contextoSelecionado.habilita_lavanderia,
        habilita_estamparia: contextoSelecionado.habilita_estamparia,
        habilita_controle_elasticos: contextoSelecionado.habilita_controle_elasticos,
        habilita_rendimento_peso: contextoSelecionado.habilita_rendimento_peso,
        schema_campos_customizados: contextoSelecionado.schema_campos_customizados || []
      });
      alert('Configurações do fluxo salvas com sucesso!');
      await carregarContextos();
    } catch (err) {
      console.error("Erro ao salvar contexto:", err);
      alert("Erro ao salvar alterações no contexto.");
    }
  };

  // Criar novo contexto
  const handleCriarContexto = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/contextos/', novoContexto);
      alert('Novo contexto de confecção criado!');
      setShowModalNovoContexto(false);
      setNovoContexto({
        codigo: '',
        nome: '',
        descricao: '',
        unidade_principal: 'UNIDADE',
        habilita_grade_tamanhos: true,
        habilita_lavanderia: false,
        habilita_estamparia: false,
        habilita_controle_elasticos: false,
        habilita_rendimento_peso: true
      });
      await carregarContextos();
      setContextoSelecionado(res.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erro ao criar contexto.");
    }
  };

  // Adicionar etapa ao contexto ativo
  const handleAdicionarEtapa = async (e) => {
    e.preventDefault();
    if (!contextoSelecionado) return;
    try {
      const proximaOrdem = (contextoSelecionado.etapas?.length || 0) + 1;
      await api.post(`/contextos/${contextoSelecionado.id_contexto}/etapas`, {
        codigo_etapa: novaEtapa.codigo_etapa || novaEtapa.nome_etapa.toLowerCase().replace(/\s+/g, '_'),
        nome_etapa: novaEtapa.nome_etapa,
        ordem_etapa: proximaOrdem,
        tipo_operacao: novaEtapa.tipo_operacao,
        permite_perda: true,
        descricao_instrucao: novaEtapa.descricao_instrucao,
        campos_etapa: []
      });
      alert('Etapa adicionada à esteira!');
      setShowModalNovaEtapa(false);
      setNovaEtapa({ codigo_etapa: '', nome_etapa: '', tipo_operacao: 'INTERNA', descricao_instrucao: '' });
      await carregarContextos();
    } catch (err) {
      console.error(err);
      alert("Erro ao adicionar etapa ao workflow.");
    }
  };

  // Remover etapa do workflow
  const handleRemoverEtapa = async (idEtapa) => {
    if (!window.confirm("Remover esta etapa da esteira de produção?")) return;
    try {
      await api.delete(`/contextos/${contextoSelecionado.id_contexto}/etapas/${idEtapa}`);
      await carregarContextos();
    } catch (err) {
      console.error(err);
      alert("Erro ao remover etapa.");
    }
  };

  // Adicionar campo dinâmico ao schema
  const handleAdicionarCampo = (e) => {
    e.preventDefault();
    if (!novoCampo.nome || !novoCampo.label) return;

    const opcoes = novoCampo.tipo === 'select' 
      ? novoCampo.opcoes_str.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const campoFormatado = {
      nome: novoCampo.nome.toLowerCase().replace(/\s+/g, '_'),
      label: novoCampo.label,
      tipo: novoCampo.tipo,
      opcoes: opcoes,
      required: novoCampo.required
    };

    const camposAtuais = contextoSelecionado.schema_campos_customizados || [];
    setContextoSelecionado({
      ...contextoSelecionado,
      schema_campos_customizados: [...camposAtuais, campoFormatado]
    });

    setShowModalNovoCampo(false);
    setNovoCampo({ nome: '', label: '', tipo: 'text', opcoes_str: '', required: false });
  };

  // Remover campo customizado
  const handleRemoverCampo = (nomeCampo) => {
    const camposAtualizados = (contextoSelecionado.schema_campos_customizados || []).filter(c => c.nome !== nomeCampo);
    setContextoSelecionado({
      ...contextoSelecionado,
      schema_campos_customizados: camposAtualizados
    });
  };

  return (
    <div className="dashboard-container">
      {/* CABEÇALHO MOBILE */}
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

      {/* Sidebar Responsiva */}
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
          <button className="nav-item" onClick={() => { navigate('/corte-rendimento'); setMenuMobileAberto(false); }}><Crop size={19} /><span>Corte/Rendimento</span></button>
          <button className="nav-item" onClick={() => { navigate('/costura'); setMenuMobileAberto(false); }}><Scissors size={19} /><span>Costura</span></button>
          <button className="nav-item" onClick={() => { navigate('/equipe'); setMenuMobileAberto(false); }}><Users size={19} /><span>Equipe</span></button>
          <button className="nav-item active" onClick={() => { navigate('/configuracoes'); setMenuMobileAberto(false); }}><Settings size={19} /><span>Configurações</span></button>
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item logout" onClick={() => { localStorage.removeItem('token_confeccao'); navigate('/'); }}>
            <LogOut size={19} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>Configurações do Sistema</h1>
            <p className="subtitle">Gerencie perfil, segurança e os fluxos e esteiras de produção por tipo de peça</p>
          </div>
        </header>

        {/* Abas de Navegação */}
        <section className="action-bar-card config-tabs">
          <button 
            className={`tab-btn ${activeTab === 'perfil' ? 'primary-btn' : 'secondary-btn'}`} 
            onClick={() => setActiveTab('perfil')}
          >
            <User size={18} /> Dados do Perfil
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'seguranca' ? 'primary-btn' : 'secondary-btn'}`} 
            onClick={() => setActiveTab('seguranca')}
          >
            <Lock size={18} /> Segurança
          </button>

          <button 
            className={`tab-btn ${activeTab === 'contextos' ? 'primary-btn' : 'secondary-btn'}`} 
            onClick={() => setActiveTab('contextos')}
          >
            <Sliders size={18} /> Fluxos & Contextos (Multi-Peça)
          </button>
        </section>

        {/* Conteúdo da Aba Perfil */}
        {activeTab === 'perfil' && (
          <section className="table-card settings-card">
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                Carregando dados do perfil...
              </div>
            ) : (
              <form onSubmit={handleSalvarPerfil} className="modal-form">
                <div className="input-group">
                  <label>Nome Completo</label>
                  <input type="text" value={perfil.nome_usuario} onChange={(e) => setPerfil({...perfil, nome_usuario: e.target.value})} required />
                </div>
                <div className="input-group">
                  <label>Login (E-mail ou CPF)</label>
                  <input type="text" value={perfil.login} onChange={(e) => setPerfil({...perfil, login: e.target.value})} required />
                </div>
                <button type="submit" className="primary-btn submit-btn">Salvar Alterações</button>
              </form>
            )}
          </section>
        )}

        {/* Conteúdo da Aba Segurança */}
        {activeTab === 'seguranca' && (
          <section className="table-card settings-card">
            <form onSubmit={handleSalvarSenha} className="modal-form">
              <div className="input-group">
                <label>Nova Senha</label>
                <input type="password" value={senha.nova_senha} onChange={(e) => setSenha({...senha, nova_senha: e.target.value})} required />
              </div>
              <div className="input-group">
                <label>Confirmar Nova Senha</label>
                <input type="password" value={senha.confirmar_senha} onChange={(e) => setSenha({...senha, confirmar_senha: e.target.value})} required />
              </div>
              <button type="submit" className="primary-btn submit-btn btn-danger">Alterar Senha</button>
            </form>
          </section>
        )}

        {/* Conteúdo da Aba Fluxos & Contextos (Multi-Contexto) */}
        {activeTab === 'contextos' && (
          <div className="contextos-wrapper">
            <div className="contextos-header-actions">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                  Esteiras e Parâmetros por Família de Peça
                </h3>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>
                  Configure formulários, regras de corte e etapas da produção para cada categoria (Camisetas, Lingerie/Calcinhas, Jeans, etc.)
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="secondary-btn tab-btn"
                  onClick={handleSemearPadroes}
                  title="Recarrega as configurações recomendadas para Camisetas, Calcinhas e Jeans"
                >
                  <Sparkles size={16} color="#00c875" />
                  <span>Padrões da Indústria</span>
                </button>

                <button 
                  className="primary-btn tab-btn"
                  onClick={() => setShowModalNovoContexto(true)}
                >
                  <Plus size={16} />
                  <span>Novo Tipo de Peça</span>
                </button>
              </div>
            </div>

            {loadingContextos ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                Carregando contextos e fluxos de produção...
              </div>
            ) : contextos.length === 0 ? (
              <div className="table-card" style={{ textAlign: 'center', padding: '40px' }}>
                <AlertCircle size={40} color="#f59e0b" style={{ margin: '0 auto 12px auto' }} />
                <h3>Nenhum fluxo/contexto cadastrado</h3>
                <p style={{ color: '#6b7280', fontSize: '14px', maxWidth: '460px', margin: '8px auto 20px auto' }}>
                  Você pode inicializar os fluxos prontos para Camisetas, Calcinhas/Lingerie e Jeanswear com apenas um clique!
                </p>
                <button className="primary-btn" onClick={handleSemearPadroes} style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>
                  <Sparkles size={16} style={{ marginRight: '8px' }} />
                  Inicializar Fluxos da Indústria
                </button>
              </div>
            ) : (
              <div className="context-grid">
                {/* Coluna da Esquerda: Lista de Contextos */}
                <div className="context-list-col">
                  {contextos.map(ctx => {
                    const isSelecionado = contextoSelecionado?.id_contexto === ctx.id_contexto;
                    return (
                      <div 
                        key={ctx.id_contexto}
                        className={`context-card-item ${isSelecionado ? 'active' : ''}`}
                        onClick={() => setContextoSelecionado(ctx)}
                      >
                        <div className="context-card-top">
                          <span className="context-badge">{ctx.codigo}</span>
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>
                            {ctx.etapas?.length || 0} etapas
                          </span>
                        </div>
                        <h4>{ctx.nome}</h4>
                        <p>{ctx.descricao || 'Sem descrição.'}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Coluna da Direita: Painel de Edição do Contexto Selecionado */}
                {contextoSelecionado && (
                  <div className="context-detail-panel">
                    {/* Cabeçalho do Contexto */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="context-badge" style={{ fontSize: '12px', padding: '3px 10px' }}>
                            {contextoSelecionado.codigo}
                          </span>
                          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                            {contextoSelecionado.nome}
                          </h2>
                        </div>
                        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                          {contextoSelecionado.descricao}
                        </p>
                      </div>

                      <button 
                        className="primary-btn" 
                        onClick={handleSalvarContextoAtivo}
                        style={{ padding: '8px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Check size={16} /> Salvar Parâmetros
                      </button>
                    </div>

                    {/* 1. Módulos e Funcionalidades Habilitadas (Feature Flags) */}
                    <div>
                      <h4 className="section-subtitle">
                        <Sliders size={16} color="#00c875" /> Funcionalidades e Regras de Negócio do Contexto
                      </h4>
                      <div className="feature-toggles-grid">
                        <label className="feature-toggle-card">
                          <input 
                            type="checkbox" 
                            checked={contextoSelecionado.habilita_grade_tamanhos}
                            onChange={(e) => setContextoSelecionado({
                              ...contextoSelecionado,
                              habilita_grade_tamanhos: e.target.checked
                            })}
                          />
                          <div className="feature-toggle-text">
                            <span className="feature-toggle-title">Grade de Tamanhos</span>
                            <span className="feature-toggle-desc">Ativa matriz de tamanhos (P/M/G ou 36/38)</span>
                          </div>
                        </label>

                        <label className="feature-toggle-card">
                          <input 
                            type="checkbox" 
                            checked={contextoSelecionado.habilita_rendimento_peso}
                            onChange={(e) => setContextoSelecionado({
                              ...contextoSelecionado,
                              habilita_rendimento_peso: e.target.checked
                            })}
                          />
                          <div className="feature-toggle-text">
                            <span className="feature-toggle-title">Rendimento por Peso (kg)</span>
                            <span className="feature-toggle-desc">Exige peso no corte (típico de camisetas)</span>
                          </div>
                        </label>

                        <label className="feature-toggle-card">
                          <input 
                            type="checkbox" 
                            checked={contextoSelecionado.habilita_controle_elasticos}
                            onChange={(e) => setContextoSelecionado({
                              ...contextoSelecionado,
                              habilita_controle_elasticos: e.target.checked
                            })}
                          />
                          <div className="feature-toggle-text">
                            <span className="feature-toggle-title">Controle de Elásticos</span>
                            <span className="feature-toggle-desc">Tensão de catraca e metragem (lingerie)</span>
                          </div>
                        </label>

                        <label className="feature-toggle-card">
                          <input 
                            type="checkbox" 
                            checked={contextoSelecionado.habilita_estamparia}
                            onChange={(e) => setContextoSelecionado({
                              ...contextoSelecionado,
                              habilita_estamparia: e.target.checked
                            })}
                          />
                          <div className="feature-toggle-text">
                            <span className="feature-toggle-title">Estamparia / Silk</span>
                            <span className="feature-toggle-desc">Habilita etapas e remessas de silk/sublimação</span>
                          </div>
                        </label>

                        <label className="feature-toggle-card">
                          <input 
                            type="checkbox" 
                            checked={contextoSelecionado.habilita_lavanderia}
                            onChange={(e) => setContextoSelecionado({
                              ...contextoSelecionado,
                              habilita_lavanderia: e.target.checked
                            })}
                          />
                          <div className="feature-toggle-text">
                            <span className="feature-toggle-title">Lavanderia Industrial</span>
                            <span className="feature-toggle-desc">Etapas de stone wash e efeitos (jeanswear)</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* 2. Visualizador da Esteira de Produção */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 className="section-subtitle" style={{ margin: 0 }}>
                          <Scissors size={16} color="#00c875" /> Esteira Produtiva / Workflow
                        </h4>
                        <button 
                          className="secondary-btn tab-btn"
                          onClick={() => setShowModalNovaEtapa(true)}
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                        >
                          <Plus size={14} /> Adicionar Etapa
                        </button>
                      </div>

                      {/* Stepper Visual */}
                      <WorkflowStepper etapas={contextoSelecionado.etapas || []} />

                      {/* Lista detalhada das etapas com exclusão */}
                      <div className="etapas-list">
                        {(contextoSelecionado.etapas || []).map((et, idx) => (
                          <div key={et.id_etapa || idx} className="etapa-item-row">
                            <div className="etapa-item-info">
                              <span className="etapa-ordem-tag">{idx + 1}</span>
                              <div>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>
                                  {et.nome_etapa}
                                </span>
                                <span style={{ 
                                  fontSize: '11px', 
                                  marginLeft: '8px',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: et.tipo_operacao === 'EXTERNA' ? '#fef3c7' : '#e0f2fe',
                                  color: et.tipo_operacao === 'EXTERNA' ? '#92400e' : '#0369a1',
                                  fontWeight: '500'
                                }}>
                                  {et.tipo_operacao === 'EXTERNA' ? 'Terceirizada (Facção)' : 'Interna'}
                                </span>
                                {et.descricao_instrucao && (
                                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                    {et.descricao_instrucao}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button 
                              className="btn-icon-danger"
                              onClick={() => handleRemoverEtapa(et.id_etapa)}
                              title="Remover etapa"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Campos Customizados da Ficha Técnica (JSON Schema) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 className="section-subtitle" style={{ margin: 0 }}>
                          <FileText size={16} color="#00c875" /> Campos Personalizados do Formulário (Schema Dinâmico)
                        </h4>
                        <button 
                          className="secondary-btn tab-btn"
                          onClick={() => setShowModalNovoCampo(true)}
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                        >
                          <Plus size={14} /> Novo Campo
                        </button>
                      </div>

                      {(!contextoSelecionado.schema_campos_customizados || contextoSelecionado.schema_campos_customizados.length === 0) ? (
                        <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
                          Nenhum campo personalizado definido. A ficha técnica usará os campos gerais.
                        </p>
                      ) : (
                        <table className="campos-custom-table">
                          <thead>
                            <tr>
                              <th>Nome do Campo</th>
                              <th>Tipo de Input</th>
                              <th>Obrigatório?</th>
                              <th>Opções Configuradas</th>
                              <th style={{ width: '50px' }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contextoSelecionado.schema_campos_customizados.map((c, idx) => (
                              <tr key={c.nome || idx}>
                                <td style={{ fontWeight: '500', color: '#1f2937' }}>{c.label}</td>
                                <td><code>{c.tipo}</code></td>
                                <td>{c.required ? <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Sim</span> : 'Não'}</td>
                                <td style={{ fontSize: '12px', color: '#4b5563' }}>
                                  {c.opcoes?.length ? c.opcoes.join(', ') : '-'}
                                </td>
                                <td>
                                  <button 
                                    className="btn-icon-danger"
                                    onClick={() => handleRemoverCampo(c.nome)}
                                    title="Remover campo"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: CRIAR NOVO CONTEXTO */}
      {showModalNovoContexto && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>Novo Tipo de Peça / Contexto</h2>
              <button className="btn-close" onClick={() => setShowModalNovoContexto(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCriarContexto} className="modal-form">
              <div className="input-group">
                <label>Código Identificador (Ex: CAMISETA, CALCINHA, PIJAMA)</label>
                <input 
                  type="text" 
                  value={novoContexto.codigo} 
                  onChange={(e) => setNovoContexto({...novoContexto, codigo: e.target.value})} 
                  placeholder="Ex: CALCINHA"
                  required 
                />
              </div>
              <div className="input-group">
                <label>Nome do Tipo de Peça</label>
                <input 
                  type="text" 
                  value={novoContexto.nome} 
                  onChange={(e) => setNovoContexto({...novoContexto, nome: e.target.value})} 
                  placeholder="Ex: Moda Íntima / Lingerie"
                  required 
                />
              </div>
              <div className="input-group">
                <label>Unidade Principal de Matéria-Prima</label>
                <select 
                  value={novoContexto.unidade_principal} 
                  onChange={(e) => setNovoContexto({...novoContexto, unidade_principal: e.target.value})}
                >
                  <option value="UNIDADE">Unidades (UN)</option>
                  <option value="kg">Quilogramas (kg) - Ideal para Malharia/Camisetas</option>
                  <option value="metros">Metros (m) - Ideal para Renda/Tecido Plano</option>
                </select>
              </div>
              <div className="input-group">
                <label>Descrição do Contexto</label>
                <textarea 
                  value={novoContexto.descricao} 
                  onChange={(e) => setNovoContexto({...novoContexto, descricao: e.target.value})}
                  placeholder="Ex: Fabricação de lingerie com foco em microfibra e costura com catraca tensora."
                  rows={2}
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="secondary-btn tab-btn" onClick={() => setShowModalNovoContexto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-btn tab-btn">
                  Criar Contexto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA ETAPA NO WORKFLOW */}
      {showModalNovaEtapa && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Adicionar Etapa na Esteira</h2>
              <button className="btn-close" onClick={() => setShowModalNovaEtapa(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdicionarEtapa} className="modal-form">
              <div className="input-group">
                <label>Nome da Etapa</label>
                <input 
                  type="text" 
                  value={novaEtapa.nome_etapa} 
                  onChange={(e) => setNovaEtapa({...novaEtapa, nome_etapa: e.target.value})} 
                  placeholder="Ex: Aplicação de Elástico Bico"
                  required 
                />
              </div>
              <div className="input-group">
                <label>Tipo de Operação</label>
                <select 
                  value={novaEtapa.tipo_operacao} 
                  onChange={(e) => setNovaEtapa({...novaEtapa, tipo_operacao: e.target.value})}
                >
                  <option value="INTERNA">Interna (Feito na fábrica própria)</option>
                  <option value="EXTERNA">Externa (Facção / Parceiro Terceirizado)</option>
                </select>
              </div>
              <div className="input-group">
                <label>Instruções Técnicas (Opcional)</label>
                <textarea 
                  value={novaEtapa.descricao_instrucao} 
                  onChange={(e) => setNovaEtapa({...novaEtapa, descricao_instrucao: e.target.value})}
                  placeholder="Ex: Utilizar catraca tensora nível 3.5 para manter o franzido padrão."
                  rows={2}
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="secondary-btn tab-btn" onClick={() => setShowModalNovaEtapa(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-btn tab-btn">
                  Adicionar à Esteira
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CAMPO CUSTOMIZADO */}
      {showModalNovoCampo && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Novo Campo no Formulário</h2>
              <button className="btn-close" onClick={() => setShowModalNovoCampo(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdicionarCampo} className="modal-form">
              <div className="input-group">
                <label>Rótulo do Campo (Label para o usuário)</label>
                <input 
                  type="text" 
                  value={novoCampo.label} 
                  onChange={(e) => setNovoCampo({...novoCampo, label: e.target.value, nome: e.target.value.toLowerCase().replace(/\s+/g, '_')})} 
                  placeholder="Ex: Tensão do Elástico"
                  required 
                />
              </div>
              <div className="input-group">
                <label>Tipo de Entrada</label>
                <select 
                  value={novoCampo.tipo} 
                  onChange={(e) => setNovoCampo({...novoCampo, tipo: e.target.value})}
                >
                  <option value="text">Texto Livre</option>
                  <option value="number">Número</option>
                  <option value="select">Lista de Seleção (Dropdown)</option>
                  <option value="textarea">Área de Texto Longo</option>
                </select>
              </div>
              {novoCampo.tipo === 'select' && (
                <div className="input-group">
                  <label>Opções (Separadas por vírgula)</label>
                  <input 
                    type="text" 
                    value={novoCampo.opcoes_str} 
                    onChange={(e) => setNovoCampo({...novoCampo, opcoes_str: e.target.value})} 
                    placeholder="Ex: Bico Primavera, Viés Mexican, Elástico Embutido"
                    required 
                  />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={novoCampo.required} 
                  onChange={(e) => setNovoCampo({...novoCampo, required: e.target.checked})}
                />
                Campo Obrigatório no Formulário
              </label>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="secondary-btn tab-btn" onClick={() => setShowModalNovoCampo(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-btn tab-btn">
                  Inserir Campo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Configuracoes;