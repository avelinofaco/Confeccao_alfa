import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const SegmentoContext = createContext();

export function SegmentoProvider({ children }) {
  // Inicializa o segmento com base no localStorage ou padrão 'camisetas'
  const [segmento, setSegmentoState] = useState(() => {
    const salvo = localStorage.getItem('segmento_ativo');
    if (salvo) {
      const normalizado = salvo.toLowerCase();
      return normalizado === 'modinha' ? 'moda_intima' : normalizado;
    }
    
    // Fallback: perfil salvo do usuário
    try {
      const userStr = localStorage.getItem('usuario_confeccao');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.tipo_confeccao) {
          const tc = user.tipo_confeccao.toLowerCase();
          return tc === 'modinha' ? 'moda_intima' : tc;
        }
      }
    } catch {
      // Ignora erro de JSON
    }
    return 'camisetas';
  });

  const [usuario, setUsuario] = useState(() => {
    try {
      const userStr = localStorage.getItem('usuario_confeccao');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  });

  // Salva no localStorage sempre que mudar
  const selecionarSegmento = async (novoSegmento) => {
    let segNormalizado = (novoSegmento || 'camisetas').toLowerCase();
    if (segNormalizado === 'modinha') segNormalizado = 'moda_intima';

    setSegmentoState(segNormalizado);
    localStorage.setItem('segmento_ativo', segNormalizado);

    // Se estiver logado, persiste a preferência no perfil do usuário no banco
    if (usuario && usuario.id_usuario) {
      try {
        const segCapitalizado = segNormalizado === 'camisetas' ? 'Camisetas' : 'Moda Íntima';
        await api.put(`/usuarios/${usuario.id_usuario}/segmento`, { segmento: segCapitalizado });
        const userAtualizado = { ...usuario, tipo_confeccao: segCapitalizado };
        setUsuario(userAtualizado);
        localStorage.setItem('usuario_confeccao', JSON.stringify(userAtualizado));
      } catch (err) {
        console.warn('Não foi possível persistir o segmento no banco:', err);
      }
    }
  };

  const alternarSegmento = () => {
    const proximo = segmento === 'camisetas' ? 'moda_intima' : 'camisetas';
    selecionarSegmento(proximo);
  };

  const logout = () => {
    localStorage.removeItem('token_confeccao');
    localStorage.removeItem('usuario_confeccao');
    localStorage.removeItem('segmento_ativo');
    setUsuario(null);
  };

  const value = {
    segmento,
    selecionarSegmento,
    alternarSegmento,
    isCamisetas: segmento === 'camisetas',
    isModaIntima: segmento === 'moda_intima' || segmento === 'modinha',
    isModinha: segmento === 'moda_intima' || segmento === 'modinha', // retrocompatibilidade
    usuario,
    setUsuario,
    logout
  };

  return (
    <SegmentoContext.Provider value={value}>
      {children}
    </SegmentoContext.Provider>
  );
}

export function useSegmento() {
  const context = useContext(SegmentoContext);
  if (!context) {
    throw new Error('useSegmento deve ser usado dentro de um SegmentoProvider');
  }
  return context;
}
