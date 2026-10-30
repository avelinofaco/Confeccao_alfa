import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shirt, 
  Sparkles, 
  Layers, 
  Scissors, 
  ArrowRight, 
  Check, 
  LogOut, 
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { useSegmento } from '../context/SegmentoContext';
import './SelecaoSegmento.css';

function SelecaoSegmento() {
  const navigate = useNavigate();
  const { segmento, selecionarSegmento, usuario, logout } = useSegmento();
  
  // Opção temporariamente selecionada na tela
  const [opcaoEscolhida, setOpcaoEscolhida] = useState(segmento || 'camisetas');

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) {
      navigate('/');
    }
  }, [navigate]);

  const handleConfirmar = async (seg) => {
    const escolhido = seg || opcaoEscolhida;
    await selecionarSegmento(escolhido);

    if (escolhido === 'camisetas') {
      navigate('/camisetas/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="selecao-container">
      <header className="selecao-header">
        <div className="badge-scope">
          <Sliders size={14} />
          <span>Filtro de Mini Escopo</span>
        </div>
        <h1>Selecione o Segmento da sua Confecção</h1>
        <p>
          Adapte instantaneamente os menus, telas, cálculos de rendimento e fluxos de corte 
          e costura para o modelo operacional da sua fábrica.
        </p>
      </header>

      <div className="cards-segmentos-grid">
        {/* OPÇÃO A: CAMISETAS */}
        <div 
          className={`segmento-card camisetas ${opcaoEscolhida === 'camisetas' ? 'selecionado' : ''}`}
          onClick={() => setOpcaoEscolhida('camisetas')}
        >
          <div>
            <div className="card-top">
              <div className="icon-wrapper blue">
                <Shirt size={30} />
              </div>
              <div className="radio-check">
                {opcaoEscolhida === 'camisetas' && <Check size={16} strokeWidth={3} />}
              </div>
            </div>

            <div className="card-title-group">
              <h2>Opção A: Camisetas</h2>
              <span className="tag-subtitulo">Malha Tubular & Produção Linear</span>
            </div>

            <p className="card-description">
              Processo de alta produtividade voltado a malhas tubulares ou abertas, 
              com planejamento de enfesto em mesa e costura sequencial por postos de trabalho.
            </p>

            <div className="fluxo-destaque-box">
              <div className="fluxo-destaque-title">Destaques do Fluxo Especializado:</div>
              <div className="fluxo-steps">
                <div className="fluxo-step-item">
                  <span className="bullet-dot"></span>
                  <span><strong>Enfesto em Mesa:</strong> cálculo de camadas, risco e metragem</span>
                </div>
                <div className="fluxo-step-item">
                  <span className="bullet-dot"></span>
                  <span><strong>Corte Tubular:</strong> grade distribuída (P, M, G, GG)</span>
                </div>
                <div className="fluxo-step-item">
                  <span className="bullet-dot"></span>
                  <span><strong>Costura Linear:</strong> ombros, gola ribana, mangas e barra galoneira</span>
                </div>
              </div>
            </div>
          </div>

          <button 
            type="button"
            className="btn-entrar-segmento"
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmar('camisetas');
            }}
          >
            <span>Acessar Módulo Camisetas</span>
            <ArrowRight size={18} />
          </button>
        </div>

        {/* OPÇÃO B: MODA ÍNTIMA */}
        <div 
          className={`segmento-card ${opcaoEscolhida === 'moda_intima' ? 'selecionado' : ''}`}
          onClick={() => setOpcaoEscolhida('moda_intima')}
        >
          <div>
            <div className="card-top">
              <div className="icon-wrapper emerald">
                <Sparkles size={30} />
              </div>
              <div className="radio-check">
                {opcaoEscolhida === 'moda_intima' && <Check size={16} strokeWidth={3} />}
              </div>
            </div>

            <div className="card-title-group">
              <h2>Opção B: Moda Íntima</h2>
              <span className="tag-subtitulo">Lingerie, Aviamentos & Facções Externas</span>
            </div>

            <p className="card-description">
              Fluxo completo já consolidado no sistema, focado em peças de moda íntima, 
              calcinhas, sutiãs e cuecas com fichas técnicas ricas em aviamentos.
            </p>

            <div className="fluxo-destaque-box">
              <div className="fluxo-destaque-title">Destaques do Fluxo Especializado:</div>
              <div className="fluxo-steps">
                <div className="fluxo-step-item">
                  <span className="bullet-dot"></span>
                  <span><strong>Fichas Técnicas:</strong> consumo de alças, elásticos e laços</span>
                </div>
                <div className="fluxo-step-item">
                  <span className="bullet-dot"></span>
                  <span><strong>Corte & Rendimento:</strong> pesagem real e peças por kg</span>
                </div>
                <div className="fluxo-step-item">
                  <span className="bullet-dot"></span>
                  <span><strong>Costura Externa:</strong> remessa para costureiras e baixa de aviamento</span>
                </div>
              </div>
            </div>
          </div>

          <button 
            type="button"
            className="btn-entrar-segmento"
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmar('moda_intima');
            }}
          >
            <span>Acessar Módulo Moda Íntima</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <footer className="selecao-footer">
        <div className="user-logged-badge">
          <span>Usuário ativo: <strong>{usuario?.nome_usuario || 'Gestor Alfa'}</strong> ({usuario?.perfil || 'Gestor'})</span>
          <span>•</span>
          <button className="btn-logout-link" onClick={handleLogout}>
            Sair do sistema
          </button>
        </div>
      </footer>
    </div>
  );
}

export default SelecaoSegmento;
