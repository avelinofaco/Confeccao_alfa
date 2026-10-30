import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Scissors, 
  Layers, 
  Plus, 
  Search, 
  CheckCircle, 
  Activity, 
  X, 
  ArrowRight,
  Shirt,
  Sparkles,
  GitBranch,
  AlertTriangle,
  RefreshCw,
  PackageCheck
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './CosturaCamisetas.css';

function CosturaCamisetas() {
  const navigate = useNavigate();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [opsDisponiveis, setOpsDisponiveis] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [showModalEnvio, setShowModalEnvio] = useState(false);
  const [showModalRetorno, setShowModalRetorno] = useState(false);

  const [novoEnvio, setNovoEnvio] = useState({
    id_op: '',
    destino_costura: 'Linha 1 - Célula de Camisetas',
    etapa_costura: 'Linha Sequencial Completa (1 a 5)',
    tipo_responsavel: 'INTERNO',
    nome_prestador: 'Célula 1 Interna',
    margem_seguranca_insumos: 0
  });

  // Estado do Apontamento Real de Costura com Grade P, M, G, GG, XGG e Rastreabilidade de Refugos
  const [dadosRetorno, setDadosRetorno] = useState({
    id_movimentacao: null,
    id_op: null,
    is_op_estruturada: false,
    codigo_op_exibicao: '',
    destino_costura: '',
    operador: 'Costureira Responsável',
    motivo_refugo: 'Nenhum refugo (100% aprovado)',
    observacoes: '',
    grade_aprovada: {
      P: 0,
      M: 0,
      G: 0,
      GG: 0,
      XGG: 0
    },
    grade_refugo: {
      P: 0,
      M: 0,
      G: 0,
      GG: 0,
      XGG: 0
    },
    quantidade_recebida: 0
  });

  // Cálculos em tempo real de aprovados e refugos na costura
  const totalAprovadoCalculado = 
    (Number(dadosRetorno.grade_aprovada?.P) || 0) +
    (Number(dadosRetorno.grade_aprovada?.M) || 0) +
    (Number(dadosRetorno.grade_aprovada?.G) || 0) +
    (Number(dadosRetorno.grade_aprovada?.GG) || 0) +
    (Number(dadosRetorno.grade_aprovada?.XGG) || 0);

  const totalRefugoCalculado = 
    (Number(dadosRetorno.grade_refugo?.P) || 0) +
    (Number(dadosRetorno.grade_refugo?.M) || 0) +
    (Number(dadosRetorno.grade_refugo?.G) || 0) +
    (Number(dadosRetorno.grade_refugo?.GG) || 0) +
    (Number(dadosRetorno.grade_refugo?.XGG) || 0);

  const totalGeralRetorno = totalAprovadoCalculado + totalRefugoCalculado;
  const taxaAproveitamento = totalGeralRetorno > 0
    ? ((totalAprovadoCalculado / totalGeralRetorno) * 100).toFixed(1)
    : '100.0';

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resMov, resOpsCamisetas, resOpsGerais, resProdutos] = await Promise.all([
        api.get('/costura/movimentacoes').catch(() => ({ data: [] })),
        api.get('/producao/camisetas/ordens').catch(() => ({ data: [] })),
        api.get('/producao/ordens').catch(() => ({ data: [] })),
        api.get('/produtos/').catch(() => ({ data: [] }))
      ]);

      setMovimentacoes(resMov.data || []);
      setProdutos(resProdutos.data || []);

      // OPs prontas para costura (com corte finalizado)
      const opsCam = (resOpsCamisetas.data || [])
        .filter(op => op.status_op === 'BENEFICIAMENTO' || op.status_op === 'COSTURA' || op.total_cortado > 0)
        .map(op => ({
          ...op,
          is_estruturada: true,
          quantidade_pecas_cortadas: op.total_cortado || op.total_planejado
        }));

      const opsGer = (resOpsGerais.data || [])
        .filter(op => op.status_op === 'Corte Finalizado')
        .map(op => ({
          ...op,
          is_estruturada: false
        }));

      setOpsDisponiveis([...opsCam, ...opsGer]);
    } catch (err) {
      console.error('Erro ao carregar dados da costura de camisetas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) navigate('/');
    else carregarDados();
  }, [navigate]);

  const handleEnviarCostura = async (e) => {
    e.preventDefault();
    if (!novoEnvio.id_op) {
      alert('Selecione uma OP com corte finalizado.');
      return;
    }

    const opSelecionada = opsDisponiveis.find(o => String(o.id_op) === String(novoEnvio.id_op));

    try {
      if (opSelecionada?.is_estruturada) {
        // Envia para o fluxo de camisetas
        const gradeCortada = opSelecionada.grade_cortada || opSelecionada.grade_planejada || { P: 0, M: 0, G: 0, GG: 0, XGG: 0 };
        
        // Transiciona do beneficiamento/corte direto para costura se necessário
        if (opSelecionada.status_op === 'BENEFICIAMENTO') {
          await api.put(`/producao/camisetas/ordens/${opSelecionada.id_op}/apontamento-beneficiamento`, {
            tipo_responsavel: novoEnvio.tipo_responsavel,
            nome_prestador: novoEnvio.nome_prestador,
            grade_aprovada: gradeCortada,
            grade_refugo: { P: 0, M: 0, G: 0, GG: 0, XGG: 0 },
            operador: 'Controle de Produção',
            observacoes: 'Avançado direto para Costura'
          });
        }
      }

      // Registra a movimentação de costura
      const payloadMov = {
        id_op: parseInt(novoEnvio.id_op),
        destino_costura: `${novoEnvio.destino_costura} (${novoEnvio.etapa_costura})`,
        margem_seguranca_insumos: parseFloat(novoEnvio.margem_seguranca_insumos || 0),
        etapa_costura: novoEnvio.etapa_costura
      };

      await api.post('/costura/envios', payloadMov);

      alert('Lote de Camisetas enviado para a Linha de Costura com sucesso!');
      setShowModalEnvio(false);
      setNovoEnvio({
        id_op: '',
        destino_costura: 'Linha 1 - Célula de Camisetas',
        etapa_costura: 'Linha Sequencial Completa (1 a 5)',
        tipo_responsavel: 'INTERNO',
        nome_prestador: 'Célula 1 Interna',
        margem_seguranca_insumos: 0
      });
      carregarDados();
    } catch (err) {
      console.error('Erro ao enviar para costura:', err);
      alert(err.response?.data?.detail || 'Erro ao enviar para linha de costura.');
    }
  };

  const abrirModalRetorno = (mov) => {
    // Tenta encontrar a OP vinculada
    const opVinculada = opsDisponiveis.find(o => o.id_op === mov.id_op);
    const isEstruturada = opVinculada?.is_estruturada || false;

    let gradeBase = { P: 0, M: 0, G: 0, GG: 0, XGG: 0 };
    if (opVinculada?.grade_cortada) {
      gradeBase = { ...opVinculada.grade_cortada };
    } else if (mov.quantidade_enviada) {
      const parte = Math.floor(mov.quantidade_enviada / 5);
      gradeBase = { P: parte, M: parte, G: parte, GG: parte, XGG: mov.quantidade_enviada - (parte * 4) };
    }

    setDadosRetorno({
      id_movimentacao: mov.id_movimentacao,
      id_op: mov.id_op,
      is_op_estruturada: isEstruturada,
      codigo_op_exibicao: opVinculada?.codigo_op || `OP #${mov.id_op}`,
      destino_costura: mov.destino_costura,
      operador: 'Costureira Célula 1',
      motivo_refugo: 'Nenhum refugo (100% aprovado)',
      observacoes: '',
      grade_aprovada: gradeBase,
      grade_refugo: { P: 0, M: 0, G: 0, GG: 0, XGG: 0 },
      quantidade_recebida: mov.quantidade_enviada
    });
    setShowModalRetorno(true);
  };

  const handleRegistrarRetorno = async (e) => {
    e.preventDefault();
    try {
      if (dadosRetorno.is_op_estruturada) {
        // Envia apontamento formal de costura para a OP de camisetas
        const payloadApontamento = {
          tipo_responsavel: 'INTERNO',
          nome_prestador: dadosRetorno.destino_costura,
          grade_aprovada: dadosRetorno.grade_aprovada,
          grade_refugo: dadosRetorno.grade_refugo,
          motivo_refugo: totalRefugoCalculado > 0 ? dadosRetorno.motivo_refugo : null,
          operador: dadosRetorno.operador,
          observacoes: dadosRetorno.observacoes
        };

        await api.put(`/producao/camisetas/ordens/${dadosRetorno.id_op}/apontamento-costura`, payloadApontamento);

        // Avança também o acabamento para alimentar o estoque de produto pronto por SKU
        await api.put(`/producao/camisetas/ordens/${dadosRetorno.id_op}/apontamento-acabamento`, {
          tipo_responsavel: 'INTERNO',
          nome_prestador: 'Setor de Embalagem e Dobra',
          grade_aprovada: dadosRetorno.grade_aprovada,
          grade_refugo: { P: 0, M: 0, G: 0, GG: 0, XGG: 0 },
          grade_segunda: { P: 0, M: 0, G: 0, GG: 0, XGG: 0 },
          operador: dadosRetorno.operador
        });
      }

      // Atualiza também a tabela de movimentação de costura
      await api.put(`/costura/retorno/${dadosRetorno.id_movimentacao}`, {
        quantidade_recebida: totalAprovadoCalculado || parseInt(dadosRetorno.quantidade_recebida)
      });

      alert('Lote de Costura finalizado com sucesso! Peças aprovadas integradas ao Estoque Pronto.');
      setShowModalRetorno(false);
      carregarDados();
    } catch (err) {
      console.error('Erro ao registrar retorno da costura:', err);
      alert(err.response?.data?.detail || 'Erro ao registrar retorno de costura.');
    }
  };

  const movimentacoesFiltradas = movimentacoes.filter(m => 
    m.destino_costura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.status_movimentacao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="costura-camisetas-container">
      <Sidebar menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto} />

      <main className="costura-main">
        {/* Header */}
        <header className="top-header-costura">
          <div>
            <h1>Linha Linear de Costura de Camisetas</h1>
            <p className="subtitle">
              Montagem sequencial, controle de células produtivas e apontamento de grade (P, M, G, GG, XGG)
            </p>
          </div>
          <button className="btn-novo-lote-costura" onClick={() => setShowModalEnvio(true)}>
            <Plus size={18} />
            <span>Alimentar Linha de Costura</span>
          </button>
        </header>

        {/* Pipeline Linear das 5 Etapas de Camisetas */}
        <section className="pipeline-flow-card">
          <div className="pipeline-title-group">
            <div className="pipeline-title">
              <GitBranch size={20} color="#2563eb" />
              <span>Etapas Sequenciais de Montagem de Camiseta</span>
            </div>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Fluxo contínuo com rastreabilidade de refugo</span>
          </div>

          <div className="pipeline-stages-grid">
            <div className="stage-step-card">
              <div className="stage-number">1</div>
              <h4>Unir Ombros</h4>
              <span className="stage-machine">Overlock 4 Fios</span>
              <p className="stage-desc">União ombro a ombro frente/costas com inserção da fita de reforço.</p>
            </div>

            <div className="stage-step-card">
              <div className="stage-number">2</div>
              <h4>Pregar Gola Ribana</h4>
              <span className="stage-machine">Galoneira / Pesponto</span>
              <p className="stage-desc">Encaixe do anel de ribana 1x1 no decote com pesponto de segurança.</p>
            </div>

            <div className="stage-step-card">
              <div className="stage-number">3</div>
              <h4>Pregar Mangas</h4>
              <span className="stage-machine">Overlock 4 Fios</span>
              <p className="stage-desc">Fixação simétrica das mangas com o corpo ainda aberto nas laterais.</p>
            </div>

            <div className="stage-step-card">
              <div className="stage-number">4</div>
              <h4>Fechar Laterais</h4>
              <span className="stage-machine">Overlock</span>
              <p className="stage-desc">Fechamento único da barra inferior até a ponta da manga.</p>
            </div>

            <div className="stage-step-card">
              <div className="stage-number">5</div>
              <h4>Barras & Revisão</h4>
              <span className="stage-machine">Galoneira 3 Agulhas</span>
              <p className="stage-desc">Bainhas duplas na barra e mangas. Entrada automatizada no estoque.</p>
            </div>
          </div>
        </section>

        {/* Tabela de Lotes em Produção */}
        <section className="action-bar-enfesto">
          <div className="search-box-enfesto">
            <Search size={18} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Buscar por célula, facção ou status..."
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
                <th>OP Vinculada</th>
                <th>Célula / Posto de Trabalho</th>
                <th>Etapa Produtiva</th>
                <th>Qtd Enviada</th>
                <th>Qtd Aprovada</th>
                <th>Perdas / Refugo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                    Carregando movimentações de costura...
                  </td>
                </tr>
              ) : movimentacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    Nenhum lote enviado para a linha de costura ainda. Clique em "Alimentar Linha de Costura".
                  </td>
                </tr>
              ) : (
                movimentacoesFiltradas.map((mov) => (
                  <tr key={mov.id_movimentacao}>
                    <td><strong>OP #{mov.id_op}</strong></td>
                    <td>{mov.destino_costura}</td>
                    <td>
                      <span className="badge-etapa">
                        {mov.etapa_costura || 'Linha Sequencial Completa'}
                      </span>
                    </td>
                    <td><strong>{mov.quantidade_enviada} pçs</strong></td>
                    <td>
                      {mov.quantidade_recebida !== null ? (
                        <span style={{ color: '#059669', fontWeight: 'bold' }}>
                          {mov.quantidade_recebida} pçs
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Em montagem</span>
                      )}
                    </td>
                    <td>
                      {mov.perda_pecas !== null ? (
                        <span style={{ color: mov.perda_pecas > 0 ? '#ef4444' : '#64748b', fontWeight: '600' }}>
                          {mov.perda_pecas} pçs
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`badge-status-op ${mov.status_movimentacao === 'Retornado' ? 'finalizado' : 'enviado'}`}>
                        {mov.status_movimentacao === 'Retornado' ? 'Concluído' : 'Em Montagem'}
                      </span>
                    </td>
                    <td>
                      {mov.status_movimentacao === 'Enviado' && (
                        <button 
                          className="btn-action-retorno"
                          onClick={() => abrirModalRetorno(mov)}
                        >
                          <CheckCircle size={14} />
                          <span>Apontar Conclusão</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* MODAL: ENVIAR LOTE PARA LINHA DE COSTURA */}
        {showModalEnvio && (
          <div className="modal-overlay">
            <div className="modal-box" style={{ maxWidth: '580px' }}>
              <div className="modal-header">
                <h2>Alimentar Linha de Costura de Camisetas</h2>
                <button className="btn-close-modal" onClick={() => setShowModalEnvio(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEnviarCostura} className="modal-form">
                <div className="input-group">
                  <label>Ordem de Produção (com corte finalizado)</label>
                  <select 
                    value={novoEnvio.id_op}
                    onChange={(e) => setNovoEnvio({ ...novoEnvio, id_op: e.target.value })}
                    required
                  >
                    <option value="">Selecione a OP cortada...</option>
                    {opsDisponiveis.map(op => {
                      const grade = op.grade_cortada || op.grade_planejada;
                      const gradeStr = grade && typeof grade === 'object'
                        ? `(P:${grade.P || 0} M:${grade.M || 0} G:${grade.G || 0} GG:${grade.GG || 0} XGG:${grade.XGG || 0})`
                        : '';
                      return (
                        <option key={op.id_op} value={op.id_op}>
                          {op.codigo_op} — {op.quantidade_pecas_cortadas} camisetas {gradeStr}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="input-group">
                  <label>Etapa de Costura</label>
                  <select 
                    value={novoEnvio.etapa_costura}
                    onChange={(e) => setNovoEnvio({ ...novoEnvio, etapa_costura: e.target.value })}
                    required
                  >
                    <option value="Linha Sequencial Completa (1 a 5)">Linha Sequencial Completa (1 a 5)</option>
                    <option value="Etapa 1: Unir Ombros + Reforço">Etapa 1: Unir Ombros + Reforço</option>
                    <option value="Etapa 2: Pregar Gola Ribana">Etapa 2: Pregar Gola Ribana</option>
                    <option value="Etapa 3: Pregar Mangas">Etapa 3: Pregar Mangas</option>
                    <option value="Etapa 4: Fechar Laterais">Etapa 4: Fechar Laterais</option>
                    <option value="Etapa 5: Barras Galoneira">Etapa 5: Barras Galoneira</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group">
                    <label>Tipo de Mão de Obra</label>
                    <select 
                      value={novoEnvio.tipo_responsavel}
                      onChange={(e) => setNovoEnvio({ ...novoEnvio, tipo_responsavel: e.target.value })}
                    >
                      <option value="INTERNO">Célula Interna</option>
                      <option value="TERCEIRO_FACCAO">Facção Terceirizada</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Nome do Posto / Facção</label>
                    <input 
                      type="text" 
                      value={novoEnvio.destino_costura}
                      onChange={(e) => setNovoEnvio({ ...novoEnvio, destino_costura: e.target.value })}
                      placeholder="Ex: Célula A - Costureira Joana"
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-cancelar" onClick={() => setShowModalEnvio(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-confirmar">
                    Iniciar Montagem na Linha
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: APONTAMENTO DIRETO DE GRADE APROVADA & REFUGOS POR TAMANHO */}
        {showModalRetorno && (
          <div className="modal-overlay">
            <div className="modal-box" style={{ maxWidth: '660px' }}>
              <div className="modal-header">
                <div>
                  <h2>Apontamento de Costura & Qualidade - {dadosRetorno.codigo_op_exibicao}</h2>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    {dadosRetorno.destino_costura}
                  </p>
                </div>
                <button className="btn-close-modal" onClick={() => setShowModalRetorno(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleRegistrarRetorno} className="modal-form">
                {/* 1. Grade de Peças Aprovadas */}
                <div className="input-group">
                  <label style={{ color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> Peças 100% Aprovadas por Tamanho (Entrada no Estoque)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginTop: '6px' }}>
                    {['P', 'M', 'G', 'GG', 'XGG'].map(tam => (
                      <div key={tam} style={{ background: '#f0fdf4', padding: '8px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#166534' }}>
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
                            border: '1px solid #86efac',
                            borderRadius: '6px'
                          }}
                          value={dadosRetorno.grade_aprovada?.[tam] ?? 0}
                          onChange={(e) => setDadosRetorno({
                            ...dadosRetorno,
                            grade_aprovada: {
                              ...dadosRetorno.grade_aprovada,
                              [tam]: parseInt(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Grade de Refugos / Perdas por Tamanho */}
                <div className="input-group">
                  <label style={{ color: '#dc2626', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} /> Peças com Defeito / Refugadas (Sucata de Costura)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginTop: '6px' }}>
                    {['P', 'M', 'G', 'GG', 'XGG'].map(tam => (
                      <div key={tam} style={{ background: '#fef2f2', padding: '8px', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#991b1b' }}>
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
                            border: '1px solid #fca5a5',
                            borderRadius: '6px'
                          }}
                          value={dadosRetorno.grade_refugo?.[tam] ?? 0}
                          onChange={(e) => setDadosRetorno({
                            ...dadosRetorno,
                            grade_refugo: {
                              ...dadosRetorno.grade_refugo,
                              [tam]: parseInt(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Motivo da Falha se houver refugo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group">
                    <label>Motivo do Refugo / Perda Têxtil</label>
                    <select 
                      value={dadosRetorno.motivo_refugo}
                      onChange={(e) => setDadosRetorno({ ...dadosRetorno, motivo_refugo: e.target.value })}
                    >
                      <option value="Nenhum refugo (100% aprovado)">Nenhum refugo (100% aprovado)</option>
                      <option value="Furo de agulha na gola ribana">Furo de agulha na gola ribana</option>
                      <option value="Corte de faca do overloque no corpo">Corte de faca do overloque no corpo</option>
                      <option value="Ponto pulado / costura torta">Ponto pulado / costura torta</option>
                      <option value="Mancha de óleo da máquina de costura">Mancha de óleo da máquina de costura</option>
                      <option value="Assimetria nas cavas da manga">Assimetria nas cavas da manga</option>
                      <option value="Defeito na trama da malha (furo/fiada)">Defeito na trama da malha (furo/fiada)</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Operador / Revisor da Linha</label>
                    <input 
                      type="text" 
                      value={dadosRetorno.operador}
                      onChange={(e) => setDadosRetorno({ ...dadosRetorno, operador: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Feedback em tempo real */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#166534', fontWeight: '700' }}>
                      Aprovadas: {totalAprovadoCalculado} camisetas
                    </span>
                    <span style={{ fontSize: '13px', color: totalRefugoCalculado > 0 ? '#b91c1c' : '#64748b', fontWeight: '700' }}>
                      Refugos: {totalRefugoCalculado} pçs
                    </span>
                    <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: '800' }}>
                      Aproveitamento: {taxaAproveitamento}%
                    </span>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-cancelar" onClick={() => setShowModalRetorno(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-confirmar">
                    Confirmar Apontamento e Entrada no Estoque
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

export default CosturaCamisetas;
