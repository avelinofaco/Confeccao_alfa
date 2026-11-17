import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Scissors, CheckCircle2, ArrowRight, Sliders, Sparkles, Check, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import WorkflowStepper from '../components/WorkflowStepper';
import './Onboarding.css';

// Definição dos nichos com seus pré-ajustes inteligentes
const NICHOS = [
  {
    codigo: 'CAMISETA',
    nome: 'Camisetas & Vestuário Básico',
    icone: '👕',
    descricao: 'Malharia circular (meia malha, piquet, moletom). Foco em rendimento por peso (kg) e estamparia.',
    defaults: {
      grade_tamanhos: true,
      rendimento_peso: true,
      estamparia: true,
      controle_elasticos: false,
      lavanderia: false,
      faccionistas: true
    },
    etapasPreview: [
      { id_etapa: 1, nome_etapa: 'Corte de Malha (kg)', tipo_operacao: 'INTERNA' },
      { id_etapa: 2, nome_etapa: 'Estamparia / Silk', tipo_operacao: 'EXTERNA' },
      { id_etapa: 3, nome_etapa: 'Costura (Galoneira/Overloque)', tipo_operacao: 'INTERNA' },
      { id_etapa: 4, nome_etapa: 'Revisão & Embalagem', tipo_operacao: 'INTERNA' }
    ]
  },
  {
    codigo: 'CALCINHA',
    nome: 'Moda Íntima / Lingerie',
    icone: '👙',
    descricao: 'Calcinhas, sutiãs e cuecas. Foco em metros de microfibra, rendas, tensão de catraca e fundilho 100% algodão.',
    defaults: {
      grade_tamanhos: true,
      rendimento_peso: false,
      estamparia: false,
      controle_elasticos: true,
      lavanderia: false,
      faccionistas: true
    },
    etapasPreview: [
      { id_etapa: 1, nome_etapa: 'Corte Delicado (Serra Fita)', tipo_operacao: 'INTERNA' },
      { id_etapa: 2, nome_etapa: 'Preparação Fundilho Algodão', tipo_operacao: 'INTERNA' },
      { id_etapa: 3, nome_etapa: 'Aplicação de Elásticos (Catraca)', tipo_operacao: 'INTERNA' },
      { id_etapa: 4, nome_etapa: 'Travete & Laço', tipo_operacao: 'INTERNA' },
      { id_etapa: 5, nome_etapa: 'Cabide & Tag', tipo_operacao: 'INTERNA' }
    ]
  },
  {
    codigo: 'JEANS',
    nome: 'Jeanswear & Sarja',
    icone: '👖',
    descricao: 'Calças e jaquetas em denim pesado. Pespontadeiras 2 agulhas, lavanderia industrial (stone/destroyer) e rebites.',
    defaults: {
      grade_tamanhos: true,
      rendimento_peso: false,
      estamparia: false,
      controle_elasticos: false,
      lavanderia: true,
      faccionistas: true
    },
    etapasPreview: [
      { id_etapa: 1, nome_etapa: 'Corte Enfesto Pesado', tipo_operacao: 'INTERNA' },
      { id_etapa: 2, nome_etapa: 'Costura Pesada & Cós', tipo_operacao: 'EXTERNA' },
      { id_etapa: 3, nome_etapa: 'Lavanderia Industrial', tipo_operacao: 'EXTERNA' },
      { id_etapa: 4, nome_etapa: 'Pregar Rebites & Botões', tipo_operacao: 'INTERNA' },
      { id_etapa: 5, nome_etapa: 'Passadoria a Vapor', tipo_operacao: 'INTERNA' }
    ]
  },
  {
    codigo: 'MISTO',
    nome: 'Confecção Mista / Multi-Produtos',
    icone: '✂️',
    descricao: 'Produção versátil que atende múltiplos nichos sob demanda. Todos os recursos operacionais ativados.',
    defaults: {
      grade_tamanhos: true,
      rendimento_peso: true,
      estamparia: true,
      controle_elasticos: true,
      lavanderia: true,
      faccionistas: true
    },
    etapasPreview: [
      { id_etapa: 1, nome_etapa: 'Corte & Enfesto', tipo_operacao: 'INTERNA' },
      { id_etapa: 2, nome_etapa: 'Processos Especiais', tipo_operacao: 'EXTERNA' },
      { id_etapa: 3, nome_etapa: 'Montagem & Costura', tipo_operacao: 'INTERNA' },
      { id_etapa: 4, nome_etapa: 'Controle de Qualidade', tipo_operacao: 'INTERNA' }
    ]
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [passoAtual, setPassoAtual] = useState(1);
  const [nichoSelecionado, setNichoSelecionado] = useState(NICHOS[0]);
  const [nomeConfeccao, setNomeConfeccao] = useState('Confecção Alfa');
  const [modulos, setModulos] = useState(NICHOS[0].defaults);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) {
      navigate('/');
    }
  }, [navigate]);

  // Ao trocar de nicho, aplica os padrões recomendados
  const handleSelecionarNicho = (nicho) => {
    setNichoSelecionado(nicho);
    setModulos({ ...nicho.defaults });
  };

  const handleToggleModulo = (chave) => {
    setModulos(prev => ({
      ...prev,
      [chave]: !prev[chave]
    }));
  };

  const handleFinalizarOnboarding = async () => {
    setSalvando(true);
    try {
      // Garante que os contextos padrão do backend estão semeados
      await api.post('/contextos/semear-padroes').catch(() => null);

      // Puxa o ID do usuário ou usa 1 por padrão
      const userStorage = localStorage.getItem('usuario_confeccao');
      const idUsuario = userStorage ? JSON.parse(userStorage).id_usuario : 1;

      const payload = {
        tipo_confeccao: nichoSelecionado.codigo,
        modulos_selecionados: modulos,
        nome_confeccao: nomeConfeccao
      };

      const res = await api.post(`/usuarios/${idUsuario}/onboarding-contexto`, payload);

      // Atualiza o localStorage com as novas preferências
      const usuarioAtualizado = {
        ...(userStorage ? JSON.parse(userStorage) : {}),
        onboarding_concluido: true,
        contexto_preferido: nichoSelecionado.codigo,
        preferencias_modulos: modulos,
        nome_confeccao: nomeConfeccao
      };

      localStorage.setItem('usuario_confeccao', JSON.stringify(usuarioAtualizado));
      localStorage.setItem('contexto_ativo', nichoSelecionado.codigo);

      alert(`Perfil configurado com sucesso para ${nichoSelecionado.nome}! O sistema foi adaptado para a sua realidade.`);
      navigate('/dashboard');

    } catch (err) {
      console.error("Erro ao salvar onboarding:", err);
      // Mesmo com erro de API, salva localmente e prossegue para não travar o usuário
      localStorage.setItem('contexto_ativo', nichoSelecionado.codigo);
      navigate('/dashboard');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        {/* Cabeçalho */}
        <div className="onboarding-header">
          <div className="logo-badge">
            <Scissors size={18} strokeWidth={2.5} />
            <span>Configuração Inicial do Negócio</span>
          </div>
          <h1>Como a sua confecção opera?</h1>
          <p>
            Personalize os fluxos, métricas de corte e etapas da produção para que o sistema se adapte ao seu tipo de produto.
          </p>
        </div>

        {/* Indicador de Passos */}
        <div className="wizard-steps-indicator">
          <div className={`wizard-step-pill ${passoAtual >= 1 ? 'active' : ''}`}>
            {passoAtual > 1 ? <Check size={14} color="#00c875" /> : '1'}
            <span>1. Família da Peça</span>
          </div>
          <ChevronRight size={14} color="#94a3b8" />
          <div className={`wizard-step-pill ${passoAtual >= 2 ? 'active' : ''}`}>
            <span>2. Funcionalidades & Regras</span>
          </div>
          <ChevronRight size={14} color="#94a3b8" />
          <div className={`wizard-step-pill ${passoAtual >= 3 ? 'active' : ''}`}>
            <span>3. Esteira de Produção</span>
          </div>
        </div>

        {/* PASSO 1: ESCOLHA DO NICHO */}
        {passoAtual === 1 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Nome da sua Fábrica / Marca
              </label>
              <input 
                type="text" 
                value={nomeConfeccao}
                onChange={(e) => setNomeConfeccao(e.target.value)}
                placeholder="Ex: Confecção Alfa"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '12px' }}>
              Selecione o seu principal segmento de produção:
            </label>

            <div className="nicho-options-grid">
              {NICHOS.map((nicho) => {
                const isSelected = nichoSelecionado.codigo === nicho.codigo;
                return (
                  <div
                    key={nicho.codigo}
                    className={`nicho-option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelecionarNicho(nicho)}
                  >
                    {isSelected && (
                      <div className="nicho-selected-check">
                        <CheckCircle2 size={20} />
                      </div>
                    )}
                    <div className="nicho-icon-box">{nicho.icone}</div>
                    <h3 className="nicho-card-title">{nicho.nome}</h3>
                    <p className="nicho-card-desc">{nicho.descricao}</p>
                  </div>
                );
              })}
            </div>

            <div className="onboarding-actions">
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Você poderá criar novos nichos ou alterar essa escolha a qualquer momento nas Configurações.
              </span>
              <button 
                type="button" 
                className="onboarding-submit-btn"
                onClick={() => setPassoAtual(2)}
              >
                <span>Avançar para Funcionalidades</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* PASSO 2: FUNCIONALIDADES E REGRAS */}
        {passoAtual === 2 && (
          <div>
            <div className="features-box">
              <h3>
                <Sliders size={18} color="#00c875" />
                Regras e Módulos Ativos para {nichoSelecionado.nome}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0, marginBottom: '16px' }}>
                Os recursos abaixo foram pré-configurados com base na indústria têxtil, mas você pode marcar ou desmarcar o que desejar:
              </p>

              <div className="features-toggles-list">
                <label className="feature-check-item">
                  <input 
                    type="checkbox" 
                    checked={modulos.grade_tamanhos} 
                    onChange={() => handleToggleModulo('grade_tamanhos')}
                  />
                  <div>
                    <span className="title">Grade de Tamanhos (P, M, G, GG ou 36 a 48)</span>
                    <span className="subtitle">Controle de quantidades e estoque por tamanho e cor</span>
                  </div>
                </label>

                <label className="feature-check-item">
                  <input 
                    type="checkbox" 
                    checked={modulos.rendimento_peso} 
                    onChange={() => handleToggleModulo('rendimento_peso')}
                  />
                  <div>
                    <span className="title">Rendimento do Corte por Peso em kg (peças/kg)</span>
                    <span className="subtitle">Recomendado para malharia/camisetas; desative se cortar por metros</span>
                  </div>
                </label>

                <label className="feature-check-item">
                  <input 
                    type="checkbox" 
                    checked={modulos.controle_elasticos} 
                    onChange={() => handleToggleModulo('controle_elasticos')}
                  />
                  <div>
                    <span className="title">Controle de Tensão e Consumo de Elásticos</span>
                    <span className="subtitle">Métrica em metros, tensão de catraca e fundilhos (moda íntima)</span>
                  </div>
                </label>

                <label className="feature-check-item">
                  <input 
                    type="checkbox" 
                    checked={modulos.estamparia} 
                    onChange={() => handleToggleModulo('estamparia')}
                  />
                  <div>
                    <span className="title">Módulo de Estamparia / Silk Screen / Sublimação</span>
                    <span className="subtitle">Controle de remessas e perdas para oficinas de estamparia</span>
                  </div>
                </label>

                <label className="feature-check-item">
                  <input 
                    type="checkbox" 
                    checked={modulos.lavanderia} 
                    onChange={() => handleToggleModulo('lavanderia')}
                  />
                  <div>
                    <span className="title">Módulo de Lavanderia Industrial</span>
                    <span className="subtitle">Etapas de stone wash, destroyed e testes de encolhimento</span>
                  </div>
                </label>

                <label className="feature-check-item">
                  <input 
                    type="checkbox" 
                    checked={modulos.faccionistas} 
                    onChange={() => handleToggleModulo('faccionistas')}
                  />
                  <div>
                    <span className="title">Gestão de Oficinas / Faccionistas Externos</span>
                    <span className="subtitle">Envio e retorno de lotes com controle de perdas e pagamento por peça</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="onboarding-actions">
              <button 
                type="button" 
                className="secondary-btn tab-btn"
                onClick={() => setPassoAtual(1)}
              >
                Voltar
              </button>
              <button 
                type="button" 
                className="onboarding-submit-btn"
                onClick={() => setPassoAtual(3)}
              >
                <span>Ver Esteira Recomendada</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* PASSO 3: ESTEIRA PRODUTIVA RECOMENDADA & CONFIRMAÇÃO */}
        {passoAtual === 3 && (
          <div>
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px' }}>{nichoSelecionado.icone}</span>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#166534', margin: 0 }}>
                  Esteira de Produção Adaptada para {nichoSelecionado.nome}
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#15803d', margin: '0 0 16px 0' }}>
                Ao criar uma Ordem de Produção (OP), o sistema guiará a peça pelas seguintes etapas configuradas:
              </p>

              <WorkflowStepper etapas={nichoSelecionado.etapasPreview} />
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px 0' }}>
                Resumo da Personalização:
              </h4>
              <ul style={{ fontSize: '13px', color: '#475569', margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
                <li><strong>Segmento:</strong> {nichoSelecionado.nome} ({nichoSelecionado.codigo})</li>
                <li><strong>Corte Adaptativo:</strong> {modulos.rendimento_peso ? 'Medição em kg de malha' : 'Medição em metros de tecido / unidades'}</li>
                <li><strong>Controle de Elásticos:</strong> {modulos.controle_elasticos ? 'Ativado (ideal para lingerie)' : 'Desativado'}</li>
                <li><strong>Estamparia / Silk:</strong> {modulos.estamparia ? 'Etapa habilitada' : 'Não se aplica'}</li>
                <li><strong>Lavanderia:</strong> {modulos.lavanderia ? 'Etapa habilitada' : 'Não se aplica'}</li>
              </ul>
            </div>

            <div className="onboarding-actions">
              <button 
                type="button" 
                className="secondary-btn tab-btn"
                onClick={() => setPassoAtual(2)}
                disabled={salvando}
              >
                Voltar
              </button>
              <button 
                type="button" 
                className="onboarding-submit-btn"
                onClick={handleFinalizarOnboarding}
                disabled={salvando}
              >
                {salvando ? (
                  <span>Configurando Sistema...</span>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Concluir e Iniciar no Sistema</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
