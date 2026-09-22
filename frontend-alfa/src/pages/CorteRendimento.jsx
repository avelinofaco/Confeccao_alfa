import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ShoppingCart, Crop, Scissors, PackageCheck, Users, LogOut,
  Plus, Search, CheckCircle, Activity, X, ArrowRight, Menu
} from 'lucide-react';
import api from '../services/api';
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

      // 2. Busca os produtos e imprime no console para debug
      const resProdutos = await api.get('/produtos/');
      console.log("Produtos para o Modal de Corte:", resProdutos.data); // <-- ADICIONE ESTA LINHA
      setProdutos(resProdutos.data || []);
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
        peso_malha_enviado: parseFloat(novaOP.peso_malha_enviado)
      };

      // Endpoint: enviar para o corte
      await api.post('/producao/ordens', payload);
      alert('OP enviada para o corte com sucesso!');
      
      setShowModalEnvio(false);
      setNovaOP({ codigo_op: '', id_produto: '', peso_malha_enviado: '' });
      carregarDados();
    } catch (error) {
      console.error("Erro ao enviar para corte:", error);
      alert('Erro ao criar OP. Verifique os dados.');
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
                  <th>Produto</th>
                  <th>Malha Enviada (kg)</th>
                  <th>Peças Cortadas</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>Carregando...</td></tr>
                ) : ordensFiltradas.length === 0 ? (
                  <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>Nenhuma OP encontrada.</td></tr>
                ) : (
                  ordensFiltradas.map((op) => {
                    const corteFinalizado = op.quantidade_pecas_cortadas > 0 || op.status_op === 'Corte Finalizado';

                    const infoProduto = produtos.find(p => (p.id_produto || p.id) === op.id_produto) || {};
                    return (
                      <tr key={op.id_op || op.id}>
                        <td className="font-semibold text-gray-800">{op.codigo_op}</td>
                        
                        {/* Exibindo o NOME limpo em vez do ID numérico */}
                        <td className="font-medium text-gray-600">
                          {infoProduto.nome_modelo || infoProduto.nome || 'Produto Desconhecido'}
                        </td>
                        <td className="font-bold text-gray-700">{op.peso_malha_enviado} kg</td>
                        <td className={corteFinalizado ? "font-bold text-green-600" : "text-gray-400"}>
                          {corteFinalizado ? `${op.quantidade_pecas_cortadas} un` : 'Pendente'}
                        </td>
                        <td>
                          {corteFinalizado ? (
                            <span className="status-badge green"><CheckCircle size={13} /> Finalizado</span>
                          ) : (
                            <span className="status-badge amber"><Activity size={13} /> Em Corte</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
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
                  onChange={(e) => setNovaOP({...novaOP, codigo_op: e.target.value})}
                  required 
                />
              </div>
              <div className="input-group">
                <label>Produto (ID)</label>
                <select 
                  value={novaOP.id_produto}
                  onChange={(e) => setNovaOP({...novaOP, id_produto: e.target.value})}
                  required
                >
                  <option value="">Selecione o produto a ser fabricado...</option>
                  {produtos.map(p => (
                    <option key={p.id_produto || p.id} value={p.id_produto || p.id}>
                      {p.nome_modelo || p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Peso de Malha Enviado (kg)</label>
                <input 
                  type="number" 
                  step="0.001" 
                  value={novaOP.peso_malha_enviado}
                  onChange={(e) => setNovaOP({...novaOP, peso_malha_enviado: e.target.value})}
                  required 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalEnvio(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar OP</button>
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
    </div>
  );
}

export default CorteRendimento;