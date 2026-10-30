import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SegmentoProvider, useSegmento } from './context/SegmentoContext';

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
import EstoqueCamisetas from './pages/EstoqueCamisetas';
import FichaTecnicaCamisetas from './pages/FichaTecnicaCamisetas';
import CorteRendimentoCamisetas from './pages/CorteRendimentoCamisetas';
import RegistroFinanceiroCamisetas from './pages/RegistroFinanceiroCamisetas';
import CosturaFaccoesCamisetas from './pages/CosturaFaccoesCamisetas';

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
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/selecao-segmento" element={<SelecaoSegmento />} />

      {/* 1. Dashboard: Alterna automaticamente pelo segmento ativo */}
      <Route 
        path="/dashboard" 
        element={<RotaDinamica telaCamisetas={DashboardCamisetas} telaModaIntima={DashboardModaIntima} />} 
      />

      {/* 2. Pedidos / Comercial */}
      <Route 
        path="/comercial" 
        element={<RotaDinamica telaCamisetas={PedidoCamisetas} telaModaIntima={ComercialModaIntima} />} 
      />

      {/* 3. Estoque de Insumos */}
      <Route 
        path="/estoque" 
        element={<RotaDinamica telaCamisetas={EstoqueCamisetas} telaModaIntima={EstoqueModaIntima} />} 
      />

      {/* 4. Ficha Técnica */}
      <Route 
        path="/ficha-tecnica" 
        element={<RotaDinamica telaCamisetas={FichaTecnicaCamisetas} telaModaIntima={FichaTecnicaModaIntima} />} 
      />

      {/* 5. Corte e Rendimento (PCP) */}
      <Route 
        path="/corte-rendimento" 
        element={<RotaDinamica telaCamisetas={CorteRendimentoCamisetas} telaModaIntima={CorteRendimentoModaIntima} />} 
      />

      {/* 6. Registro Financeiro */}
      <Route path="/financeiro" element={<RegistroFinanceiroCamisetas />} />

      {/* 7. Costura e Facções */}
      <Route 
        path="/costura" 
        element={<RotaDinamica telaCamisetas={CosturaFaccoesCamisetas} telaModaIntima={CosturaModaIntima} />} 
      />

      {/* Rotas Explícitas Diretas de Camisetas */}
      <Route path="/camisetas/dashboard" element={<DashboardCamisetas />} />
      <Route path="/camisetas/pedidos" element={<PedidoCamisetas />} />
      <Route path="/camisetas/estoque" element={<EstoqueCamisetas />} />
      <Route path="/camisetas/ficha-tecnica" element={<FichaTecnicaCamisetas />} />
      <Route path="/camisetas/corte-rendimento" element={<CorteRendimentoCamisetas />} />
      <Route path="/camisetas/financeiro" element={<RegistroFinanceiroCamisetas />} />
      <Route path="/camisetas/costura-faccoes" element={<CosturaFaccoesCamisetas />} />

      {/* Módulos do Sistema e Perfil */}
      <Route path="/configuracoes" element={<PerfilUsuario />} />
      <Route path="/perfil" element={<PerfilUsuario />} />
      <Route path="/equipe" element={<Navigate to="/configuracoes" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SegmentoProvider>
        <AppRoutes />
      </SegmentoProvider>
    </BrowserRouter>
  );
}

export default App;