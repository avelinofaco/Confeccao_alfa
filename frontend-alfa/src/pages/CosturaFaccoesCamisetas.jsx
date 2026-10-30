import React, { useState, useEffect } from 'react';
import { 
  Scissors, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  PackageCheck, 
  X, 
  PlusCircle, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Layers
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './CosturaFaccoesCamisetas.css';

function CosturaFaccoesCamisetas() {
  const [opsCortadas, setOpsCortadas] = useState([]);
  const [remessas, setRemessas] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal Retorno de Facção
  const [modalRetornoAberto, setModalRetornoAberto] = useState(false);
  const [remessaSelecionada, setRemessaSelecionada] = useState(null);
  const [qtdRetornada, setQtdRetornada] = useState('');
  const [obsRetorno, setObsRetorno] = useState('');

  // Form Envio para Facção
  const [formEnvio, setFormEnvio] = useState({
    id_op: '',
    nome_faccao: '',
    quantidade_enviada: '',
    margem_seguranca_aviamentos_percentual: '3.00',
    observacoes: ''
  });

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resOps, resRemessas] = await Promise.all([
        api.get('/camisetas/ordens/').catch(() => ({ data: [] })),
        api.get('/camisetas/costura/').catch(() => ({ data: [] }))
      ]);

      const listaRemessas = resRemessas.data || [];
      setRemessas(listaRemessas);

      // Calcula o saldo cortado restante disponível para envio de cada OP
      const opsComSaldo = (resOps.data || []).map(op => {
        const totalEnviado = listaRemessas
          .filter(r => r.id_op === op.id_op)
          .reduce((acc, r) => acc + (r.quantidade_enviada || 0), 0);
        const cortadas = op.pecas_reais_cortadas || 0;
        const saldoDisponivel = Math.max(0, cortadas - totalEnviado);
        return {
          ...op,
          total_enviado_costura: totalEnviado,
          saldo_disponivel: saldoDisponivel
        };
      });

      // Filtra APENAS OPs que ainda possuem painéis cortados pendentes de envio
      const disponiveis = opsComSaldo.filter(op => op.pecas_reais_cortadas > 0 && op.saldo_disponivel > 0);
      setOpsCortadas(disponiveis);

      if (disponiveis.length > 0) {
        setFormEnvio(prev => {
          const aindaExiste = disponiveis.find(o => String(o.id_op) === String(prev.id_op));
          const opAlvo = aindaExiste || disponiveis[0];
          return {
            ...prev,
            id_op: opAlvo.id_op,
            quantidade_enviada: opAlvo.saldo_disponivel
          };
        });
      } else {
        setFormEnvio(prev => ({
          ...prev,
          id_op: '',
          quantidade_enviada: ''
        }));
      }
    } catch (err) {
      console.error("Erro ao carregar remessas de costura:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleOpChange = (e) => {
    const id = e.target.value;
    const op = opsCortadas.find(o => String(o.id_op) === String(id));
    setFormEnvio({
      ...formEnvio,
      id_op: id,
      quantidade_enviada: op ? op.saldo_disponivel : ''
    });
  };

  const handleEnviarFaccao = async (e) => {
    e.preventDefault();
    if (!formEnvio.id_op || !formEnvio.nome_faccao || !formEnvio.quantidade_enviada) {
      alert("Preencha a OP, facção parceira e quantidade enviada.");
      return;
    }

    const opAtual = opsCortadas.find(o => String(o.id_op) === String(formEnvio.id_op));
    const qtdNum = parseInt(formEnvio.quantidade_enviada, 10);
    if (opAtual && qtdNum > opAtual.saldo_disponivel) {
      alert(`Quantidade enviada (${qtdNum}) não pode ultrapassar os painéis disponíveis nesta OP (${opAtual.saldo_disponivel}).`);
      return;
    }

    try {
      await api.post('/camisetas/costura/enviar', {
        id_op: parseInt(formEnvio.id_op),
        nome_faccao: formEnvio.nome_faccao,
        quantidade_enviada: qtdNum,
        margem_seguranca_aviamentos_percentual: parseFloat(formEnvio.margem_seguranca_aviamentos_percentual || 3),
        observacoes: formEnvio.observacoes
      });

      alert("Lote enviado com sucesso para a facção! A margem de 3% foi descontada no estoque de todos os aviamentos.");
      setFormEnvio({
        id_op: '',
        nome_faccao: '',
        quantidade_enviada: '',
        margem_seguranca_aviamentos_percentual: '3.00',
        observacoes: ''
      });
      carregarDados();
    } catch (err) {
      console.error("Erro ao enviar para facção:", err);
      alert(err.response?.data?.detail || "Erro ao registrar remessa de costura.");
    }
  };

  const abrirModalRetorno = (rem) => {
    setRemessaSelecionada(rem);
    setQtdRetornada(rem.quantidade_enviada);
    setObsRetorno('');
    setModalRetornoAberto(true);
  };

  const handleRegistrarRetorno = async (e) => {
    e.preventDefault();
    if (!remessaSelecionada || !qtdRetornada) return;

    try {
      await api.put(`/camisetas/costura/${remessaSelecionada.id_costura}/retornar`, {
        quantidade_retornada: parseInt(qtdRetornada),
        observacoes: obsRetorno
      });

      alert("Retorno conferido! Perdas apuradas e saldo aprovado injetado automaticamente no Estoque de Produtos Acabados para expedição.");
      setModalRetornoAberto(false);
      setRemessaSelecionada(null);
      carregarDados();
    } catch (err) {
      console.error("Erro ao registrar retorno:", err);
      alert(err.response?.data?.detail || "Erro ao registrar retorno de costura.");
    }
  };

  // Indicadores
  const totalEnviado = remessas.reduce((acc, r) => acc + (r.quantidade_enviada || 0), 0);
  const totalRetornado = remessas.reduce((acc, r) => acc + (r.saldo_aprovado || 0), 0);
  const totalPerdas = remessas.reduce((acc, r) => acc + (r.perdas_pecas || 0), 0);

  return (
    <div className="costura-camisetas-container">
      <Sidebar />

      <main className="costura-camisetas-main">
        <header className="costura-header">
          <h1>
            <Scissors size={28} color="#2563eb" />
            7. Tela de Costura e Terceirização (Facções)
          </h1>
          <p>
            Controle o fluxo de envio dos painéis cortados para oficinas externas (facções) e o retorno das camisetas prontas:
            aplicação de margens de segurança de aviamentos, apuração automática de perdas e injeção do saldo aprovado no Estoque de Produtos Acabados.
          </p>
        </header>

        {/* INDICADORES DO FLUXO */}
        <section className="metricas-costura-bar">
          <div className="metrica-costura-card">
            <span>Total Painéis Enviados</span>
            <h3>{totalEnviado.toLocaleString('pt-BR')} un.</h3>
          </div>

          <div className="metrica-costura-card">
            <span>Camisetas Prontas (Saldo Aprovado)</span>
            <h3 style={{ color: '#059669' }}>{totalRetornado.toLocaleString('pt-BR')} un.</h3>
          </div>

          <div className="metrica-costura-card">
            <span>Perdas / Avarias de Lote</span>
            <h3 style={{ color: totalPerdas > 0 ? '#dc2626' : '#64748b' }}>
              {totalPerdas.toLocaleString('pt-BR')} un.
            </h3>
          </div>
        </section>

        {/* PASSO 1: FORMULÁRIO DE ENVIO */}
        <div className="form-envio-card">
          <h2>
            <Send size={20} color="#2563eb" />
            Passo 1: Envio de Painéis Cortados para Facção Parceira
          </h2>

          <div className="margem-info-badge">
            <ShieldCheck size={18} />
            <span>
              <strong>Margem de Segurança Aviamentos (+3%):</strong> O percentual é descontado automaticamente no estoque de todos os aviamentos (linhas, etiquetas, tags) vinculados ao modelo para cobrir quebras operacionais na oficina.
            </span>
          </div>

          <form onSubmit={handleEnviarFaccao}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1.2rem' }}>
              <div className="form-group">
                <label>Selecionar OP Cortada *</label>
                <select 
                  value={formEnvio.id_op}
                  onChange={handleOpChange}
                  required
                >
                  <option value="">
                    {opsCortadas.length === 0 ? "Nenhuma OP com painéis disponíveis para envio" : "Selecione uma OP cortada..."}
                  </option>
                  {opsCortadas.map(op => (
                    <option key={op.id_op} value={op.id_op}>
                      [{op.codigo_op}] {op.nome_modelo} — Disponível para Envio: {op.saldo_disponivel} painéis
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Oficina Externa / Facção Parceira *</label>
                <input 
                  type="text" 
                  placeholder="Ex: Facção Estrela ou Costuras Dona Maria"
                  value={formEnvio.nome_faccao}
                  onChange={(e) => setFormEnvio({ ...formEnvio, nome_faccao: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Quantidade de Painéis Enviados *</label>
                <input 
                  type="number" 
                  min="1"
                  max={opsCortadas.find(o => String(o.id_op) === String(formEnvio.id_op))?.saldo_disponivel || undefined}
                  placeholder="Ex: 250"
                  value={formEnvio.quantidade_enviada}
                  onChange={(e) => setFormEnvio({ ...formEnvio, quantidade_enviada: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Margem de Segurança Aviamentos (%)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={formEnvio.margem_seguranca_aviamentos_percentual}
                  onChange={(e) => setFormEnvio({ ...formEnvio, margem_seguranca_aviamentos_percentual: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.4rem' }}>
              <label>Observações / Instruções de Costura</label>
              <textarea 
                rows="2"
                placeholder="Ex: Gola com ribana 1x1 rebatida na galoneira, barra 2 agulhas com fio de helanca..."
                value={formEnvio.observacoes}
                onChange={(e) => setFormEnvio({ ...formEnvio, observacoes: e.target.value })}
              ></textarea>
            </div>

            <button type="submit" className="btn-acao-rapida">
              <Send size={18} />
              <span>Registrar Remessa & Liberar Painéis</span>
            </button>
          </form>
        </div>

        {/* PASSO 2: CONTROLE DE RETORNO E PRODUTOS ACABADOS */}
        <div className="tabela-remessas-card">
          <h2>Passo 2: Remessas Externas & Retorno com Injeção em Produtos Acabados</h2>

          <div className="table-responsive">
            <table className="tabela-remessas">
              <thead>
                <tr>
                  <th>OP</th>
                  <th>Modelo</th>
                  <th>Facção Parceira</th>
                  <th>Enviado</th>
                  <th>Margem Aviamentos</th>
                  <th>Retornado</th>
                  <th>Perdas / Avarias</th>
                  <th>Saldo Aprovado</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {remessas.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Nenhuma remessa externa enviada até o momento.
                    </td>
                  </tr>
                ) : (
                  remessas.map((rem) => (
                    <tr key={rem.id_costura}>
                      <td><strong>{rem.codigo_op}</strong></td>
                      <td>{rem.nome_modelo}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                          <Building2 size={14} color="#64748b" />
                          {rem.nome_faccao}
                        </span>
                      </td>
                      <td><strong>{rem.quantidade_enviada} un.</strong></td>
                      <td>+{parseFloat(rem.margem_seguranca_aviamentos_percentual).toFixed(1)}%</td>
                      <td>
                        {rem.quantidade_retornada !== null ? (
                          <strong>{rem.quantidade_retornada} un.</strong>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Em costura</span>
                        )}
                      </td>
                      <td>
                        {rem.perdas_pecas > 0 ? (
                          <span className="tag-perda-avaria">-{rem.perdas_pecas} avarias</span>
                        ) : rem.perdas_pecas === 0 ? (
                          <span style={{ color: '#059669', fontWeight: 700 }}>Zero perdas</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        {rem.saldo_aprovado !== null ? (
                          <span className="tag-aprovado-acabado">
                            <PackageCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                            {rem.saldo_aprovado} un. Prontas
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Pendente</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge-status-pedido ${rem.status.includes('Retornado') ? 'concluido' : 'producao'}`}>
                          {rem.status}
                        </span>
                      </td>
                      <td>
                        {rem.status.includes('Em Costura') ? (
                          <button 
                            className="btn-acao-rapida" 
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            onClick={() => abrirModalRetorno(rem)}
                          >
                            <PackageCheck size={14} />
                            Conferir Retorno
                          </button>
                        ) : (
                          <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 700 }}>
                            Injetado no Acabado ✓
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL CONFERÊNCIA DE RETORNO */}
        {modalRetornoAberto && remessaSelecionada && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Conferência de Retorno da Facção</h3>
                <button className="modal-close-btn" onClick={() => setModalRetornoAberto(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleRegistrarRetorno}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, marginBottom: '1.2rem', fontSize: '0.88rem' }}>
                  <div>Facção: <strong>{remessaSelecionada.nome_faccao}</strong></div>
                  <div>OP: <strong>{remessaSelecionada.codigo_op}</strong> — Modelo: <strong>{remessaSelecionada.nome_modelo}</strong></div>
                  <div>Painéis Enviados: <strong>{remessaSelecionada.quantidade_enviada} unidades</strong></div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                  <label>Quantidade Física de Camisetas Costuradas que Retornaram *</label>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="Ex: 248"
                    value={qtdRetornada}
                    onChange={(e) => setQtdRetornada(e.target.value)}
                    required
                  />
                  {qtdRetornada !== '' && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      {parseInt(qtdRetornada) < remessaSelecionada.quantidade_enviada ? (
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>
                          Perda apurada no lote: {remessaSelecionada.quantidade_enviada - parseInt(qtdRetornada)} peça(s) extraviada(s) ou avariada(s).
                        </span>
                      ) : (
                        <span style={{ color: '#059669', fontWeight: 700 }}>
                          Lote retornado 100% íntegro sem perdas!
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '1.4rem' }}>
                  <label>Observações do Controle de Qualidade</label>
                  <textarea 
                    rows="2"
                    placeholder="Ex: Peças conferidas na revisão e aprovadas para expedição..."
                    value={obsRetorno}
                    onChange={(e) => setObsRetorno(e.target.value)}
                  ></textarea>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-cancelar" onClick={() => setModalRetornoAberto(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-acao-rapida">
                    Confirmar Retorno & Injetar em Produtos Acabados
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

export default CosturaFaccoesCamisetas;
