import React, { useState, useEffect } from 'react';
import {
  Layers,
  Scissors,
  PlusCircle,
  AlertCircle,
  Sparkles,
  Trash2,
  Menu,
  X
} from 'lucide-react';
import { useToast } from '../components/feedback/useToast';
import { useConfirm } from '../components/feedback/useConfirm';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
import api from '../services/api';
import { formatarPecas, formatarPecasPorKg, formatarPeso, formatarPesoCurto } from '../utils/numeros';
import Sidebar from '../components/Sidebar';
import { FormNovaOp } from '../components/producao/FormNovaOp';
import { ModalCorteOp } from '../components/producao/ModalCorteOp';
import '../components/cadastros/cadastros.css';
import './CorteRendimentoCamisetas.css';

function CorteRendimentoCamisetas() {
  const [modelos, setModelos] = useState([]);
  const [tecidos, setTecidos] = useState([]);
  const [cores, setCores] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [pedidosAbertos, setPedidosAbertos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const toast = useToast();
  const confirmar = useConfirm();

  // OP cujo corte está sendo registrado (null = nenhum modal aberto)
  const [opSelecionada, setOpSelecionada] = useState(null);

  const carregarDados = async () => {
    setLoading(true);
    const { dados, houveFalha } = await buscarEmParalelo([
      '/camisetas/modelos/',
      '/camisetas/insumos/?categoria=ROLO_TECIDO',
      '/camisetas/ordens/',
      '/camisetas/cores/',
      '/camisetas/pedidos/',
    ]);
    const [listaMods, listaTecs, listaOps, listaCores, listaPeds] = dados;
    setModelos(listaMods);
    setTecidos(listaTecs);
    setOrdens(listaOps);
    setCores(listaCores);
    setPedidosAbertos((listaPeds || []).filter((p) => p.status_pedido !== 'Entregue'));
    setLoading(false);
    if (houveFalha) {
      toast.erro('Não foi possível carregar todos os dados de corte. Verifique a conexão e recarregue a página.');
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

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

  // Exclusão de Ordem de Produção (com confirmação e estorno de malha)
  const handleExcluirOp = async (op) => {
    const confirmou = await confirmar({
      titulo: `Excluir ordem de produção ${op.codigo_op}?`,
      mensagem: `Deseja realmente excluir a OP ${op.codigo_op} (${op.nome_modelo})? O peso de ${formatarPeso(op.peso_malha_enviado_kg)} de malha será estornado de volta ao estoque.`,
      textoConfirmar: 'Excluir OP',
      perigo: true,
    });
    if (!confirmou) return;

    try {
      setLoading(true);
      await api.delete(`/camisetas/ordens/${op.id_op}`);
      toast.sucesso(`Ordem de produção ${op.codigo_op} excluída com sucesso.`);
      await carregarDados();
    } catch (err) {
      toast.erro(err.response?.data?.detail || 'Não foi possível excluir a Ordem de Produção.');
    } finally {
      setLoading(false);
    }
  };

  // Métricas do Topo
  const totalKgCortados = ordens.reduce((acc, o) => acc + parseFloat(o.peso_malha_enviado_kg || 0), 0);
  const totalPecasCortadas = ordens.reduce((acc, o) => acc + (o.pecas_reais_cortadas || 0), 0);
  // Sem nada cortado não há rendimento: mostrar um valor fixo aqui fingia um dado que não existe.
  const mediaRendimento = totalKgCortados > 0 ? totalPecasCortadas / totalKgCortados : null;

  return (
    <div className="corte-camisetas-container">
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

      <main className="corte-camisetas-main">

        <header className="corte-header">
          <h1>
            <Layers size={28} color="#2563eb" />
            6. Tela de Corte e Rendimento (Planejamento e Controle - PCP)
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
            <h3>{formatarPesoCurto(totalKgCortados)}</h3>
          </div>

          <div className="metrica-corte-card">
            <span>Peças Reais Cortadas</span>
            <h3 style={{ color: '#2563eb' }}>{formatarPecas(totalPecasCortadas)}</h3>
          </div>

          <div className="metrica-corte-card">
            <span>Rendimento Médio Global</span>
            <h3 style={{ color: '#059669' }}>
              {mediaRendimento === null ? '—' : formatarPecasPorKg(mediaRendimento)}
            </h3>
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
              Cada cor do enfesto tem o seu rolo e o seu peso. Ao abrir a OP, o sistema realiza a{' '}
              <strong>baixa automática</strong> de cada rolo no estoque de malha.
            </span>
          </div>

          <FormNovaOp
            modelos={modelos}
            tecidos={tecidos}
            cores={cores}
            pedidos={pedidosAbertos}
            onCriada={carregarDados}
          />
        </div>

        {/* PASSO A PASSO 2: CONTROLE E REGISTRO DE CORTE REAL */}
        <div className="tabela-ops-card">
          <h2>Passo 2: Ordens de Produção & Apuração do Rendimento Real</h2>

          <div className="table-responsive">
            <table className="tabela-ops" aria-label="Tabela de Ordens de Produção">
              <thead>
                <tr>
                  <th scope="col" className="th-codigo">Código OP</th>
                  <th scope="col" className="th-pedido">Pedido</th>
                  <th scope="col" className="th-modelo">Modelo</th>
                  <th scope="col" className="th-cor">Cor</th>
                  <th scope="col" className="th-malha">Malha Utilizada</th>
                  <th scope="col" className="th-num">Peso Malha</th>
                  <th scope="col" className="th-num">Previsão Teórica</th>
                  <th scope="col" className="th-num">Corte Real</th>
                  <th scope="col" className="th-num">Rendimento Real</th>
                  <th scope="col" className="th-status">Status</th>
                  <th scope="col" className="th-acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordens.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      {loading ? 'Carregando…' : 'Nenhuma Ordem de Produção registrada.'}
                    </td>
                  </tr>
                ) : (
                  ordens.map((op) => (
                    <tr key={op.id_op}>
                      <td><strong className="codigo-op-pill">{op.codigo_op}</strong></td>
                      <td>
                        {op.codigo_pedido ? (
                          <div className="op-pedido-etiqueta" title={op.nome_cliente_pedido || ''}>
                            <strong className="op-pedido-cod">{op.codigo_pedido}</strong>
                            {op.nome_cliente_pedido && (
                              <span className="op-pedido-cliente">{op.nome_cliente_pedido}</span>
                            )}
                          </div>
                        ) : (
                          <span className="op-pedido-avulsa">Avulsa</span>
                        )}
                      </td>
                      <td><span className="op-modelo-nome">{op.nome_modelo}</span></td>

                      {/* Coluna 1: COR (dedicada com bolinha colorida + nome da cor, lista vertical se mais de uma) */}
                      <td className="td-cor">
                        {op.cores && op.cores.length > 0 ? (
                          <div className="op-cores-lista">
                            {op.cores.map((c) => (
                              <div key={c.id_cor} className="op-cor-item">
                                <span
                                  className="cadastro-amostra op-amostra-bolinha"
                                  style={{ background: c.hex_cor || '#cbd5e1' }}
                                  aria-hidden="true"
                                />
                                <span className="op-cor-nome">{c.nome_cor}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Coluna 2: MALHA (nome da malha limpo do rolo) */}
                      <td className="td-malha">
                        <span className="op-malha-nome" title={op.nome_tecido}>
                          {op.nome_tecido || 'Malha'}
                        </span>
                      </td>

                      <td className="td-num">
                        <strong>{formatarPeso(op.peso_malha_enviado_kg)}</strong>
                      </td>
                      <td className="td-num">
                        {op.pecas_planejadas ? formatarPecas(op.pecas_planejadas) : '—'}
                      </td>
                      <td className="td-num">
                        {op.pecas_reais_cortadas ? (
                          <strong className="corte-real-destaque">{op.pecas_reais_cortadas} un.</strong>
                        ) : (
                          <span className="op-aguardando-corte-txt">Aguardando Corte</span>
                        )}
                      </td>
                      <td className="td-num">
                        {op.rendimento_real_pecas_kg ? (
                          <span className="badge-rendimento-real">
                            <Sparkles size={12} />
                            {formatarPecasPorKg(op.rendimento_real_pecas_kg)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge-status-op ${
                          op.status_op === 'Em Costura' ? 'costura' :
                          op.pecas_reais_cortadas ? 'cortado' : 'aguardando'
                        }`}>
                          • {formatarStatusOp(op)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="op-acoes-flex">
                          {!op.pecas_reais_cortadas ? (
                            <button
                              type="button"
                              className="btn-registrar-corte"
                              onClick={() => setOpSelecionada(op)}
                              title="Registrar corte de peças por cor e tamanho"
                            >
                              <Scissors size={14} />
                              <span>Registrar Corte</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-ajustar-corte"
                              disabled={!op.legada && op.quantidade_enviada_costura > 0}
                              title={!op.legada && op.quantidade_enviada_costura > 0
                                ? 'Já houve envio à facção: o corte não pode mais mudar'
                                : 'Ajustar quantidades cortadas'}
                              onClick={() => setOpSelecionada(op)}
                            >
                              Ajustar
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-excluir-op"
                            onClick={() => handleExcluirOp(op)}
                            title="Excluir OP"
                            aria-label={`Excluir ordem de produção ${op.codigo_op}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {opSelecionada && (
          <ModalCorteOp
            op={opSelecionada}
            onFechar={() => setOpSelecionada(null)}
            onSalvo={() => { setOpSelecionada(null); carregarDados(); }}
          />
        )}
      </main>
    </div>
  );
}

export default CorteRendimentoCamisetas;
