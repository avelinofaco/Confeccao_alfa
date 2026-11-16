import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Send,
  PackageCheck,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { useToast } from '../components/feedback/useToast';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
import Sidebar from '../components/Sidebar';
import { FormEnvioFaccao } from '../components/producao/FormEnvioFaccao';
import { ModalRetornoFaccao } from '../components/producao/ModalRetornoFaccao';
import { resumoPorCor } from '../utils/producao';
import './CosturaFaccoesCamisetas.css';

function CosturaFaccoesCamisetas() {
  const toast = useToast();
  const [opsCortadas, setOpsCortadas] = useState([]);
  const [remessas, setRemessas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(false);

  // Remessa cujo retorno está sendo conferido (null = nenhum modal aberto)
  const [remessaSelecionada, setRemessaSelecionada] = useState(null);

  const carregarDados = async () => {
    setLoading(true);
    const { dados, houveFalha } = await buscarEmParalelo([
      '/camisetas/ordens/', '/camisetas/costura/', '/camisetas/modelos/', '/camisetas/cores/',
    ]);
    const [listaOps, listaRemessas, listaModelos, listaCores] = dados;
    setOpsCortadas(listaOps.filter((op) => (op.saldo_disponivel_envio || 0) > 0));
    setRemessas(listaRemessas);
    setModelos(listaModelos);
    setCores(listaCores);
    if (houveFalha) {
      toast.erro('Não foi possível carregar todas as OPs e remessas. Verifique a conexão e recarregue a página.');
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

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
            Controle o fluxo de envio das peças cortadas para oficinas externas (facções) e o retorno das camisetas prontas,
            sempre por cor e tamanho: margem de segurança de aviamentos, apuração automática de perdas e lançamento do
            saldo aprovado em Produtos Prontos.
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
            Passo 1: Envio de Peças Cortadas para Facção Parceira
          </h2>

          <div className="margem-info-badge">
            <ShieldCheck size={18} />
            <span>
              <strong>Margem de Segurança Aviamentos (+3%):</strong> O percentual é descontado automaticamente no estoque de todos os aviamentos (linhas, etiquetas, tags) vinculados ao modelo para cobrir quebras operacionais na oficina.
            </span>
          </div>

          <FormEnvioFaccao ops={opsCortadas} onEnviado={carregarDados} />
        </div>

        {/* PASSO 2: CONTROLE DE RETORNO E PRODUTOS PRONTOS */}
        <div className="tabela-remessas-card">
          <h2>Passo 2: Remessas Externas & Retorno com Lançamento em Produtos Prontos</h2>

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
                      {loading ? 'Carregando…' : 'Nenhuma remessa externa enviada até o momento.'}
                    </td>
                  </tr>
                ) : (
                  remessas.map((rem) => (
                    <tr key={rem.id_costura}>
                      <td><strong>{rem.codigo_op}</strong></td>
                      <td>
                        {rem.nome_modelo}
                        {rem.itens.length > 0 && <small className="remessa-resumo">{resumoPorCor(rem.itens)}</small>}
                      </td>
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
                            onClick={() => setRemessaSelecionada(rem)}
                          >
                            <PackageCheck size={14} />
                            Conferir Retorno
                          </button>
                        ) : (
                          <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 700 }}>
                            Lançado em Produtos Prontos ✓
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

        {remessaSelecionada && (
          <ModalRetornoFaccao
            remessa={remessaSelecionada}
            modelo={modelos.find((m) => m.id_modelo === remessaSelecionada.id_modelo)}
            cores={cores}
            onFechar={() => setRemessaSelecionada(null)}
            onSalvo={() => { setRemessaSelecionada(null); carregarDados(); }}
          />
        )}
      </main>
    </div>
  );
}

export default CosturaFaccoesCamisetas;
