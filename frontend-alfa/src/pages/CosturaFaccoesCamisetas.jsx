import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Send,
  PackageCheck,
  ShieldCheck,
  Building2,
  Trash2,
  Menu,
  X
} from 'lucide-react';
import { useToast } from '../components/feedback/useToast';
import { useConfirm } from '../components/feedback/useConfirm';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { FormEnvioFaccao } from '../components/producao/FormEnvioFaccao';
import { ModalRetornoFaccao } from '../components/producao/ModalRetornoFaccao';
import './CosturaFaccoesCamisetas.css';

// Agrupa os SKUs da remessa por cor para exibição limpa
function agruparItensPorCor(itens) {
  if (!itens || itens.length === 0) return [];
  const mapa = {};
  for (const item of itens) {
    const chave = item.id_cor || item.nome_cor;
    if (!mapa[chave]) {
      mapa[chave] = {
        nome_cor: item.nome_cor,
        hex_cor: item.hex_cor,
        tamanhos: []
      };
    }
    mapa[chave].tamanhos.push(item);
  }
  return Object.values(mapa);
}

function CosturaFaccoesCamisetas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [opsCortadas, setOpsCortadas] = useState([]);
  const [remessas, setRemessas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

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

  // Exclusão de remessa externa com estorno de aviamentos ao estoque
  const handleExcluirRemessa = async (remessa) => {
    const confirmou = await confirmar({
      titulo: `Excluir remessa da OP ${remessa.codigo_op}?`,
      mensagem: `Deseja realmente excluir a remessa da OP ${remessa.codigo_op} enviada para a oficina "${remessa.nome_faccao}"? A remessa será removida, os aviamentos descontados no envio serão estornados ao estoque e a OP voltará a ficar disponível para envio no Passo 1.`,
      textoConfirmar: 'Excluir Remessa',
      perigo: true,
    });
    if (!confirmou) return;

    try {
      await api.delete(`/camisetas/costura/${remessa.id_costura}`);
      toast.sucesso(`Remessa da OP ${remessa.codigo_op} excluída e aviamentos estornados com sucesso!`);
      carregarDados();
    } catch (e) {
      toast.erro(e.response?.data?.detail || e.message || 'Falha ao excluir remessa.');
    }
  };

  // Indicadores
  const totalEnviado = remessas.reduce((acc, r) => acc + (r.quantidade_enviada || 0), 0);
  const totalRetornado = remessas.reduce((acc, r) => acc + (r.saldo_aprovado || 0), 0);
  const totalPerdas = remessas.reduce((acc, r) => acc + (r.perdas_pecas || 0), 0);

  return (
    <div className="costura-camisetas-container">
      {/* CABEÇALHO MOBILE (Só aparece no celular) */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-box-sm">
            <Scissors size={20} color="#2563eb" strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>Confecção Alfa</h2>
        </div>
        <button 
          type="button"
          className="btn-menu-mobile" 
          onClick={() => setMenuMobileAberto(!menuMobileAberto)}
          aria-label="Abrir menu de navegação"
        >
          {menuMobileAberto ? <X size={24} color="#1f2937" /> : <Menu size={24} color="#1f2937" />}
        </button>
      </div>

      {/* Backdrop escuro para fechar ao tocar fora no mobile */}
      {menuMobileAberto && (
        <div className="sidebar-backdrop" onClick={() => setMenuMobileAberto(false)} aria-hidden="true" />
      )}

      <Sidebar menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto} />

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
                  <th className="th-num">Enviado</th>
                  <th className="th-num">Retornado</th>
                  <th className="th-num">Perdas / Avarias</th>
                  <th className="th-num">Saldo Aprovado</th>
                  <th>Status</th>
                  <th className="th-actions">Ações</th>
                </tr>
              </thead>
              <tbody>
                {remessas.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      {loading ? 'Carregando…' : 'Nenhuma remessa externa enviada até o momento.'}
                    </td>
                  </tr>
                ) : (
                  remessas.map((rem) => {
                    const gruposCor = agruparItensPorCor(rem.itens);
                    const emCostura = (rem.status || '').includes('Em Costura');

                    return (
                      <tr key={rem.id_costura}>
                        <td><strong className="remessa-codigo-op">{rem.codigo_op}</strong></td>
                        <td>
                          <div className="remessa-modelo-nome">{rem.nome_modelo}</div>
                          {gruposCor.length > 0 && (
                            <div className="remessa-cores-container">
                              {gruposCor.map((corGrupo, idx) => (
                                <div key={idx} className="remessa-cor-linha">
                                  <span className="remessa-cor-rotulo">
                                    <span
                                      className="remessa-cor-bolinha"
                                      style={{ backgroundColor: corGrupo.hex_cor || '#94a3b8' }}
                                    />
                                    {corGrupo.nome_cor}:
                                  </span>
                                  <div className="remessa-tamanhos-tags">
                                    {corGrupo.tamanhos.map((tam, tIdx) => (
                                      <span key={tIdx} className="remessa-tamanho-tag">
                                        {tam.rotulo}: {tam.qtd_enviada}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="remessa-faccao-tag">
                            <Building2 size={14} color="#64748b" />
                            {rem.nome_faccao}
                          </span>
                        </td>
                        <td className="td-num"><strong>{rem.quantidade_enviada} un.</strong></td>
                        <td className="td-num">
                          {rem.quantidade_retornada !== null ? (
                            <strong>{rem.quantidade_retornada} un.</strong>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Em costura</span>
                          )}
                        </td>
                        <td className="td-num">
                          {rem.perdas_pecas > 0 ? (
                            <span className="tag-perda-avaria">-{rem.perdas_pecas} avarias</span>
                          ) : rem.perdas_pecas === 0 ? (
                            <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Zero perdas</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td className="td-num">
                          {rem.saldo_aprovado !== null ? (
                            <span className="tag-aprovado-acabado">
                              <PackageCheck size={13} />
                              {rem.saldo_aprovado} UN. PRONTAS
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Pendente</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge-status-remessa ${rem.status.includes('Retornado') ? 'retornado' : 'em-costura'}`}>
                            • {rem.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="td-actions">
                          {emCostura ? (
                            <div className="remessa-acoes-flex">
                              <button
                                className="btn-conferir-retorno"
                                onClick={() => setRemessaSelecionada(rem)}
                              >
                                <PackageCheck size={14} />
                                Conferir Retorno
                              </button>
                              <button
                                className="btn-excluir-remessa"
                                title="Excluir remessa"
                                onClick={() => handleExcluirRemessa(rem)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              Lançado em Produtos Prontos ✓
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
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
