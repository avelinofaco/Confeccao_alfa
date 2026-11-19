import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SegmentoProvider } from './context/SegmentoContext';
import { ConfirmProvider } from './components/feedback/ConfirmProvider';
import { RotaProtegida } from './components/auth/RotaProtegida';

// Páginas de Autenticação e Seleção
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import FichaTecnica from './pages/FichaTecnica';
import CorteRendimento from './pages/CorteRendimento';
import Costura from './pages/Costura';
import Comercial from './pages/Comercial';
import Equipe from './pages/Equipe';
import Configuracoes from './pages/Configuracoes';
import './App.css';

function App() {
  return (
    <SegmentoProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/ficha-tecnica" element={<FichaTecnica />} />
            <Route path="/corte-rendimento" element={<CorteRendimento />} />
            <Route path="/costura" element={<Costura />} />
            <Route path="/comercial" element={<Comercial />} />
            <Route path="/equipe" element={<Equipe />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </SegmentoProvider>
  );
}

export default App;
