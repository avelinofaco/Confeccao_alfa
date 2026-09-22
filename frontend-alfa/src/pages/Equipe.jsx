import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ShoppingCart, Crop, Scissors, PackageCheck, Users, LogOut,
  Plus, Search, X, CheckCircle, XCircle, CalendarCheck, FileSpreadsheet, Menu
} from 'lucide-react';
import api from '../services/api';
import './Equipe.css';

function Equipe() {
  const navigate = useNavigate();
  const userName = 'Gestor Alfa';

  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Controle do menu mobile
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  // Controle de Modais
  const [showModalColaborador, setShowModalColaborador] = useState(false);
  const [showModalChamada, setShowModalChamada] = useState(false);
  const [showModalResumo, setShowModalResumo] = useState(false);

  // Estado: Novo Colaborador
  const [novoColaborador, setNovoColaborador] = useState({
    nome_completo: '',
    telefone_whatsapp: '',
    ativo: true
  });

  // Estado: Chamada Diária
  const dataHoje = new Date().toISOString().split('T')[0];
  const [dataChamada, setDataChamada] = useState(dataHoje);
  const [listaPresenca, setListaPresenca] = useState({});

  // Estado: Resumo Mensal
  const mesAtual = dataHoje.substring(0, 7);
  const [mesFiltro, setMesFiltro] = useState(mesAtual);
  const [dadosResumoMensal, setDadosResumoMensal] = useState([]);
  const [loadingResumo, setLoadingResumo] = useState(false);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const response = await api.get('/equipe/colaboradores');
      setColaboradores(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) navigate('/');
    else carregarDados();
  }, [navigate]);

  // AÇÃO 1: Cadastrar Colaborador
  const handleCadastrarColaborador = async (e) => {
    e.preventDefault();
    try {
      await api.post('/equipe/colaboradores', novoColaborador);
      alert('Colaborador cadastrado com sucesso!');
      setShowModalColaborador(false);
      setNovoColaborador({ nome_completo: '', telefone_whatsapp: '', ativo: true });
      carregarDados();
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      alert('Erro ao registrar colaborador. Verifique os dados.');
    }
  };

  // AÇÃO 2: Preparar Modal de Chamada Diária
  const abrirModalChamada = () => {
    const presencaInicial = {};
    colaboradores.forEach(colab => {
      if (colab.ativo) {
        presencaInicial[colab.id_colaborador || colab.id] = true; 
      }
    });
    setListaPresenca(presencaInicial);
    setDataChamada(dataHoje);
    setShowModalChamada(true);
  };

  const togglePresenca = (id) => {
    setListaPresenca(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // AÇÃO 3: Salvar Chamada em Lote
  const handleSalvarChamada = async (e) => {
    e.preventDefault();
    try {
      const payload = Object.keys(listaPresenca).map(id => ({
        id_colaborador: parseInt(id),
        data_referencia: dataChamada,
        presente: listaPresenca[id]
      }));

      await api.post('/equipe/presencas/lote', payload);
      alert('Chamada salva com sucesso!');
      setShowModalChamada(false);
    } catch (error) {
      console.error("Erro ao salvar chamada:", error);
      alert('Erro ao registrar a presença.');
    }
  };

  // AÇÃO 4: Carregar Resumo Mensal (Fechamento)
  const abrirModalResumo = async () => {
    setShowModalResumo(true);
    buscarResumoMensal(mesAtual);
  };

  const buscarResumoMensal = async (mes) => {
    setLoadingResumo(true);
    setMesFiltro(mes);
    try {
      // Faz a chamada REAL para a API no FastAPI, buscando as presenças exatas
      const response = await api.get(`/equipe/presencas/resumo?mes=${mes}`);
      setDadosResumoMensal(response.data);
    } catch (error) {
      console.error("Erro ao buscar resumo mensal:", error);
      alert("Não foi possível carregar os dados do fechamento mensal.");
    } finally {
      setLoadingResumo(false);
    }
  };

  const colaboradoresFiltrados = colaboradores.filter(colab => 
    (colab.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Máscara inteligente para o WhatsApp
  const mascaraTelefone = (valor) => {
    let v = valor.replace(/\D/g, ''); 
    v = v.substring(0, 11);
    if (v.length > 2) {
      v = `(${v.substring(0, 2)})${v.substring(2)}`;
    }
    if (v.length > 6) {
      v = `${v.substring(0, 5)} ${v.substring(5)}`;
    }
    return v;
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
          <button className="nav-item active" onClick={() => { navigate('/equipe'); setMenuMobileAberto(false); }}><Users size={19} /><span>Equipe</span></button>
          <button className="nav-item" onClick={() => { navigate('/configuracoes'); setMenuMobileAberto(false); }}><Users size={19} /><span>Configurações</span></button>
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item logout" onClick={() => { localStorage.removeItem('token_confeccao'); navigate('/'); }}><LogOut size={19} /><span>Sair</span></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>Gestão de Equipe e RH</h1>
            <p className="subtitle">Controle de colaboradores, chamadas diárias e fechamento mensal</p>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">Administração</span>
            </div>
            <div className="avatar">A</div>
          </div>
        </header>

        {/* Barra de Ações Estratégicas */}
        <section className="action-bar-card">
          <div className="search-filter-group">
            <div className="search-box">
              <Search size={18} color="#9ca3af" />
              <input 
                type="text" 
                placeholder="Buscar colaborador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="action-buttons-group">
            <button className="secondary-btn" onClick={abrirModalResumo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', color: '#374151' }}>
              <FileSpreadsheet size={18} />
              <span>Resumo Mensal</span>
            </button>
            
            <button className="secondary-btn" onClick={abrirModalChamada} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#00c875', borderColor: '#00c875' }}>
              <CalendarCheck size={18} />
              <span>Fazer Chamada</span>
            </button>
            
            <button className="primary-btn" onClick={() => setShowModalColaborador(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={18} />
              <span>Novo Colaborador</span>
            </button>
          </div>
        </section>

        {/* Tabela de Colaboradores */}
        <section className="table-card">
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nome do Colaborador</th>
                  <th>WhatsApp (Contato)</th>
                  <th>Status na Confecção</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="3" style={{textAlign: 'center', padding: '20px'}}>Carregando equipe...</td></tr>
                ) : colaboradoresFiltrados.length === 0 ? (
                  <tr><td colSpan="3" style={{textAlign: 'center', padding: '20px'}}>Nenhum colaborador encontrado.</td></tr>
                ) : (
                  colaboradoresFiltrados.map((colab) => (
                    <tr key={colab.id_colaborador || colab.id}>
                      <td className="font-bold text-gray-800">{colab.nome_completo}</td>
                      <td className="text-gray-600">{colab.telefone_whatsapp || 'Não informado'}</td>
                      <td>
                        {colab.ativo ? (
                          <span className="status-badge green"><CheckCircle size={13} /> Ativo</span>
                        ) : (
                          <span className="status-badge amber"><XCircle size={13} /> Inativo</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODAL 1: NOVO COLABORADOR */}
      {showModalColaborador && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Adicionar à Equipe</h2>
              <button className="close-btn" onClick={() => setShowModalColaborador(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCadastrarColaborador} className="modal-form">
              <div className="input-group">
                <label>Nome Completo</label>
                <input type="text" placeholder="Ex: Maria das Graças" value={novoColaborador.nome_completo} onChange={(e) => setNovoColaborador({...novoColaborador, nome_completo: e.target.value})} required />
              </div>
              <div className="input-group">
                <label>WhatsApp (Telefone)</label>
                <input 
                  type="text" 
                  placeholder="(85)9 84657234" 
                  value={novoColaborador.telefone_whatsapp} 
                  onChange={(e) => {
                    const valorFormatado = mascaraTelefone(e.target.value);
                    setNovoColaborador({...novoColaborador, telefone_whatsapp: valorFormatado});
                  }} 
                  required 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalColaborador(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHAMADA DIÁRIA (LOTE) */}
      {showModalChamada && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Chamada Diária</h2>
              <button className="close-btn" onClick={() => setShowModalChamada(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSalvarChamada} className="modal-form">
              <div className="input-group">
                <label>Data da Presença</label>
                <input type="date" value={dataChamada} onChange={(e) => setDataChamada(e.target.value)} required />
              </div>
              
              <div style={{ marginTop: '16px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                <p style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Registro de Presenças:</p>
                {colaboradores.filter(c => c.ativo).map(colab => {
                  const id = colab.id_colaborador || colab.id;
                  const presente = listaPresenca[id];
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 10px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#4b5563', fontWeight: '500' }}>{colab.nome_completo}</span>
                      <button 
                        type="button" 
                        onClick={() => togglePresenca(id)}
                        style={{
                          padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                          backgroundColor: presente ? '#dcfce7' : '#fee2e2',
                          color: presente ? '#16a34a' : '#ef4444',
                          transition: 'all 0.2s'
                        }}
                      >
                        {presente ? 'Presente' : 'Faltou'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="secondary-btn" onClick={() => setShowModalChamada(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar Chamada</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: FECHAMENTO MENSAL */}
      {showModalResumo && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>Fechamento Mensal</h2>
              <button className="close-btn" onClick={() => setShowModalResumo(false)}><X size={20} /></button>
            </div>
            <div className="modal-form">
              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label>Selecione o Mês de Apuração</label>
                <input 
                  type="month" 
                  value={mesFiltro} 
                  onChange={(e) => buscarResumoMensal(e.target.value)} 
                />
              </div>

              {loadingResumo ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>Calculando presenças do mês...</div>
              ) : (
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="custom-table" style={{ width: '100%', marginBottom: '0' }}>
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th style={{ textAlign: 'center' }}>Presenças</th>
                        <th style={{ textAlign: 'center' }}>Faltas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosResumoMensal.length === 0 ? (
                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>Nenhum dado encontrado para este mês.</td></tr>
                      ) : (
                        dadosResumoMensal.map((item, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold text-gray-700">{item.nome}</td>
                            <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>{item.presencas}</td>
                            <td style={{ textAlign: 'center', color: item.faltas > 0 ? '#ef4444' : '#9ca3af', fontWeight: 'bold' }}>
                              {item.faltas}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="primary-btn" onClick={() => setShowModalResumo(false)}>Fechar Fechamento</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Equipe;