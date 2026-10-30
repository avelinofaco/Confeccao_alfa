import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  ShoppingCart, 
  Crop, 
  Scissors, 
  Users, 
  LogOut,
  RefreshCw,
  Settings,
  Layers,
  Shirt,
  Sparkles,
  DollarSign,
  User
} from 'lucide-react';
import { useSegmento } from '../context/SegmentoContext';
import './Sidebar.css';

function Sidebar({ menuMobileAberto, setMenuMobileAberto }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { segmento, alternarSegmento, isCamisetas, logout } = useSegmento();

  const fecharMobile = () => {
    if (setMenuMobileAberto) setMenuMobileAberto(false);
  };

  const irPara = (rota) => {
    navigate(rota);
    fecharMobile();
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    fecharMobile();
  };

  const isActive = (caminho) => {
    return location.pathname === caminho;
  };

  return (
    <aside className={`sidebar ${isCamisetas ? 'camisetas-mode' : ''} ${menuMobileAberto ? 'open' : ''}`}>
      {/* Cabeçalho da Empresa */}
      <div className="sidebar-header">
        <div className="logo-box-sm">
          <Scissors size={20} color={isCamisetas ? "#2563eb" : "#00c875"} strokeWidth={2.2} />
        </div>
        <div>
          <h2>Confecção Alfa</h2>
        </div>
      </div>

      {/* Switcher Dinâmico de Segmento (RF04) */}
      <div className="segmento-switcher-card">
        <div className="segmento-switcher-info">
          <span className="segmento-tag-label">Segmento Ativo</span>
          <span className={`segmento-name-active ${isCamisetas ? 'camisetas' : 'moda-intima'}`}>
            {isCamisetas ? (
              <>
                <Shirt size={14} />
                <span>Camisetas</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Moda Íntima</span>
              </>
            )}
          </span>
        </div>
        <button 
          type="button"
          className="btn-trocar-segmento-pill"
          title="Alternar entre Camisetas e Moda Íntima"
          onClick={() => navigate('/selecao-segmento')}
        >
          <RefreshCw size={12} />
          <span>Trocar</span>
        </button>
      </div>

      {/* Navegação Dinâmica conforme RF04, RF05, RF06 */}
      <nav className="sidebar-nav">
        {/* MENUS ESPECÍFICOS CONFORME O SEGMENTO ESCOLHIDO */}
        {isCamisetas ? (
          <>
            <button 
              className={`nav-item ${isActive('/dashboard') || isActive('/camisetas/dashboard') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/dashboard')}
            >
              <LayoutDashboard size={19} />
              <span>1. Dashboard Geral</span>
            </button>

            <button 
              className={`nav-item ${isActive('/comercial') || isActive('/camisetas/pedidos') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/pedidos')}
            >
              <ShoppingCart size={19} />
              <span>2. Pedidos do Cliente</span>
            </button>

            <button 
              className={`nav-item ${isActive('/estoque') || isActive('/camisetas/estoque') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/estoque')}
            >
              <Package size={19} />
              <span>3. Estoque de Insumos</span>
            </button>

            <button 
              className={`nav-item ${isActive('/ficha-tecnica') || isActive('/camisetas/ficha-tecnica') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/ficha-tecnica')}
            >
              <FileText size={19} />
              <span>4. Ficha Técnica Digital</span>
            </button>

            <button 
              className={`nav-item ${isActive('/corte-rendimento') || isActive('/camisetas/corte-rendimento') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/corte-rendimento')}
            >
              <Layers size={19} />
              <span>5. Corte & Rendimento</span>
            </button>

            <button 
              className={`nav-item ${isActive('/financeiro') || isActive('/camisetas/financeiro') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/financeiro')}
            >
              <DollarSign size={19} />
              <span>6. Registro Financeiro</span>
            </button>

            <button 
              className={`nav-item ${isActive('/costura') || isActive('/camisetas/costura-faccoes') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/costura-faccoes')}
            >
              <Scissors size={19} />
              <span>7. Costura & Facções</span>
            </button>
          </>
        ) : (
          /* FLUXO ORIGINAL DE MODA ÍNTIMA (CONFEÇÃO ALFA) */
          <>
            <button 
              className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
              onClick={() => irPara('/dashboard')}
            >
              <LayoutDashboard size={19} />
              <span>Dashboard</span>
            </button>

            <button 
              className={`nav-item ${isActive('/estoque') ? 'active' : ''}`}
              onClick={() => irPara('/estoque')}
            >
              <Package size={19} />
              <span>Estoque</span>
            </button>

            <button 
              className={`nav-item ${isActive('/ficha-tecnica') ? 'active' : ''}`}
              onClick={() => irPara('/ficha-tecnica')}
            >
              <FileText size={19} />
              <span>Ficha Técnica</span>
            </button>

            <button 
              className={`nav-item ${isActive('/comercial') ? 'active' : ''}`}
              onClick={() => irPara('/comercial')}
            >
              <ShoppingCart size={19} />
              <span>Comercial</span>
            </button>

            <button 
              className={`nav-item ${isActive('/corte-rendimento') ? 'active' : ''}`}
              onClick={() => irPara('/corte-rendimento')}
            >
              <Crop size={19} />
              <span>Corte/Rendimento</span>
            </button>

            <button 
              className={`nav-item ${isActive('/costura') ? 'active' : ''}`}
              onClick={() => irPara('/costura')}
            >
              <Scissors size={19} />
              <span>Costura (Facções)</span>
            </button>
          </>
        )}

        <button 
          className={`nav-item ${isActive('/configuracoes') || isActive('/perfil') ? 'active' : ''}`}
          onClick={() => irPara('/perfil')}
        >
          <User size={19} />
          <span>Perfil do Usuário</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item logout" onClick={handleLogout}>
          <LogOut size={19} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
