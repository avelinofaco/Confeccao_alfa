import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SegmentoProvider, useSegmento } from './context/SegmentoContext';
import { ToastProvider } from './components/feedback/ToastProvider';
import { ConfirmProvider } from './components/feedback/ConfirmProvider';
import { RotaProtegida } from './components/auth/RotaProtegida';

// Páginas de Autenticação e Seleção
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import SelecaoSegmento from './pages/SelecaoSegmento';
import PerfilUsuario from './pages/PerfilUsuario';

// Páginas Originais da Confecção Alfa (Moda Íntima)
import DashboardModaIntima from './pages/Dashboard';
import EstoqueModaIntima from './pages/Estoque';
import FichaTecnicaModaIntima from './pages/FichaTecnica';
import CorteRendimentoModaIntima from './pages/CorteRendimento';
import CosturaModaIntima from './pages/Costura';
import ComercialModaIntima from './pages/Comercial';

// 7 Novas Telas Especialistas em Camisetas (Nomes em Português)
import DashboardCamisetas from './pages/DashboardCamisetas';
import PedidoCamisetas from './pages/PedidoCamisetas';
import ClientesCamisetas from './pages/ClientesCamisetas';
import EstoqueCamisetas from './pages/EstoqueCamisetas';
import FichaTecnicaCamisetas from './pages/FichaTecnicaCamisetas';
import CorteRendimentoCamisetas from './pages/CorteRendimentoCamisetas';
import RegistroFinanceiroCamisetas from './pages/RegistroFinanceiroCamisetas';
import CosturaFaccoesCamisetas from './pages/CosturaFaccoesCamisetas';
import ProdutosProntosCamisetas from './pages/ProdutosProntosCamisetas';
import PortalPedidoCliente from './pages/PortalPedidoCliente';
import PortalCatalogoCliente from './pages/PortalCatalogoCliente';

import './App.css';

// Roteador Dinâmico baseado no Segmento Ativo do Usuário
function RotaDinamica({ telaCamisetas: TelaCamisetas, telaModaIntima: TelaModaIntima }) {
  const { isCamisetas } = useSegmento();
  return isCamisetas ? <TelaCamisetas /> : <TelaModaIntima />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Autenticação & Seleção de Segmento */}
      <Route path="/" element={<Login />} />
      <Route path="/portal/pedido/:token" element={<PortalPedidoCliente />} />
      <Route path="/portal/cliente/:token" element={<PortalCatalogoCliente />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/selecao-segmento" element={<RotaProtegida><SelecaoSegmento /></RotaProtegida>} />

      {/* 1. Dashboard: Alterna automaticamente pelo segmento ativo */}
      <Route 
        path="/dashboard" 
        element={<RotaProtegida><RotaDinamica telaCamisetas={DashboardCamisetas} telaModaIntima={DashboardModaIntima} /></RotaProtegida>} 
      />

      {/* 2. Pedidos / Comercial */}
      <Route 
        path="/comercial" 
        element={<RotaProtegida><RotaDinamica telaCamisetas={PedidoCamisetas} telaModaIntima={ComercialModaIntima} /></RotaProtegida>} 
      />

      {/* 3. Estoque de Insumos */}
      <Route 
        path="/estoque" 
        element={<RotaProtegida><RotaDinamica telaCamisetas={EstoqueCamisetas} telaModaIntima={EstoqueModaIntima} /></RotaProtegida>} 
      />

      {/* 4. Ficha Técnica */}
      <Route 
        path="/ficha-tecnica" 
        element={<RotaProtegida><RotaDinamica telaCamisetas={FichaTecnicaCamisetas} telaModaIntima={FichaTecnicaModaIntima} /></RotaProtegida>} 
      />

      {/* 5. Corte e Rendimento (PCP) */}
      <Route 
        path="/corte-rendimento" 
        element={<RotaProtegida><RotaDinamica telaCamisetas={CorteRendimentoCamisetas} telaModaIntima={CorteRendimentoModaIntima} /></RotaProtegida>} 
      />

      {/* 6. Registro Financeiro */}
      <Route path="/financeiro" element={<RotaProtegida><RegistroFinanceiroCamisetas /></RotaProtegida>} />

      {/* 7. Costura e Facções */}
      <Route 
        path="/costura" 
        element={<RotaProtegida><RotaDinamica telaCamisetas={CosturaFaccoesCamisetas} telaModaIntima={CosturaModaIntima} /></RotaProtegida>} 
      />

      {/* Rotas Explícitas Diretas de Camisetas */}
      <Route path="/camisetas/dashboard" element={<RotaProtegida><DashboardCamisetas /></RotaProtegida>} />
      <Route path="/camisetas/pedidos" element={<RotaProtegida><PedidoCamisetas /></RotaProtegida>} />
      <Route path="/camisetas/clientes" element={<RotaProtegida><ClientesCamisetas /></RotaProtegida>} />
      <Route path="/camisetas/estoque" element={<RotaProtegida><EstoqueCamisetas /></RotaProtegida>} />
      <Route path="/camisetas/ficha-tecnica" element={<RotaProtegida><FichaTecnicaCamisetas /></RotaProtegida>} />
      <Route path="/camisetas/corte-rendimento" element={<RotaProtegida><CorteRendimentoCamisetas /></RotaProtegida>} />
      <Route path="/camisetas/financeiro" element={<RotaProtegida><RegistroFinanceiroCamisetas /></RotaProtegida>} />
      <Route path="/camisetas/costura-faccoes" element={<RotaProtegida><CosturaFaccoesCamisetas /></RotaProtegida>} />
      <Route path="/camisetas/produtos-prontos" element={<RotaProtegida><ProdutosProntosCamisetas /></RotaProtegida>} />

      {/* Módulos do Sistema e Perfil */}
      <Route path="/configuracoes" element={<RotaProtegida><PerfilUsuario /></RotaProtegida>} />
      <Route path="/perfil" element={<RotaProtegida><PerfilUsuario /></RotaProtegida>} />
      <Route path="/equipe" element={<RotaProtegida><Navigate to="/configuracoes" replace /></RotaProtegida>} />

      {/* Fallback */}
      <Route path="*" element={<RotaProtegida><Navigate to="/" replace /></RotaProtegida>} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SegmentoProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </ToastProvider>
      </SegmentoProvider>
    </BrowserRouter>
  );
}

export default App;