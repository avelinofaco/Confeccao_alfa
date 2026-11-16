import React, { useState, useEffect } from 'react';
import {
  Layers,
  Scissors,
  PlusCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useToast } from '../components/feedback/useToast';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
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
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // OP cujo corte está sendo registrado (null = nenhum modal aberto)
  const [opSelecionada, setOpSelecionada] = useState(null);

  const carregarDados = async () => {
    setLoading(true);
    const { dados, houveFalha } = await buscarEmParalelo([
      '/camisetas/modelos/',
      '/camisetas/insumos/?categoria=ROLO_TECIDO',
      '/camisetas/ordens/',
      '/camisetas/cores/',
    ]);
    const [listaMods, listaTecs, listaOps, listaCores] = dados;
    setModelos(listaMods);
    setTecidos(listaTecs);
    setOrdens(listaOps);
    setCores(listaCores);
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

  // Métricas do Topo
  const totalKgCortados = ordens.reduce((acc, o) => acc + parseFloat(o.peso_malha_enviado_kg || 0), 0);
  const totalPecasCortadas = ordens.reduce((acc, o) => acc + (o.pecas_reais_cortadas || 0), 0);
  const mediaRendimento = totalKgCortados > 0 ? (totalPecasCortadas / totalKgCortados).toFixed(2) : '5.60';

  return (
    <div className="corte-camisetas-container">
      <Sidebar />

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
              Cada cor do enfesto tem o seu rolo e o seu peso. Ao abrir a OP, o sistema realiza a{' '}
              <strong>baixa automática</strong> de cada rolo no estoque de malha.
            </span>
          </div>

          <FormNovaOp modelos={modelos} tecidos={tecidos} cores={cores} onCriada={carregarDados} />
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
                      {loading ? 'Carregando…' : 'Nenhuma Ordem de Produção registrada.'}
                    </td>
                  </tr>
                ) : (
                  ordens.map((op) => (
                    <tr key={op.id_op}>
                      <td><strong>{op.codigo_op}</strong></td>
                      <td>{op.nome_modelo}</td>
                      <td>
                        {op.cores.length > 0 ? op.cores.map((c) => (
                          <span key={c.id_cor} className="op-cor-etiqueta">
                            <span className="cadastro-amostra" style={{ background: c.hex_cor }} aria-hidden="true" />
                            {c.nome_cor} · {Number(c.peso_kg).toFixed(1)} kg
                          </span>
                        )) : op.nome_tecido}
                      </td>
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
                            onClick={() => setOpSelecionada(op)}
                          >
                            <Scissors size={14} />
                            Registrar Corte
                          </button>
                        ) : (
                          <button
                            className="btn-acao-rapida secundario"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            disabled={!op.legada && op.quantidade_enviada_costura > 0}
                            title={!op.legada && op.quantidade_enviada_costura > 0
                              ? 'Já houve envio à facção: o corte não pode mais mudar'
                              : undefined}
                            onClick={() => setOpSelecionada(op)}
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
