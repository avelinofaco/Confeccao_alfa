import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ShoppingCart, Crop, Scissors, PackageCheck, Users, LogOut, Settings, User, Lock, Menu, X
} from 'lucide-react';
import api from '../services/api';
import './Configuracoes.css';

function Configuracoes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('perfil');
  
  // Controle do menu mobile
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  
  // Simulando o ID do usuário logado (em um app com JWT, extrairíamos isso do Token)
  const idUsuarioLogado = 1; 
  
  // Inicia vazio, será preenchido pelo banco de dados
  const [perfil, setPerfil] = useState({ nome_usuario: '', login: '' });
  const [senha, setSenha] = useState({ nova_senha: '', confirmar_senha: '' });
  const [loading, setLoading] = useState(true);

  // Busca os dados reais do perfil ao abrir a tela
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
        console.error("Erro ao carregar os dados do perfil:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarPerfil();
  }, [navigate]);

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
            <p className="subtitle">Gerencie seu perfil e credenciais de acesso</p>
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
        </section>

        {/* Área do Formulário */}
        <section className="table-card settings-card">
          {loading ? (
             <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
               Carregando dados do perfil...
             </div>
          ) : activeTab === 'perfil' ? (
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
          ) : (
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
          )}
        </section>
      </main>
    </div>
  );
}

export default Configuracoes;