import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Layers, 
  Scissors, 
  Plus, 
  Search, 
  CheckCircle, 
  Activity, 
  X, 
  Calculator, 
  ArrowRight,
  Sparkles,
  Shirt,
  Menu,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './EnfestoCorteCamisetas.css';

function EnfestoCorteCamisetas() {
  const navigate = useNavigate();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ordens, setOrdens] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [showModalCriarOP, setShowModalCriarOP] = useState(false);
  const [showModalRetorno, setShowModalRetorno] = useState(false);

  // Estados do Simulador / Planejador de Enfesto (Grade P, M, G, GG, XGG)
  const [novoEnfesto, setNovoEnfesto] = useState({
    codigo_op: `LOTE-CAM-${Math.floor(100 + Math.random() * 900)}`,
    id_produto: '',
    cor: 'Preto Reativo',
    tipo_tecido_corte: 'Malha Tubular 100% Algodão 30.1',
    comprimento_enfesto_metros: 4.2,
    numero_folhas_enfesto: 40,
    grade_P: 1,
    grade_M: 2,
    grade_G: 2,
    grade_GG: 1,
    grade_XGG: 1,
    peso_malha_enviado: 45.0
  });

  // Estado do Apontamento Real de Retorno de Corte com Grade
  const [dadosRetorno, setDadosRetorno] = useState({
    id_op: null,
    codigo_op_exibicao: '',
    is_op_estruturada: false,
    peso_malha_real_kg: 45.0,
    aparas_retalhos_kg: 2.2,
    numero_folhas_enfesto: 40,
    comprimento_enfesto_metros: 4.2,
    operador: 'Cortador Mesa 1',
    grade_cortada: {
      P: 40,
      M: 80,
      G: 80,
      GG: 40,
      XGG: 40
    },
    // Compatibilidade caso seja OP simples
    quantidade_pecas_cortadas: 280
  });

  // Cálculos em tempo real da mesa de enfesto (P, M, G, GG, XGG)
  const totalMoldesPorFolha = (Number(novoEnfesto.grade_P) || 0) + 
                              (Number(novoEnfesto.grade_M) || 0) + 
                              (Number(novoEnfesto.grade_G) || 0) + 
                              (Number(novoEnfesto.grade_GG) || 0) +
                              (Number(novoEnfesto.grade_XGG) || 0);

  const totalPecasPrevistas = totalMoldesPorFolha * (Number(novoEnfesto.numero_folhas_enfesto) || 0);
  const totalMetrosTecido = ((Number(novoEnfesto.comprimento_enfesto_metros) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)).toFixed(1);
  const rendimentoEstimado = novoEnfesto.peso_malha_enviado > 0 
    ? (totalPecasPrevistas / Number(novoEnfesto.peso_malha_enviado)).toFixed(2)
    : '0.00';

  // Total de peças no modal de retorno do corte
  const totalPecasRetornoCalculadas = 
    (Number(dadosRetorno.grade_cortada?.P) || 0) +
    (Number(dadosRetorno.grade_cortada?.M) || 0) +
    (Number(dadosRetorno.grade_cortada?.G) || 0) +
    (Number(dadosRetorno.grade_cortada?.GG) || 0) +
    (Number(dadosRetorno.grade_cortada?.XGG) || 0);

  const rendimentoRealCalculado = dadosRetorno.peso_malha_real_kg > 0
    ? (totalPecasRetornoCalculadas / Number(dadosRetorno.peso_malha_real_kg)).toFixed(2)
    : '0.00';

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resCamisetas, resGerais, resProdutos] = await Promise.all([
        api.get('/producao/camisetas/ordens').catch(() => ({ data: [] })),
        api.get('/producao/ordens').catch(() => ({ data: [] })),
        api.get('/produtos/').catch(() => ({ data: [] }))
      ]);

      const camisetasEstruturadas = (resCamisetas.data || []).map(c => ({
        ...c,
        is_estruturada: true,
        quantidade_pecas_cortadas: c.total_cortado,
        rendimento_real: c.total_cortado && c.peso_malha_estimado_kg
          ? (c.total_cortado / c.peso_malha_estimado_kg).toFixed(2)
          : null,
        peso_malha_enviado: c.peso_malha_estimado_kg
      }));

      const ordensGerais = (resGerais.data || []).map(g => ({
        ...g,
        is_estruturada: false
      }));

      // Combina priorizando as estruturadas de camisetas
      const todas = [...camisetasEstruturadas, ...ordensGerais];
      setOrdens(todas);

      // Produtos
      const prods = resProdutos.data || [];
      setProdutos(prods);
      if (prods.length > 0 && !novoEnfesto.id_produto) {
        setNovoEnfesto(prev => ({ ...prev, id_produto: prods[0].id_produto }));
      }
    } catch (err) {
      console.error('Erro ao carregar dados do enfesto:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) navigate('/');
    else carregarDados();
  }, [navigate]);

  const handleCriarOPEnfesto = async (e) => {
    e.preventDefault();
    if (!novoEnfesto.id_produto) {
      alert('Selecione um produto/modelo para o corte de camisetas.');
      return;
    }

    const folhas = Number(novoEnfesto.numero_folhas_enfesto) || 1;
    const gradeCalculada = {
      P: (Number(novoEnfesto.grade_P) || 0) * folhas,
      M: (Number(novoEnfesto.grade_M) || 0) * folhas,
      G: (Number(novoEnfesto.grade_G) || 0) * folhas,
      GG: (Number(novoEnfesto.grade_GG) || 0) * folhas,
      XGG: (Number(novoEnfesto.grade_XGG) || 0) * folhas
    };

    try {
      // 1. Tenta criar na API estruturada de Camisetas
      const payloadEstruturado = {
        codigo_op: novoEnfesto.codigo_op,
        id_produto: parseInt(novoEnfesto.id_produto),
        cor: novoEnfesto.cor || 'Preto Reativo',
        grade_planejada: gradeCalculada,
        rendimento_teorico_kg: parseFloat(rendimentoEstimado) || 4.5,
        peso_malha_estimado_kg: parseFloat(novoEnfesto.peso_malha_enviado)
      };

      try {
        await api.post('/producao/camisetas/ordens', payloadEstruturado);
      } catch (errApiEstruturada) {
        console.warn('Fallback para /producao/ordens:', errApiEstruturada);
        // Fallback para rota legada se necessário
        const gradeFormatada = `P:${novoEnfesto.grade_P} M:${novoEnfesto.grade_M} G:${novoEnfesto.grade_G} GG:${novoEnfesto.grade_GG} XGG:${novoEnfesto.grade_XGG}`;
        await api.post('/producao/ordens', {
          codigo_op: novoEnfesto.codigo_op,
          id_produto: parseInt(novoEnfesto.id_produto),
          peso_malha_enviado: parseFloat(novoEnfesto.peso_malha_enviado),
          segmento: 'Camisetas',
          tipo_tecido_corte: novoEnfesto.tipo_tecido_corte,
          numero_folhas_enfesto: parseInt(novoEnfesto.numero_folhas_enfesto),
          comprimento_enfesto_metros: parseFloat(novoEnfesto.comprimento_enfesto_metros),
          grade_corte: gradeFormatada
        });
      }

      alert('OP de Camisetas com Grade Matricial (P, M, G, GG, XGG) criada com sucesso!');
      
      setNovoEnfesto(prev => ({
        ...prev,
        codigo_op: `LOTE-CAM-${Math.floor(100 + Math.random() * 900)}`
      }));
      setShowModalCriarOP(false);
      carregarDados();
    } catch (err) {
      console.error('Erro ao criar OP de enfesto:', err);
      alert(err.response?.data?.detail || 'Erro ao gerar OP de enfesto.');
    }
  };

  const abrirModalRetorno = (op) => {
    const isEstruturada = op.is_estruturada || Boolean(op.grade_planejada);
    let gradeInicial = { P: 0, M: 0, G: 0, GG: 0, XGG: 0 };

    if (op.grade_planejada && typeof op.grade_planejada === 'object') {
      gradeInicial = {
        P: op.grade_planejada.P || 0,
        M: op.grade_planejada.M || 0,
        G: op.grade_planejada.G || 0,
        GG: op.grade_planejada.GG || 0,
        XGG: op.grade_planejada.XGG || 0
      };
    } else if (op.numero_folhas_enfesto) {
      const f = op.numero_folhas_enfesto;
      gradeInicial = { P: 1 * f, M: 2 * f, G: 2 * f, GG: 1 * f, XGG: 1 * f };
    }

    const totalInit = Object.values(gradeInicial).reduce((a, b) => a + b, 0);

    setDadosRetorno({
      id_op: op.id_op,
      codigo_op_exibicao: op.codigo_op,
      is_op_estruturada: isEstruturada,
      peso_malha_real_kg: op.peso_malha_estimado_kg || op.peso_malha_enviado || 45.0,
      aparas_retalhos_kg: 2.2,
      numero_folhas_enfesto: op.numero_folhas_enfesto || 40,
      comprimento_enfesto_metros: op.comprimento_enfesto_metros || 4.2,
      operador: 'Cortador Mesa 1',
      grade_cortada: gradeInicial,
      quantidade_pecas_cortadas: totalInit || 240
    });
    setShowModalRetorno(true);
  };

  const handleRegistrarRetorno = async (e) => {
    e.preventDefault();
    try {
      if (dadosRetorno.is_op_estruturada) {
        // Envia para o endpoint avançado de camisetas
        const payloadCorte = {
          peso_malha_real_kg: parseFloat(dadosRetorno.peso_malha_real_kg),
          numero_folhas_enfesto: parseInt(dadosRetorno.numero_folhas_enfesto || 40),
          comprimento_enfesto_metros: parseFloat(dadosRetorno.comprimento_enfesto_metros || 4.2),
          aparas_retalhos_kg: parseFloat(dadosRetorno.aparas_retalhos_kg || 0),
          grade_cortada: {
            P: Number(dadosRetorno.grade_cortada.P) || 0,
            M: Number(dadosRetorno.grade_cortada.M) || 0,
            G: Number(dadosRetorno.grade_cortada.G) || 0,
            GG: Number(dadosRetorno.grade_cortada.GG) || 0,
            XGG: Number(dadosRetorno.grade_cortada.XGG) || 0
          },
          operador: dadosRetorno.operador || 'Cortador Interno'
        };

        await api.put(`/producao/camisetas/ordens/${dadosRetorno.id_op}/apontamento-corte`, payloadCorte);
      } else {
        // Rota legada
        await api.put(`/producao/ordens/${dadosRetorno.id_op}/retorno-corte`, {
          quantidade_pecas_cortadas: totalPecasRetornoCalculadas || parseInt(dadosRetorno.quantidade_pecas_cortadas)
        });
      }

      alert('Apontamento de corte registrado com sucesso! Peças geradas e prontas para a esteira.');
      setShowModalRetorno(false);
      carregarDados();
    } catch (err) {
      console.error('Erro ao registrar retorno do corte:', err);
      alert(err.response?.data?.detail || 'Erro ao registrar apontamento do corte.');
    }
  };

  const ordensFiltradas = ordens.filter(op => 
    op.codigo_op?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.status_op?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.cor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="camisetas-page-container">
      <Sidebar menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto} />

      <main className="camisetas-main">
        {/* Top Header */}
        <header className="top-header-enfesto">
          <div>
            <h1>Enfesto & Corte de Camisetas</h1>
            <p className="subtitle">
              Controle de camadas na mesa de corte, malha tubular e distribuição de grade (P, M, G, GG, XGG)
            </p>
          </div>
          <button className="btn-criar-op-enfesto" onClick={() => setShowModalCriarOP(true)}>
            <Plus size={18} />
            <span>Novo Enfesto de Corte</span>
          </button>
        </header>

        {/* Simulador Interativo de Enfesto (Grade P, M, G, GG, XGG) */}
        <section className="calculator-enfesto-card">
          <div className="calc-header">
            <div className="calc-title">
              <Calculator size={22} color="#38bdf8" />
              <h3>Simulador de Mesa & Rendimento de Enfesto de Camisetas</h3>
            </div>
            <span className="badge-enfesto">Matriz P / M / G / GG / XGG</span>
          </div>

          <div className="calc-grid">
            <div className="calc-input-box">
              <label>Comprimento do Risco (m)</label>
              <input 
                type="number" 
                step="0.1" 
                min="0.5"
                value={novoEnfesto.comprimento_enfesto_metros}
                onChange={(e) => setNovoEnfesto({ ...novoEnfesto, comprimento_enfesto_metros: e.target.value })}
              />
            </div>

            <div className="calc-input-box">
              <label>Camadas de Malha (Folhas)</label>
              <input 
                type="number" 
                min="1"
                value={novoEnfesto.numero_folhas_enfesto}
                onChange={(e) => setNovoEnfesto({ ...novoEnfesto, numero_folhas_enfesto: e.target.value })}
              />
            </div>

            <div className="calc-input-box">
              <label>Cor da Malha</label>
              <select 
                value={novoEnfesto.cor}
                onChange={(e) => setNovoEnfesto({ ...novoEnfesto, cor: e.target.value })}
              >
                <option value="Preto Reativo">Preto Reativo</option>
                <option value="Branco Alvejado">Branco Alvejado</option>
                <option value="Cinza Mescla">Cinza Mescla</option>
                <option value="Azul Marinho">Azul Marinho</option>
                <option value="Vermelho Escarlate">Vermelho Escarlate</option>
                <option value="Off-White">Off-White</option>
              </select>
            </div>

            <div className="calc-input-box">
              <label>Peso do Rolo / Malha (kg)</label>
              <input 
                type="number" 
                step="0.5" 
                min="0.1"
                value={novoEnfesto.peso_malha_enviado}
                onChange={(e) => setNovoEnfesto({ ...novoEnfesto, peso_malha_enviado: e.target.value })}
              />
            </div>
          </div>

          {/* Grade de Corte por Folha (P, M, G, GG, XGG) */}
          <div className="grade-distribuicao-container">
            <div className="grade-label">Grade de Moldes no Risco da Mesa (1 Camada)</div>
            <div className="grade-inputs-row">
              <div className="grade-item">
                <span className="grade-badge-title">Grade P</span>
                <input 
                  type="number" 
                  min="0"
                  value={novoEnfesto.grade_P}
                  onChange={(e) => setNovoEnfesto({ ...novoEnfesto, grade_P: e.target.value })}
                />
                <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                  = {(Number(novoEnfesto.grade_P) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs
                </small>
              </div>

              <div className="grade-item">
                <span className="grade-badge-title">Grade M</span>
                <input 
                  type="number" 
                  min="0"
                  value={novoEnfesto.grade_M}
                  onChange={(e) => setNovoEnfesto({ ...novoEnfesto, grade_M: e.target.value })}
                />
                <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                  = {(Number(novoEnfesto.grade_M) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs
                </small>
              </div>

              <div className="grade-item">
                <span className="grade-badge-title">Grade G</span>
                <input 
                  type="number" 
                  min="0"
                  value={novoEnfesto.grade_G}
                  onChange={(e) => setNovoEnfesto({ ...novoEnfesto, grade_G: e.target.value })}
                />
                <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                  = {(Number(novoEnfesto.grade_G) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs
                </small>
              </div>

              <div className="grade-item">
                <span className="grade-badge-title">Grade GG</span>
                <input 
                  type="number" 
                  min="0"
                  value={novoEnfesto.grade_GG}
                  onChange={(e) => setNovoEnfesto({ ...novoEnfesto, grade_GG: e.target.value })}
                />
                <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                  = {(Number(novoEnfesto.grade_GG) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs
                </small>
              </div>

              <div className="grade-item">
                <span className="grade-badge-title" style={{ color: '#a855f7' }}>Grade XGG</span>
                <input 
                  type="number" 
                  min="0"
                  value={novoEnfesto.grade_XGG}
                  onChange={(e) => setNovoEnfesto({ ...novoEnfesto, grade_XGG: e.target.value })}
                />
                <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                  = {(Number(novoEnfesto.grade_XGG) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs
                </small>
              </div>
            </div>
          </div>

          {/* Resumo ao Vivo dos Resultados */}
          <div className="enfesto-live-summary">
            <div className="summary-pill">
              <span>Moldes no Risco (1 Folha)</span>
              <strong>{totalMoldesPorFolha} camisetas / folha</strong>
            </div>

            <div className="summary-pill">
              <span>Produção Estimada do Corte</span>
              <strong className="highlight">{totalPecasPrevistas} camisetas</strong>
            </div>

            <div className="summary-pill">
              <span>Metragem Desenrolada</span>
              <strong>{totalMetrosTecido} metros</strong>
            </div>

            <div className="summary-pill">
              <span>Rendimento Previsto</span>
              <strong>{rendimentoEstimado} pçs / kg</strong>
            </div>
          </div>
        </section>

        {/* Action Bar e Tabela de OPs de Camisetas */}
        <section className="action-bar-enfesto">
          <div className="search-box-enfesto">
            <Search size={18} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Buscar por OP, cor ou status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-action-retorno" style={{ background: '#334155' }} onClick={carregarDados}>
            <RefreshCw size={14} />
            <span>Atualizar</span>
          </button>
        </section>

        <section className="table-card-enfesto">
          <table className="custom-table-enfesto">
            <thead>
              <tr>
                <th>Código OP</th>
                <th>Modelo</th>
                <th>Cor</th>
                <th>Grade de Camisetas (P/M/G/GG/XGG)</th>
                <th>Peso Malha</th>
                <th>Peças Cortadas</th>
                <th>Rendimento</th>
                <th>Status Atual</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>
                    Carregando ordens de corte...
                  </td>
                </tr>
              ) : ordensFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    Nenhuma ordem de corte registrada ainda. Clique em "Novo Enfesto de Corte".
                  </td>
                </tr>
              ) : (
                ordensFiltradas.map((op) => {
                  const grade = op.grade_cortada || op.grade_planejada;
                  return (
                    <tr key={op.id_op}>
                      <td><strong>{op.codigo_op}</strong></td>
                      <td>{produtos.find(p => p.id_produto === op.id_produto)?.nome_modelo || `Produto #${op.id_produto}`}</td>
                      <td>
                        <span style={{ fontWeight: '600', color: '#475569' }}>
                          {op.cor || 'Preto'}
                        </span>
                      </td>
                      <td>
                        {grade && typeof grade === 'object' ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <span className="badge-grade-inline">P: {grade.P || 0}</span>
                            <span className="badge-grade-inline">M: {grade.M || 0}</span>
                            <span className="badge-grade-inline">G: {grade.G || 0}</span>
                            <span className="badge-grade-inline">GG: {grade.GG || 0}</span>
                            <span className="badge-grade-inline" style={{ borderColor: '#a855f7', color: '#7e22ce' }}>XGG: {grade.XGG || 0}</span>
                          </div>
                        ) : (
                          <span className="badge-grade-inline">
                            {op.grade_corte || 'P/M/G/GG/XGG'}
                          </span>
                        )}
                      </td>
                      <td>{parseFloat(op.peso_malha_enviado || 0).toFixed(2)} kg</td>
                      <td>
                        {op.quantidade_pecas_cortadas ? (
                          <strong style={{ color: '#059669' }}>{op.quantidade_pecas_cortadas} pçs</strong>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Aguardando corte</span>
                        )}
                      </td>
                      <td>
                        {op.rendimento_real ? (
                          <span style={{ color: '#059669', fontWeight: 'bold' }}>
                            {op.rendimento_real} pçs/kg
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <span className={`badge-status-op ${op.status_op === 'Corte Finalizado' || op.status_op === 'BENEFICIAMENTO' || op.status_op === 'COSTURA' ? 'finalizado' : 'enviado'}`}>
                          {op.status_op}
                        </span>
                      </td>
                      <td>
                        {op.status_op === 'Enviado para Corte' || op.status_op === 'CRIADA' || op.status_op === 'ENFESTO_CORTE' ? (
                          <button 
                            className="btn-action-retorno" 
                            onClick={() => abrirModalRetorno(op)}
                          >
                            <Scissors size={14} />
                            <span>Apontar Corte</span>
                          </button>
                        ) : (
                          <button 
                            className="btn-action-retorno" 
                            style={{ background: '#2563eb' }}
                            onClick={() => navigate('/camisetas/costura')}
                          >
                            <ArrowRight size={14} />
                            <span>Avançar p/ Costura</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        {/* MODAL: CRIAR OP DE ENFESTO COM GRADE */}
        {showModalCriarOP && (
          <div className="modal-overlay">
            <div className="modal-box" style={{ maxWidth: '580px' }}>
              <div className="modal-header">
                <h2>Gerar Nova OP de Enfesto & Corte</h2>
                <button className="btn-close-modal" onClick={() => setShowModalCriarOP(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCriarOPEnfesto} className="modal-form">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group">
                    <label>Código do Lote / OP</label>
                    <input 
                      type="text" 
                      value={novoEnfesto.codigo_op}
                      onChange={(e) => setNovoEnfesto({ ...novoEnfesto, codigo_op: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Cor da Camiseta</label>
                    <select 
                      value={novoEnfesto.cor}
                      onChange={(e) => setNovoEnfesto({ ...novoEnfesto, cor: e.target.value })}
                      required
                    >
                      <option value="Preto Reativo">Preto Reativo</option>
                      <option value="Branco Alvejado">Branco Alvejado</option>
                      <option value="Cinza Mescla">Cinza Mescla</option>
                      <option value="Azul Marinho">Azul Marinho</option>
                      <option value="Vermelho Escarlate">Vermelho Escarlate</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label>Modelo Base de Camiseta (Ficha Técnica)</label>
                  <select 
                    value={novoEnfesto.id_produto}
                    onChange={(e) => setNovoEnfesto({ ...novoEnfesto, id_produto: e.target.value })}
                    required
                  >
                    <option value="">Selecione o modelo...</option>
                    {produtos.map(p => (
                      <option key={p.id_produto} value={p.id_produto}>
                        {p.nome_modelo}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group">
                    <label>Camadas no Enfesto (Folhas)</label>
                    <input 
                      type="number" 
                      value={novoEnfesto.numero_folhas_enfesto}
                      onChange={(e) => setNovoEnfesto({ ...novoEnfesto, numero_folhas_enfesto: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Peso do Rolo / Malha (kg)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={novoEnfesto.peso_malha_enviado}
                      onChange={(e) => setNovoEnfesto({ ...novoEnfesto, peso_malha_enviado: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Grade Resumida Prevista */}
                <div className="input-group">
                  <label>Grade Planejada (Moldes $\times$ Folhas)</label>
                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span><strong>P:</strong> {(Number(novoEnfesto.grade_P) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs</span>
                      <span><strong>M:</strong> {(Number(novoEnfesto.grade_M) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs</span>
                      <span><strong>G:</strong> {(Number(novoEnfesto.grade_G) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs</span>
                      <span><strong>GG:</strong> {(Number(novoEnfesto.grade_GG) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs</span>
                      <span><strong>XGG:</strong> {(Number(novoEnfesto.grade_XGG) || 0) * (Number(novoEnfesto.numero_folhas_enfesto) || 0)} pçs</span>
                    </div>
                    <div style={{ color: '#059669', fontWeight: 'bold' }}>
                      Total Previsto no Lote: {totalPecasPrevistas} camisetas ({rendimentoEstimado} pçs/kg)
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-cancelar" onClick={() => setShowModalCriarOP(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-confirmar">
                    Confirmar e Enviar para Mesa de Corte
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: APONTAMENTO DIRETO DE GRADE CORTADA (P, M, G, GG, XGG) */}
        {showModalRetorno && (
          <div className="modal-overlay">
            <div className="modal-box" style={{ maxWidth: '640px' }}>
              <div className="modal-header">
                <div>
                  <h2>Apontamento Real de Corte - {dadosRetorno.codigo_op_exibicao}</h2>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    Aponte as peças reais cortadas por tamanho para cálculo de rendimento e controle de retalhos
                  </p>
                </div>
                <button className="btn-close-modal" onClick={() => setShowModalRetorno(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleRegistrarRetorno} className="modal-form">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group">
                    <label>Peso Real da Malha Gasta (kg)</label>
                    <input 
                      type="number" 
                      step="0.05"
                      value={dadosRetorno.peso_malha_real_kg}
                      onChange={(e) => setDadosRetorno({ ...dadosRetorno, peso_malha_real_kg: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Aparas e Retalhos de Mesa (kg)</label>
                    <input 
                      type="number" 
                      step="0.05"
                      value={dadosRetorno.aparas_retalhos_kg}
                      onChange={(e) => setDadosRetorno({ ...dadosRetorno, aparas_retalhos_kg: e.target.value })}
                    />
                  </div>
                </div>

                {/* Grade Real Cortada */}
                <div className="input-group">
                  <label style={{ fontWeight: '700', color: '#0f172a' }}>
                    Peças Efetivamente Cortadas por Tamanho (Grade Real)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginTop: '6px' }}>
                    {['P', 'M', 'G', 'GG', 'XGG'].map(tam => (
                      <div key={tam} style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: tam === 'XGG' ? '#a855f7' : '#0284c7' }}>
                          Tam {tam}
                        </span>
                        <input 
                          type="number"
                          min="0"
                          style={{
                            width: '100%',
                            textAlign: 'center',
                            fontSize: '15px',
                            fontWeight: '700',
                            marginTop: '4px',
                            padding: '6px',
                            border: '1px solid #94a3b8',
                            borderRadius: '6px'
                          }}
                          value={dadosRetorno.grade_cortada?.[tam] ?? 0}
                          onChange={(e) => setDadosRetorno({
                            ...dadosRetorno,
                            grade_cortada: {
                              ...dadosRetorno.grade_cortada,
                              [tam]: parseInt(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label>Operador / Cortador Responsável</label>
                  <input 
                    type="text" 
                    value={dadosRetorno.operador}
                    onChange={(e) => setDadosRetorno({ ...dadosRetorno, operador: e.target.value })}
                    required
                  />
                </div>

                {/* Resumo da Eficiência em Tempo Real */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#166534', fontWeight: '600' }}>
                      Total de Peças Cortadas: <strong>{totalPecasRetornoCalculadas} camisetas</strong>
                    </span>
                    <span style={{ fontSize: '14px', color: '#15803d', fontWeight: '800' }}>
                      Rendimento Real: {rendimentoRealCalculado} pçs / kg
                    </span>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-cancelar" onClick={() => setShowModalRetorno(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-confirmar">
                    Salvar Apontamento e Liberar para Costura
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default EnfestoCorteCamisetas;
