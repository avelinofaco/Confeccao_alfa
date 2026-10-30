import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Scissors, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  TrendingUp, 
  X,
  Scale,
  Shirt
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './CorteRendimentoCamisetas.css';

function CorteRendimentoCamisetas() {
  const [modelos, setModelos] = useState([]);
  const [tecidos, setTecidos] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Fecha o toast automaticamente após 5 segundos
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modal para registrar o corte realizado
  const [modalFinalizarAberto, setModalFinalizarAberto] = useState(false);
  const [opSelecionada, setOpSelecionada] = useState(null);
  const [pecasReais, setPecasReais] = useState('');

  // Formulário Nova OP
  const [formOp, setFormOp] = useState({
    id_modelo: '',
    id_insumo_tecido: '',
    peso_malha_enviado_kg: ''
  });

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resModelos, resInsumos, resOps] = await Promise.all([
        api.get('/camisetas/modelos/').catch(() => ({ data: [] })),
        api.get('/camisetas/insumos/?categoria=ROLO_TECIDO').catch(() => ({ data: [] })),
        api.get('/camisetas/ordens/').catch(() => ({ data: [] }))
      ]);

      const listaMods = resModelos.data || [];
      const listaTecs = resInsumos.data || [];
      setModelos(listaMods);
      setTecidos(listaTecs);
      setOrdens(resOps.data || []);

      if (listaMods.length > 0 && !formOp.id_modelo) {
        setFormOp(prev => ({ ...prev, id_modelo: listaMods[0].id_modelo }));
      }
      if (listaTecs.length > 0 && !formOp.id_insumo_tecido) {
        setFormOp(prev => ({ ...prev, id_insumo_tecido: listaTecs[0].id_insumo }));
      }
    } catch (err) {
      console.error("Erro ao carregar dados de corte:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Dados do rolo de tecido selecionado e validação de estoque
  const tecidoSelecionado = tecidos.find(t => String(t.id_insumo) === String(formOp.id_insumo_tecido));
  const saldoDisponivel = parseFloat(tecidoSelecionado?.saldo_atual || 0);
  const pesoSolicitado = parseFloat(formOp.peso_malha_enviado_kg || 0);
  const pesoExcedeEstoque = Boolean(
    formOp.id_insumo_tecido && 
    formOp.peso_malha_enviado_kg && 
    pesoSolicitado > saldoDisponivel
  );

  const handleCriarOp = async (e) => {
    e.preventDefault();
    if (!formOp.id_modelo || !formOp.peso_malha_enviado_kg) {
      setToast({
        tipo: 'aviso',
        texto: 'Por favor, selecione o modelo e informe o peso de malha enviado para a mesa.'
      });
      return;
    }

    if (pesoSolicitado <= 0) {
      setToast({
        tipo: 'aviso',
        texto: 'O peso de malha enviado deve ser superior a zero.'
      });
      return;
    }

    // Regra estrita: impedir envio se o peso for maior do que tem em estoque
    if (pesoExcedeEstoque) {
      setToast({
        tipo: 'erro',
        texto: `Operação bloqueada: Estoque de malha insuficiente! O rolo selecionado possui saldo de ${saldoDisponivel.toFixed(3)} kg, mas você tentou enviar ${pesoSolicitado.toFixed(3)} kg para a mesa.`
      });
      return;
    }

    try {
      const proximoNumero = ordens.length > 0 
        ? Math.max(...ordens.map(o => {
            const m = o.codigo_op?.match(/\d+/);
            return m ? parseInt(m[0], 10) : 100;
          })) + 1
        : 101;
      const codigoGerado = `OP-CAM-${proximoNumero}`;

      await api.post('/camisetas/ordens/', {
        codigo_op: codigoGerado,
        id_modelo: parseInt(formOp.id_modelo),
        id_insumo_tecido: formOp.id_insumo_tecido ? parseInt(formOp.id_insumo_tecido) : null,
        peso_malha_enviado_kg: parseFloat(formOp.peso_malha_enviado_kg)
      });

      setToast({
        tipo: 'sucesso',
        texto: `Ordem de Produção ${codigoGerado} aberta com sucesso! Baixa de ${pesoSolicitado.toFixed(3)} kg realizada no estoque de malha.`
      });

      setFormOp({
        id_modelo: modelos.length > 0 ? modelos[0].id_modelo : '',
        id_insumo_tecido: tecidos.length > 0 ? tecidos[0].id_insumo : '',
        peso_malha_enviado_kg: ''
      });
      carregarDados();
    } catch (err) {
      console.error("Erro ao abrir OP:", err);
      setToast({
        tipo: 'erro',
        texto: err.response?.data?.detail || "Erro ao abrir OP de corte."
      });
    }
  };

  const abrirModalFinalizar = (op) => {
    setOpSelecionada(op);
    setPecasReais(op.pecas_planejadas || '');
    setModalFinalizarAberto(true);
  };

  const handleFinalizarCorte = async (e) => {
    e.preventDefault();
    if (!opSelecionada || !pecasReais) return;

    try {
      await api.put(`/camisetas/ordens/${opSelecionada.id_op}/finalizar-corte`, {
        pecas_reais_cortadas: parseInt(pecasReais)
      });

      setToast({
        tipo: 'sucesso',
        texto: `Corte da OP ${opSelecionada.codigo_op} registrado com sucesso! Rendimento real calculado instantaneamente.`
      });
      setModalFinalizarAberto(false);
      setOpSelecionada(null);
      carregarDados();
    } catch (err) {
      console.error("Erro ao finalizar corte:", err);
      setToast({
        tipo: 'erro',
        texto: err.response?.data?.detail || "Erro ao registrar corte."
      });
    }
  };

  // Normalização visual dos status industriais (remove status longo de facção de teste)
  const formatarStatusOp = (op) => {
    if (!op.pecas_reais_cortadas) return 'Aguardando Corte';
    const s = op.status_op || '';
    if (s.includes('Costura Finalizada')) return 'Costura Finalizada';
    if (s.includes('Facção') || s.includes('Costura') || s.includes('Envio Parcial') || s.includes('Oficina')) {
      return 'Em Costura';
    }
    return s || 'Corte Finalizado';
  };

  // Métricas do Topo
  const totalKgCortados = ordens.reduce((acc, o) => acc + parseFloat(o.peso_malha_enviado_kg || 0), 0);
  const totalPecasCortadas = ordens.reduce((acc, o) => acc + (o.pecas_reais_cortadas || 0), 0);
  const mediaRendimento = totalKgCortados > 0 ? (totalPecasCortadas / totalKgCortados).toFixed(2) : '5.60';

  return (
    <div className="corte-camisetas-container">
      <Sidebar />

      <main className="corte-camisetas-main">
        {/* Toast Notificação Integrada (Sem alertas de navegador) */}
        {toast && (
          <div className={`toast-alerta-flutuante ${toast.tipo}`} role="alert" aria-live="assertive">
            <span>{toast.texto}</span>
            <button 
              type="button" 
              onClick={() => setToast(null)} 
              className="toast-btn-fechar"
              aria-label="Fechar notificação"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <header className="corte-header">
          <h1>
            <Layers size={28} color="#2563eb" />
            5. Tela de Corte e Rendimento (Planejamento e Controle - PCP)
          </h1>
          <p>
            Gerencie as Ordens de Produção (OPs) e meça a eficiência do aproveitamento da malha na mesa de corte:
            baixa automática de rolos no estoque e apuração instantânea do Rendimento Real (peças / kg).
          </p>
        </header>

        {/* INDICADORES RÁPIDOS */}
        <section className="metricas-corte-bar">
          <div className="metrica-corte-card">
            <span>Total Malha Enfesta/Cortada</span>
            <h3>{totalKgCortados.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} kg</h3>
          </div>

          <div className="metrica-corte-card">
            <span>Peças Reais Cortadas</span>
            <h3 style={{ color: '#2563eb' }}>{totalPecasCortadas.toLocaleString('pt-BR')} un.</h3>
          </div>

          <div className="metrica-corte-card">
            <span>Rendimento Médio Global</span>
            <h3 style={{ color: '#059669' }}>{mediaRendimento} peças / kg</h3>
          </div>
        </section>

        {/* PASSO A PASSO 1: ABERTURA DE NOVA OP */}
        <div className="form-op-card">
          <h2>
            <PlusCircle size={20} color="#2563eb" />
            Passo 1: Abertura de Nova OP & Envio de Malha para a Mesa
          </h2>

          <div className="baixa-aviso-box">
            <AlertCircle size={18} />
            <span>
              Ao confirmar a abertura da OP, o sistema realiza a <strong>explosão e baixa automática</strong> do peso informado no estoque do rolo de tecido selecionado.
            </span>
          </div>

          <form onSubmit={handleCriarOp}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: '1.2rem' }}>

              <div className="form-group">
                <label>Modelo de Camiseta *</label>
                <select 
                  value={formOp.id_modelo}
                  onChange={(e) => setFormOp({ ...formOp, id_modelo: e.target.value })}
                  required
                >
                  <option value="">Selecione o modelo...</option>
                  {modelos.map(m => (
                    <option key={m.id_modelo} value={m.id_modelo}>
                      {m.nome_modelo} ({m.consumo_tecido_kg} kg/peça)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Rolo de Tecido / Malha a Baixar *</label>
                <select 
                  value={formOp.id_insumo_tecido}
                  onChange={(e) => setFormOp({ ...formOp, id_insumo_tecido: e.target.value })}
                  required
                >
                  <option value="">Selecione a malha...</option>
                  {tecidos.map(t => (
                    <option key={t.id_insumo} value={t.id_insumo}>
                      [{t.codigo}] {t.tipo_malha_ou_aviamento} ({t.cor}) - Saldo: {parseFloat(t.saldo_atual || 0).toFixed(3)} kg
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Peso Total de Malha Enviado (kg) *</label>
                <input 
                  type="number" 
                  step="0.001"
                  min="0.001"
                  placeholder="Ex: 45.000"
                  value={formOp.peso_malha_enviado_kg}
                  onChange={(e) => setFormOp({ ...formOp, peso_malha_enviado_kg: e.target.value })}
                  required
                  style={{
                    borderColor: pesoExcedeEstoque ? '#ef4444' : undefined,
                    backgroundColor: pesoExcedeEstoque ? '#fef2f2' : undefined
                  }}
                />
                {tecidoSelecionado && (
                  <small style={{ 
                    marginTop: '0.35rem', 
                    fontSize: '0.78rem',
                    color: pesoExcedeEstoque ? '#dc2626' : '#64748b',
                    fontWeight: pesoExcedeEstoque ? 700 : 500
                  }}>
                    Saldo disponível no rolo: <strong>{saldoDisponivel.toFixed(3)} kg</strong>
                    {pesoExcedeEstoque && (
                      <span style={{ display: 'block', color: '#dc2626', marginTop: '0.15rem' }}>
                        ⚠ Estoque insuficiente! O peso informado excede o saldo em {(pesoSolicitado - saldoDisponivel).toFixed(3)} kg.
                      </span>
                    )}
                  </small>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-acao-rapida"
              disabled={pesoExcedeEstoque}
              style={{
                opacity: pesoExcedeEstoque ? 0.6 : 1,
                cursor: pesoExcedeEstoque ? 'not-allowed' : 'pointer'
              }}
              title={pesoExcedeEstoque ? "Estoque insuficiente para envio" : "Abrir OP e Realizar Baixa no Estoque"}
            >
              <Scale size={18} />
              <span>Abrir OP e Realizar Baixa no Estoque</span>
            </button>
          </form>
        </div>

        {/* PASSO A PASSO 2: CONTROLE E REGISTRO DE CORTE REAL */}
        <div className="tabela-ops-card">
          <h2>Passo 2: Ordens de Produção & Apuração do Rendimento Real</h2>

          <div className="table-responsive">
            <table className="tabela-ops">
              <thead>
                <tr>
                  <th>Código OP</th>
                  <th>Modelo</th>
                  <th>Malha Utilizada</th>
                  <th>Peso Malha (kg)</th>
                  <th>Previsão Teórica</th>
                  <th>Corte Real (Peças)</th>
                  <th>Rendimento Real</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordens.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Nenhuma Ordem de Produção registrada.
                    </td>
                  </tr>
                ) : (
                  ordens.map((op) => (
                    <tr key={op.id_op}>
                      <td><strong>{op.codigo_op}</strong></td>
                      <td>{op.nome_modelo}</td>
                      <td>{op.nome_tecido}</td>
                      <td><strong>{parseFloat(op.peso_malha_enviado_kg).toFixed(3)} kg</strong></td>
                      <td>{op.pecas_planejadas || '—'} un.</td>
                      <td>
                        {op.pecas_reais_cortadas ? (
                          <strong style={{ color: '#2563eb' }}>{op.pecas_reais_cortadas} un.</strong>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Aguardando Corte</span>
                        )}
                      </td>
                      <td>
                        {op.rendimento_real_pecas_kg ? (
                          <span className="badge-rendimento-real">
                            <Sparkles size={13} />
                            {parseFloat(op.rendimento_real_pecas_kg).toFixed(2)} peças/kg
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge-status-pedido ${op.pecas_reais_cortadas ? 'concluido' : 'producao'}`}>
                          {formatarStatusOp(op)}
                        </span>
                      </td>
                      <td>
                        {!op.pecas_reais_cortadas ? (
                          <button 
                            className="btn-acao-rapida" 
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            onClick={() => abrirModalFinalizar(op)}
                          >
                            <Scissors size={14} />
                            Registrar Corte
                          </button>
                        ) : (
                          <button 
                            className="btn-acao-rapida secundario"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            onClick={() => abrirModalFinalizar(op)}
                          >
                            Ajustar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL REGISTRAR CORTE REAL */}
        {modalFinalizarAberto && opSelecionada && (
          <div 
            className="modal-overlay"
            onClick={(e) => e.target.classList.contains('modal-overlay') && setModalFinalizarAberto(false)}
          >
            <div className="modal-content modal-corte-content">
              <div className="modal-header">
                <div>
                  <h3>Registrar Corte Real</h3>
                  <span className="modal-subtitulo">{opSelecionada.codigo_op} — {opSelecionada.nome_modelo}</span>
                </div>
                <button className="modal-close-btn" onClick={() => setModalFinalizarAberto(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleFinalizarCorte}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, marginBottom: '1.2rem', fontSize: '0.88rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '0.3rem' }}>Modelo: <strong>{opSelecionada.nome_modelo}</strong></div>
                  <div style={{ marginBottom: '0.3rem' }}>Peso de Malha na Mesa: <strong>{parseFloat(opSelecionada.peso_malha_enviado_kg).toFixed(3)} kg</strong></div>
                  <div>Previsão Teórica: <strong>{opSelecionada.pecas_planejadas || 0} peças</strong></div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.4rem' }}>
                  <label>Quantidade Física de Peças Cortadas Realmente *</label>
                  <input 
                    type="number" 
                    min="1"
                    placeholder="Ex: 252"
                    value={pecasReais}
                    onChange={(e) => setPecasReais(e.target.value)}
                    required
                    autoFocus
                  />
                  {pecasReais && opSelecionada.peso_malha_enviado_kg > 0 && (
                    <small style={{ color: '#059669', fontWeight: 700, marginTop: '0.4rem', display: 'block' }}>
                      Rendimento Real Calculado: {(parseInt(pecasReais) / parseFloat(opSelecionada.peso_malha_enviado_kg)).toFixed(2)} peças / kg
                    </small>
                  )}
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-cancelar" onClick={() => setModalFinalizarAberto(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-acao-rapida">
                    Salvar Corte & Atualizar Painel
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

export default CorteRendimentoCamisetas;
